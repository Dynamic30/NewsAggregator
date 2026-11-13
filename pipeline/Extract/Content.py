# main extraction layer

"""

How it Works 

1. Will use normal filters + trafilatura to fetch data for each article
2. if any website have bot detection or paywall or login, it will shift to crawl4ai scraper for that page
"""


import trafilatura
 
from Extract import CurlBotDetection, BrowserBotDetection
