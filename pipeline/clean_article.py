SOURCE_NAMES = {
    "sports.ndtv.com": "NDTV Sports",
    "ndtv.com": "NDTV",
    "thehindu.com": "The Hindu",
    "economictimes.indiatimes.com": "Economic Times",
    "timesofindia.indiatimes.com": "The Times of India",
    "livemint.com": "Mint",
    "business-standard.com": "Business Standard",
    "moneycontrol.com": "Moneycontrol",
    "gadgets360.com": "Gadgets 360",
}


def clean_title(title, source):
    suffix = f" - {source}"
    if title and source and title.endswith(suffix):
        return title[:-len(suffix)]
    return title


def clean_description(description):
    if description and "news.google.com/rss/articles" in description:
        return None
    return description


def clean_source(source):
    if not source:
        return source
    domain = source.lower().removeprefix("www.")
    for known_domain, name in SOURCE_NAMES.items():
        if domain == known_domain or domain.endswith("." + known_domain):
            return name
    return source
