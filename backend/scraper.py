"""
Brand intelligence scraper.
Attempts to extract colors, fonts, tone, and style from a website.
Falls back gracefully if the site is empty, new, or unreachable.
"""

import httpx
import re
import logging
from bs4 import BeautifulSoup
from urllib.parse import urljoin

logger = logging.getLogger(__name__)

TIMEOUT = 15.0
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}


def _extract_colors_from_css(css_text: str) -> list[str]:
    """Pull hex colors from inline/linked CSS."""
    hex_colors = re.findall(r"#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", css_text)
    # Deduplicate, skip pure black/white
    seen = set()
    result = []
    for c in hex_colors:
        c = c.upper()
        if c not in seen and c not in ("#FFFFFF", "#FFF", "#000000", "#000", "#333333"):
            seen.add(c)
            result.append(c)
    return result[:12]


def _extract_fonts(soup: BeautifulSoup, css_text: str) -> list[str]:
    """Extract font families from Google Fonts links and CSS."""
    fonts = set()

    # Google Fonts links
    for link in soup.find_all("link", href=True):
        href = link["href"]
        if "fonts.googleapis.com" in href:
            families = re.findall(r"family=([^&:]+)", href)
            for f in families:
                fonts.add(f.replace("+", " ").split(":")[0])

    # CSS font-family declarations
    css_fonts = re.findall(r"font-family\s*:\s*['\"]?([^;'\"]+)", css_text)
    for f in css_fonts:
        name = f.split(",")[0].strip().strip("'\"")
        if name and len(name) < 40 and name.lower() not in (
            "inherit", "initial", "sans-serif", "serif", "monospace",
            "system-ui", "-apple-system", "arial", "helvetica",
        ):
            fonts.add(name)

    return list(fonts)[:8]


def _extract_meta(soup: BeautifulSoup) -> dict:
    """Extract meta description, title, OG data."""
    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    meta_desc = ""
    og_image = ""

    for meta in soup.find_all("meta"):
        name = meta.get("name", "").lower()
        prop = meta.get("property", "").lower()
        content = meta.get("content", "")

        if name == "description" or prop == "og:description":
            meta_desc = content
        if prop == "og:image":
            og_image = content

    return {"title": title, "description": meta_desc, "og_image": og_image}


def scrape_website(url: str) -> dict:
    """
    Scrape a website for brand intelligence.
    Returns extracted data or a flag indicating the site was empty/unreachable.
    """
    result = {
        "success": False,
        "url": url,
        "has_content": False,
        "title": "",
        "description": "",
        "colors": [],
        "fonts": [],
        "og_image": "",
        "text_snippet": "",
        "error": None,
    }

    if not url:
        result["error"] = "No URL provided"
        return result

    # Normalize URL
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        with httpx.Client(timeout=TIMEOUT, headers=HEADERS, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()

        html = resp.text
        if len(html) < 200:
            result["error"] = "Site appears empty or under construction"
            return result

        soup = BeautifulSoup(html, "lxml")

        # Collect all CSS text (inline styles + style tags)
        css_text = ""
        for style_tag in soup.find_all("style"):
            css_text += style_tag.get_text() + "\n"
        for tag in soup.find_all(style=True):
            css_text += tag["style"] + "\n"

        # Try to fetch linked stylesheets (first 3 only)
        for link in soup.find_all("link", rel="stylesheet", href=True)[:3]:
            css_url = urljoin(url, link["href"])
            try:
                with httpx.Client(timeout=8, headers=HEADERS) as client:
                    css_resp = client.get(css_url)
                    if css_resp.status_code == 200:
                        css_text += css_resp.text + "\n"
            except Exception:
                pass

        # Extract data
        meta = _extract_meta(soup)
        colors = _extract_colors_from_css(css_text)
        fonts = _extract_fonts(soup, css_text)

        # Get visible text snippet
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        text_snippet = " ".join(text.split())[:500]

        has_content = bool(meta["title"] or meta["description"] or colors or fonts or len(text_snippet) > 100)

        result.update({
            "success": True,
            "has_content": has_content,
            "title": meta["title"],
            "description": meta["description"],
            "colors": colors,
            "fonts": fonts,
            "og_image": meta["og_image"],
            "text_snippet": text_snippet,
        })

        logger.info(
            f"Scraped {url}: {len(colors)} colors, {len(fonts)} fonts, "
            f"content={'yes' if has_content else 'minimal'}"
        )

    except httpx.HTTPStatusError as e:
        result["error"] = f"HTTP {e.response.status_code}"
        logger.warning(f"Scrape failed for {url}: HTTP {e.response.status_code}")
    except Exception as e:
        result["error"] = str(e)[:200]
        logger.warning(f"Scrape failed for {url}: {e}")

    return result
