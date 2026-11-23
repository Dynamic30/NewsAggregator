import html
import re

OVERRIDES = {"timesofindia": "The Times of India", "livemint": "Mint"}

SMALL_WORDS = {"of", "the", "and", "in", "for", "on", "a", "new"}
OUTLET_WORDS = "times|news|today|express|online|post|daily|herald|mint|india|standard|hindu|wire|tribune|review|journal|magazine|economist"
TLD = re.compile(r"(\.(co|com|org|net|gov|edu|ac))?\.[a-z]{2,3}$", re.I)
IGNORED_SUBDOMAIN = re.compile(r"^(www|m|amp|mobile|climate|tech|auto|money|health|news)$", re.I)
QUALIFIER_SUBDOMAIN = re.compile(r"^sports?$", re.I)
TITLE_SEPARATOR = re.compile(r"\s[-–—|]\s")
DATELINE = re.compile(r"^(?:[A-Z][A-Za-z.]*(?: [A-Z][A-Za-z.]*){0,2}|[A-Z ]{3,30}):\s+(?=\S)")
BOILERPLATE = re.compile(
    r"^(also read|read more|read also|click here|disclaimer|follow us|listen to|subscribe|sign up|download|advertisement|story continues|related|watch|photo:|image:|source:|updated:|published|by |note:)"
    r"|read more$|\bis a (senior |chief |special )?(journalist|correspondent|reporter|editor|writer)\b|years of experience",
    re.I,
)
SENTENCE_END = re.compile(r"[.!?।。][\"”’)]*(?=\s)")
ABBREVIATIONS = {"mr", "mrs", "ms", "dr", "prof", "st", "no", "rs", "vs", "jr", "sr", "gen", "col", "sen", "rep", "lt", "capt", "mt", "dept", "govt", "inc", "ltd", "co"}


def squash(text):
    return re.sub(r"^the", "", re.sub(r"\W+", "", text.lower()))


def strip_markup(text):
    for _ in range(3):
        cleaned = html.unescape(re.sub(r"<[^>]+>", " ", text))
        if cleaned == text:
            break
        text = cleaned
    return re.sub(r"\s+", " ", text).strip()


def humanize(label):
    name = re.sub(r"[-_]+", " ", label)
    name = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name)
    name = re.sub(r"(?<=[A-Za-z])(?=\d)|(?<=\d)(?=[A-Za-z])", " ", name).lower()
    name = re.sub(r"\bthe(?!atre|ory|rapy|rmal)(?=[a-z]{3,}\b)", "the ", name)
    name = re.sub(r"\b(new(?!s)|indian?)(?=[a-z]{3,}\b)", r"\1 ", name)
    name = re.sub(r"(?<=[a-z]{3})of(?=[a-z]{3})", " of ", name)
    name = re.sub(rf"(?<=[a-z]{{3}})({OUTLET_WORDS})\b", r" \1", name)

    words = name.split()
    formatted = []
    for position, word in enumerate(words):
        if word in SMALL_WORDS:
            formatted.append(word.capitalize() if position == 0 else word)
        elif word.isdigit():
            formatted.append(word)
        elif (len(words) == 1 and len(word) <= 3) or (len(word) <= 4 and not re.search(r"[aeiou]", word)):
            formatted.append(word.upper())
        else:
            formatted.append(word.capitalize())
    return " ".join(formatted)


def clean_title(title, source):
    if not title:
        return title
    title = strip_markup(title)
    while source:
        for separator in TITLE_SEPARATOR.finditer(title):
            if squash(title[separator.end():]) == squash(source):
                title = title[:separator.start()].rstrip()
                break
        else:
            break
    return title


def clean_description(description, title=None):
    if not description or "news.google.com/rss/articles" in description:
        return None
    text = strip_markup(description)
    if not text:
        return None
    if title:
        title_key, text_key = squash(title), squash(text)
        if text_key == title_key or (text_key.startswith(title_key) and len(text_key) < len(title_key) + 40):
            return None
    return text


def description_from_markdown(markdown):
    for line in (markdown or "").split("\n"):
        line = line.strip()
        if re.match(r"^([-+*]\s|\d+[.)]\s|#|\||>|```|!\[)", line):
            continue
        text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", line)
        text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
        text = strip_markup(re.sub(r"[*`]+", "", text))
        if BOILERPLATE.search(text):
            continue
        text = DATELINE.sub("", text)
        if len(text) < 60 or text[0].islower() or re.match(r"['’](s|re|ve|ll|d|t)\b", text) or re.search(r"[›»]|\s/\s.+\s/\s|\s\|\s", text):
            continue
        return shorten(text)
    return None


def shorten(text, limit=280):
    if len(text) <= limit:
        return text
    for match in reversed(list(SENTENCE_END.finditer(text, 0, limit))):
        word = re.search(r"([A-Za-z]+)$", text[:match.start()])
        if match.end() >= 60 and not (word and (len(word.group(1)) == 1 or word.group(1).lower() in ABBREVIATIONS)):
            return text[:match.end()].strip()
    return text[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def clean_source(source):
    if not source:
        return source
    source = source.strip()
    if " " in source or "." not in source or all(len(label) <= 1 or label.isdigit() for label in source.split(".")):
        return source

    host = re.sub(r"^(https?://)?(www\.)?", "", source, flags=re.I)
    labels = TLD.sub("", re.sub(r"[/:?#].*$", "", host)).split(".")
    brand = next((label for label in labels if not IGNORED_SUBDOMAIN.match(label) and not QUALIFIER_SUBDOMAIN.match(label)), labels[0])
    qualifiers = [humanize(label) for label in labels if QUALIFIER_SUBDOMAIN.match(label) and label != brand]
    return " ".join([OVERRIDES.get(brand.lower()) or humanize(brand)] + qualifiers)
