import json
import logging

import ollama
from dotenv import load_dotenv
import os

load_dotenv(override=True)
log = logging.getLogger("pipeline")

llm_url = os.getenv("LLM_URL")
llm_api_key = os.getenv("LLM_API_KEY")
model=os.getenv("LLM_MODEL")

client = ollama.Client(
    host=llm_url or None,
    headers={"Authorization": f"Bearer {llm_api_key}"} if llm_api_key else {},
)

MAX_TEXT_CHARS_PER_ARTICLE = 3000
TEXT_CHAR_BUDGET = 9000

PARTIES = {
    "government": "the BJP-led NDA: the central government and every state government the NDA runs",
    "opposition": "all other political parties, including state governments run by non-NDA parties (Congress, INDIA bloc, regional parties)",
    "public": "ordinary citizens and the general public",
    "business": "business and industry",
}

SYSTEM_PROMPT = f"""You analyse how Indian news articles about the SAME story portray different groups.

You will receive one or more articles about one story, labelled A, B, C... Source names are hidden on purpose. Use only the text given.

Groups:
{chr(10).join(f'- {key}: {description}' for key, description in PARTIES.items())}

Step 1. Decide if the story is political: it is about government policy, elections, political parties or leaders, or the conflict between them. Crime, accidents, disasters, sport, culture, science, health, weather and business news are NOT political. A minister or party being named, quoted, or attending an event, or an official giving facts, does not make a story political.
Set is_political to true or false. If it is false, set every score to null.

Step 2. If it is political, score how each article PORTRAYS each group, from 0 to 100:
- 0-30: hostile or critical (blamed, attacked, shown as failing)
- 31-45: mildly critical
- 46-54: neutral, factual, or balanced
- 55-69: mildly favourable
- 70-100: praising or strongly favourable
Rules:
- Assign every party or government to a group by WHICH PARTY runs it, never by the fact that it is "the government" of some state. A state government run by a non-NDA party belongs to opposition. A state government run by the NDA belongs to government.
- Judge the portrayal, not the event. Plain, neutral reporting of bad news is about 50.
- An article that mostly quotes one side and leaves its claims unchallenged is favourable to that side and critical of the side it attacks.
- Set a group to null if the article does not mention or clearly involve it.
- Each reason is at most 15 words and cites specific wording or sourcing.
- When there are several articles, compare them: the same facts framed more or less favourably should get different scores.
- confidence is 0.0 to 1.0: how sure you are of the scores for that article.
- cluster_summary is 1-2 sentences: what the story is, and how the articles differ in framing.

Return ONLY valid JSON in exactly this shape, one entry per article in the same order:
{{
  "is_political": true,
  "articles": [
    {{
      "label": "A",
      "confidence": 0.8,
      "groups": {{
        "government": {{"score": 62, "reason": "..."}},
        "opposition": {{"score": null, "reason": null}},
        "public": {{"score": 50, "reason": "..."}},
        "business": {{"score": null, "reason": null}}
      }}
    }}
  ],
  "cluster_summary": "..."
}}"""

ARTICLE_TEMPLATE = """Article {label}
Title: {title}
Description: {description}
Text: {text}"""

group_schema = {
    "type": "object",
    "properties": {
        "score": {"type": ["integer", "null"]},
        "reason": {"type": ["string", "null"]},
    },
    "required": ["score", "reason"],
}

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "is_political": {"type": "boolean"},
        "articles": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string"},
                    "confidence": {"type": "number"},
                    "groups": {
                        "type": "object",
                        "properties": {party: group_schema for party in PARTIES},
                        "required": list(PARTIES),
                    },
                },
                "required": ["label", "confidence", "groups"],
            },
        },
        "cluster_summary": {"type": "string"},
    },
    "required": ["is_political", "articles", "cluster_summary"],
}

def build_messages(articles):
    # articles: list of dicts with id, title, description, markdown. Returns the messages and a label -> article id map
    text_limit = min(MAX_TEXT_CHARS_PER_ARTICLE, TEXT_CHAR_BUDGET // len(articles))
    labels = {}
    blocks = []
    for index, article in enumerate(articles):
        label = chr(ord("A") + index)
        labels[label] = article["id"]
        title, _, outlet = article["title"].rpartition(" - ")
        if not title or len(outlet.split()) > 4:
            title = article["title"]
        description = article["description"] or ""
        if "<" in description:
            description = ""
        blocks.append(ARTICLE_TEMPLATE.format(
            label=label,
            title=title,
            description=description,
            text=article["markdown"][:text_limit],
        ))
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "\n\n".join(blocks)},
    ]
    return messages, labels

def stucture_output(raw, labels):
    # Turns the model's JSON into per-article results (keyed by article id) plus the cluster summary and representative
    scores = {}
    for item in raw["articles"]:
        article_id = labels.get(item["label"])
        if article_id is None:
            continue
        groups = item["groups"]
        if not raw["is_political"]:
            groups = {party: {"score": None, "reason": None} for party in PARTIES}
        government = groups["government"]["score"]
        opposition = groups["opposition"]["score"]
        government = 50 if government is None else government
        opposition = 50 if opposition is None else opposition

        score = max(0, min(100, 50 + (government - opposition) / 2))
        if score > 55:
            political_lean = "government"
        elif score < 45:
            political_lean = "opposition"
        else:
            political_lean = "neutral"

        scores[article_id] = {
            "score": score,
            "confidence": item["confidence"],
            "political_lean": political_lean,
            "breakdown": groups,
        }

    if not scores:
        return None

    representative_article_id = min(scores, key=lambda article_id: abs(scores[article_id]["score"] - 50))
    return {
        "scores": scores,
        "cluster_summary": raw["cluster_summary"],
        "representative_article_id": representative_article_id,
    }

def call_model(messages):
    # Returns the parsed JSON from the model, retrying once. None if both attempts fail
    for attempt in range(2):
        try:
            response = client.chat(
                model=model,
                messages=messages,
                format=RESPONSE_SCHEMA,
                think=False,
                options={"temperature": 0, "num_ctx": 16384, "num_predict": 3000},
            )
            content = response["message"]["content"]
            return json.loads(content[content.index("{"):content.rindex("}") + 1])
        except Exception as error:
            log.error(f"[lean_scoring] model call failed (attempt {attempt + 1}): {str(error).splitlines()[0]}")
    return None

def llm_main(articles):
    """
    1. call call_model and get output
    2. give output to structure_output to make it more strucutred
    3. get the final result and give it back to orchestrator (return ...)
    """
    messages, labels = build_messages(articles)
    raw = call_model(messages)
    if raw is None:
        return None
    return stucture_output(raw, labels)