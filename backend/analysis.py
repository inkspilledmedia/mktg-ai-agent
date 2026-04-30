"""
Marketing intelligence analysis using Groq LLM API.
5-chain pipeline, all hardened for production.
"""

import json
import os
import re
import logging
from groq import Groq

logger = logging.getLogger(__name__)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
DEFAULT_MODEL = "llama-3.3-70b-versatile"


# ═══════════════════════════════════════════════════════════════════
#  JSON REPAIR + EXTRACTION
# ═══════════════════════════════════════════════════════════════════

def _sanitize(text):
    for old, new in [("\u2018","'"),("\u2019","'"),("\u201c",'\\"'),("\u201d",'\\"'),("\u2013","-"),("\u2014","-"),("\u2026","..."),("\t"," "),("\r","")]:
        text = text.replace(old, new)
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)


def _repair_truncated(text):
    start = text.find("{")
    if start == -1: return text
    text = text[start:]
    in_str = esc = False
    last_good = brace = bracket = 0
    for i, c in enumerate(text):
        if esc: esc = False; continue
        if c == '\\' and in_str: esc = True; continue
        if c == '"':
            in_str = not in_str
            if not in_str: last_good = i
            continue
        if in_str: continue
        if c == '{': brace += 1
        elif c == '}': brace -= 1; last_good = i
        elif c == '[': bracket += 1
        elif c == ']': bracket -= 1; last_good = i
    result = text[:last_good+1] if last_good > 0 else text
    if in_str: result += '"'
    result = re.sub(r",\s*$", "", result.rstrip())
    brace = bracket = 0; in_str = esc = False
    for c in result:
        if esc: esc = False; continue
        if c == '\\' and in_str: esc = True; continue
        if c == '"': in_str = not in_str; continue
        if in_str: continue
        if c == '{': brace += 1
        elif c == '}': brace -= 1
        elif c == '[': bracket += 1
        elif c == ']': bracket -= 1
    return result + "]"*max(0,bracket) + "}"*max(0,brace)


def extract_json(text):
    text = _sanitize(text.strip())
    for fn in [
        lambda t: json.loads(t),
        lambda t: json.loads(re.search(r"```(?:json)?\s*(\{.*?\})\s*```", t, re.DOTALL).group(1)),
        lambda t: json.loads(re.search(r"\{.*\}", t, re.DOTALL).group(0)),
        lambda t: json.loads(re.sub(r",\s*([}\]])", r"\1", re.search(r"\{.*\}", t, re.DOTALL).group(0))),
        lambda t: json.loads(re.sub(r",\s*([}\]])", r"\1", _repair_truncated(t))),
    ]:
        try:
            return fn(text)
        except:
            continue
    logger.error(f"JSON extraction failed: {text[:500]}")
    raise ValueError("Could not extract valid JSON")


# ═══════════════════════════════════════════════════════════════════
#  PLACEHOLDER DETECTION
# ═══════════════════════════════════════════════════════════════════

PLACEHOLDER_PATTERNS = [
    r"^WRITE ", r"^task\d+$", r"^idea\d+$", r"^point \d+$", r"^topic\d+$",
    r"^type$", r"^title$", r"^subtitle$", r"^hook$", r"^format$", r"^platform$",
    r"^q\d+$", r"^opt\d+$", r"^a\d+$", r"^reason$", r"^#hex$", r"^name$",
    r"^usage$", r"^style$", r"^font name$", r"^mood words$", r"^elements$", r"^audience$",
]

def _is_placeholder(val):
    if not isinstance(val, str): return False
    for pat in PLACEHOLDER_PATTERNS:
        if re.match(pat, val.strip(), re.IGNORECASE): return True
    return False

def _has_real_content(data):
    pc = tc = 0
    for v in data.values():
        if isinstance(v, str):
            tc += 1
            if _is_placeholder(v): pc += 1
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, str):
                    tc += 1
                    if _is_placeholder(item): pc += 1
                elif isinstance(item, dict):
                    for sv in item.values():
                        if isinstance(sv, str):
                            tc += 1
                            if _is_placeholder(sv): pc += 1
    return pc / max(tc, 1) <= 0.3


# ═══════════════════════════════════════════════════════════════════
#  GROQ LLM CALLER
# ═══════════════════════════════════════════════════════════════════

def _call_groq(system, user, model=None, max_retries=2):
    model = model or DEFAULT_MODEL
    last_error = None

    for attempt in range(max_retries + 1):
        try:
            extra = ""
            if attempt > 0:
                extra = "\n\nIMPORTANT: Generate REAL, SPECIFIC content. No placeholders. Keep values concise."
                logger.info(f"Retry {attempt}/{max_retries}")

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user + extra},
                ],
                temperature=0.15,
                max_tokens=8192,
                response_format={"type": "json_object"},
            )

            raw = response.choices[0].message.content
            logger.info(f"Groq response: {len(raw)} chars (attempt {attempt+1})")

            parsed = extract_json(raw)
            if _has_real_content(parsed):
                return parsed
            else:
                raise ValueError("Placeholder content detected")

        except ValueError as e:
            last_error = e
            logger.warning(f"Attempt {attempt+1}: {e}")
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            raise ConnectionError(f"Groq API failed: {e}")

    raise ValueError(f"Failed after {max_retries+1} attempts: {last_error}")


def _topics_str(topics):
    return ", ".join(str(t) for t in topics) if isinstance(topics, list) else str(topics)

def _summary_str(summary):
    return ". ".join(str(s) for s in summary) if isinstance(summary, list) else str(summary)


# ═══════════════════════════════════════════════════════════════════
#  PROMPTS
# ═══════════════════════════════════════════════════════════════════

CHAIN1_SYS = "You analyze transcripts and extract key insights. Respond with valid JSON only."

CHAIN1_USR = """Analyze this transcript for a {niche} {client_type} called "{company_name}".

Additional context: {extra_context}

TRANSCRIPT:
\"\"\"{transcript}\"\"\"

Generate a JSON response with these fields (write REAL content, not placeholders):
{{
  "clean_transcript": "Write a 3-4 sentence summary of what was discussed",
  "summary": ["Write the first key insight", "Write the second key insight", "Write the third key insight"],
  "detected_topics": ["Write topic 1", "Write topic 2", "Write topic 3"],
  "target_audience_hints": "Describe who the target audience appears to be"
}}"""


CHAIN2A_SYS = "You are a marketing strategist. You create actionable tasks and creative campaign ideas. Respond with valid JSON only."

CHAIN2A_USR = """Create marketing tasks and campaign ideas for {company_name}, a {niche} {client_type}.

Target audience: {target_audience}
Key insights: {summary}
Main topics: {topics}
Context: {extra_context}

Generate a JSON response with REAL, SPECIFIC marketing tasks and ideas:
{{
  "tasks": [
    "Write a specific actionable marketing task",
    "Write another specific task",
    "Write another specific task",
    "Write another specific task"
  ],
  "marketing_ideas": [
    "Write a detailed creative campaign idea",
    "Write another creative campaign idea",
    "Write another creative campaign idea"
  ],
  "assumptions": [
    "Write an assumption about this brand",
    "Write another assumption",
    "Write another assumption"
  ]
}}"""


CHAIN2B_SYS = "You are a viral content creator. You design complete social media post concepts. Respond with valid JSON only."

CHAIN2B_USR = """Create 4 complete social media post concepts for {company_name}, a {niche} {client_type}.

Target audience: {target_audience}
Campaign themes: {topics}
Context: {extra_context}

Each concept needs a unique post type (like Transformation Post, Myth Buster, Behind The Scenes, Educational Carousel, Client Spotlight, No Excuses Post, or any creative type).

Generate a JSON response with 4 REAL, CREATIVE post concepts:
{{
  "content_concepts": [
    {{
      "post_type": "Write a specific post type name",
      "title": "Write a bold headline",
      "subtitle": "Write a supporting line",
      "hook_line": "Write a scroll-stopping opening line",
      "caption": "Write a 2 sentence caption for Instagram",
      "cta": "Write a specific call to action",
      "best_platform": "Write: Instagram Reel or Carousel or LinkedIn",
      "content_format": "Write: Video or Image or Carousel"
    }},
    {{
      "post_type": "Write a DIFFERENT post type",
      "title": "Write a DIFFERENT headline",
      "subtitle": "Write a supporting line",
      "hook_line": "Write a DIFFERENT hook line",
      "caption": "Write a 2 sentence caption",
      "cta": "Write a call to action",
      "best_platform": "Choose a platform",
      "content_format": "Choose a format"
    }},
    {{
      "post_type": "Write a DIFFERENT post type",
      "title": "Write a DIFFERENT headline",
      "subtitle": "Write a supporting line",
      "hook_line": "Write a DIFFERENT hook line",
      "caption": "Write a 2 sentence caption",
      "cta": "Write a call to action",
      "best_platform": "Choose a platform",
      "content_format": "Choose a format"
    }},
    {{
      "post_type": "Write a DIFFERENT post type",
      "title": "Write a DIFFERENT headline",
      "subtitle": "Write a supporting line",
      "hook_line": "Write a DIFFERENT hook line",
      "caption": "Write a 2 sentence caption",
      "cta": "Write a call to action",
      "best_platform": "Choose a platform",
      "content_format": "Choose a format"
    }}
  ]
}}"""


CHAIN3_SYS = "You are an expert brand designer. You specify exact hex color codes and exact Google Font names. Respond with valid JSON only."

CHAIN3_USR = """Design a visual brand system for {company_name}, a {niche} {client_type}.

Target audience: {target_audience}
Content themes: {topics}
Existing brand colors from website: {existing_colors}
Existing brand fonts from website: {existing_fonts}
Has existing brand identity: {has_existing_brand}

Generate a JSON response with REAL hex codes and REAL font names:
{{
  "design_direction": "Write 2-3 sentences about the visual direction and aesthetic",
  "primary_color_hex": "#E63946",
  "primary_color_name": "Write the color name",
  "primary_color_usage": "Write where to use this color",
  "secondary_color_hex": "#1D3557",
  "secondary_color_name": "Write the color name",
  "secondary_color_usage": "Write where to use this color",
  "accent_color_hex": "#F4A261",
  "accent_color_name": "Write the color name",
  "accent_color_usage": "Write where to use this color",
  "background_color_hex": "#FFFFFF",
  "text_color_hex": "#2B2D42",
  "heading_font": "Montserrat",
  "heading_font_weight": "700 Bold",
  "heading_font_style": "Write the style like uppercase or normal",
  "heading_font_source": "Google Fonts",
  "body_font": "Open Sans",
  "body_font_weight": "400 Regular",
  "body_font_source": "Google Fonts",
  "mood": "Write 2-3 mood words",
  "photography_style": "Write the photo direction",
  "graphic_elements": "Write specific shapes and patterns",
  "layout_style": "Write the layout approach",
  "design_search_queries": ["Write search query 1", "Write search query 2", "Write search query 3", "Write search query 4"],
  "reference_accounts": ["Write @account1 and why", "Write @account2 and why", "Write @account3 and why"]
}}"""


CHAIN4_SYS = "You ask strategic marketing questions. Respond with valid JSON only."

CHAIN4_USR = """Generate 3 follow-up questions for {company_name}, a {niche} {client_type}.

Key insights: {summary}
Topics discussed: {topics}

Generate a JSON response with REAL, SPECIFIC questions:
{{
  "follow_up_questions": [
    {{
      "question": "Write a specific question about their marketing goals",
      "why": "Write why this matters for the strategy",
      "options": ["Write a possible answer", "Write another answer", "Write another answer"]
    }},
    {{
      "question": "Write a different question about their audience or content",
      "why": "Write why this matters",
      "options": ["Write a possible answer", "Write another answer", "Write another answer"]
    }},
    {{
      "question": "Write a different question about budget, timeline, or channels",
      "why": "Write why this matters",
      "options": ["Write a possible answer", "Write another answer", "Write another answer"]
    }}
  ]
}}"""


# ═══════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════

def _restructure_design(d):
    cp = {}
    for role in ["primary","secondary","accent"]:
        h = d.get(f"{role}_color_hex","")
        if h and h != "#hex":
            cp[role] = {"hex":h, "name":d.get(f"{role}_color_name",""), "usage":d.get(f"{role}_color_usage","")}
    bg = d.get("background_color_hex","")
    if bg and bg != "#hex": cp["background"] = {"hex":bg,"name":"Background","usage":"backgrounds"}
    txt = d.get("text_color_hex","")
    if txt and txt != "#hex": cp["text"] = {"hex":txt,"name":"Text","usage":"body text"}
    typo = {}
    if d.get("heading_font") and d["heading_font"] != "font name":
        typo["heading_font"] = {"name":d["heading_font"],"weight":d.get("heading_font_weight","700"),"style":d.get("heading_font_style","normal"),"source":d.get("heading_font_source","Google Fonts")}
    if d.get("body_font") and d["body_font"] != "font name":
        typo["body_font"] = {"name":d["body_font"],"weight":d.get("body_font_weight","400"),"style":"normal","source":d.get("body_font_source","Google Fonts")}
    vs = {}
    for k in ["mood","photography_style","graphic_elements","layout_style"]:
        if d.get(k): vs[k] = d[k]
    return {
        "design_direction": d.get("design_direction",""),
        "color_palette": cp, "typography": typo, "visual_style": vs,
        "design_search_queries": d.get("design_search_queries",[]),
        "reference_accounts": d.get("reference_accounts",[]),
    }

def ensure_list(val):
    if isinstance(val, list): return val
    if isinstance(val, str): return [val] if val else []
    return []


# ═══════════════════════════════════════════════════════════════════
#  MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════

def analyze_transcript(
    transcript, model=None, company_name="", niche="", target_audience="",
    website_data=None, extra_context="", client_type="company",
):
    if not transcript or not transcript.strip():
        raise ValueError("Transcript is empty")

    website_data = website_data or {}
    ct_label = "influencer" if client_type == "influencer" else "brand"
    ct_extra = "Focus on personal branding, Reels, collabs, storytelling." if client_type == "influencer" else "Focus on business growth and brand positioning."
    full_ctx = f"{ct_extra} {extra_context}".strip()
    co = company_name or "this brand"
    ni = niche or "general"
    ta = target_audience or "general audience"
    trunc = transcript.strip()[:2000]

    # Chain 1
    logger.info("Chain 1/5: Summary")
    chain1 = {}
    try:
        chain1 = _call_groq(CHAIN1_SYS, CHAIN1_USR.format(
            transcript=trunc, company_name=co, niche=ni, client_type=ct_label, extra_context=full_ctx))
    except Exception as e:
        logger.error(f"Chain 1: {e}")
        chain1 = {"clean_transcript": transcript[:500], "summary": ["Analysis pending"], "detected_topics": [ni], "target_audience_hints": ta}

    summary = ensure_list(chain1.get("summary"))
    topics = ensure_list(chain1.get("detected_topics"))
    eff_aud = target_audience or chain1.get("target_audience_hints", "") or ta

    # Chain 2A
    logger.info("Chain 2/5: Tasks")
    chain2a = {}
    try:
        chain2a = _call_groq(CHAIN2A_SYS, CHAIN2A_USR.format(
            company_name=co, niche=ni, client_type=ct_label, target_audience=eff_aud,
            summary=_summary_str(summary), topics=_topics_str(topics), extra_context=full_ctx))
    except Exception as e:
        logger.error(f"Chain 2A: {e}")
        chain2a = {"tasks": ["Try regenerating"], "marketing_ideas": [], "assumptions": []}

    # Chain 2B
    logger.info("Chain 3/5: Content")
    chain2b = {}
    try:
        chain2b = _call_groq(CHAIN2B_SYS, CHAIN2B_USR.format(
            company_name=co, niche=ni, client_type=ct_label, target_audience=eff_aud,
            topics=_topics_str(topics), extra_context=full_ctx))
    except Exception as e:
        logger.error(f"Chain 2B: {e}")
        chain2b = {"content_concepts": []}

    # Chain 3
    logger.info("Chain 4/5: Design")
    design_data = {}
    try:
        raw3 = _call_groq(CHAIN3_SYS, CHAIN3_USR.format(
            company_name=co, niche=ni, client_type=ct_label, target_audience=eff_aud,
            topics=_topics_str(topics),
            existing_colors=", ".join(website_data.get("colors",[])) or "none found",
            existing_fonts=", ".join(website_data.get("fonts",[])) or "none found",
            has_existing_brand="Yes" if website_data.get("has_content") else "No"))
        design_data = _restructure_design(raw3)
    except Exception as e:
        logger.error(f"Chain 3: {e}")
        design_data = {"design_direction":"Try regenerating","color_palette":{},"typography":{},"visual_style":{},"design_search_queries":[f"{ni} social media design"],"reference_accounts":[]}

    # Chain 4
    logger.info("Chain 5/5: Follow-ups")
    chain4 = {}
    try:
        chain4 = _call_groq(CHAIN4_SYS, CHAIN4_USR.format(
            company_name=co, niche=ni, client_type=ct_label,
            summary=_summary_str(summary), topics=_topics_str(topics)))
    except Exception as e:
        logger.error(f"Chain 4: {e}")
        chain4 = {"follow_up_questions": []}

    result = {
        "clean_transcript": chain1.get("clean_transcript", transcript[:500]),
        "summary": summary, "detected_topics": topics,
        "tasks": ensure_list(chain2a.get("tasks")),
        "marketing_ideas": ensure_list(chain2a.get("marketing_ideas")),
        "content_concepts": ensure_list(chain2b.get("content_concepts")),
        "assumptions": ensure_list(chain2a.get("assumptions")),
        **design_data,
        "follow_up_questions": ensure_list(chain4.get("follow_up_questions")),
        "website_data": {"scraped": bool(website_data.get("success")), "has_content": bool(website_data.get("has_content")),
                         "colors_found": website_data.get("colors",[]), "fonts_found": website_data.get("fonts",[])},
    }
    logger.info("Pipeline complete")
    return result
