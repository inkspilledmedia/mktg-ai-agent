"""
AI Marketing Agent — Cloud Backend (Groq API)
"""

import os
import uuid
import json
import logging
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from transcription import transcribe_audio
from analysis import (
    analyze_transcript, _call_groq, _restructure_design, _topics_str, _summary_str,
    CHAIN2B_SYS, CHAIN2B_USR, CHAIN3_SYS, CHAIN3_USR,
)
from scraper import scrape_website

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-18s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ai-agent")

app = FastAPI(title="AI Marketing Agent", version="3.0.0")

# Allow Vercel frontend domain + localhost for dev
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
]

# Add Vercel domain from env if set
VERCEL_URL = os.environ.get("FRONTEND_URL", "")
if VERCEL_URL:
    ALLOWED_ORIGINS.append(VERCEL_URL)
# Also allow all vercel.app subdomains
ALLOWED_ORIGINS.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Will restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB (Groq Whisper limit)

sessions: dict = {}


@app.get("/")
async def health():
    return {"status": "healthy", "version": "3.0.0", "engine": "groq"}


@app.get("/sessions")
async def list_sessions():
    items = []
    for sid, data in sessions.items():
        items.append({
            "id": sid,
            "company_name": data.get("company_name", "Untitled"),
            "niche": data.get("niche", ""),
            "created_at": data.get("created_at", ""),
            "summary_preview": (data.get("result", {}).get("summary", [""]) or [""])[0][:80] if isinstance(data.get("result", {}).get("summary", [""]), list) else "",
        })
    return sorted(items, key=lambda x: x["created_at"], reverse=True)


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "Session not found")
    return sessions[session_id]


@app.post("/process-audio/")
async def process_audio(
    file: UploadFile = File(...),
    client_type: str = Form("company"),
    company_name: str = Form(""),
    niche: str = Form(""),
    target_audience: str = Form(""),
    website_url: str = Form(""),
    instagram_url: str = Form(""),
    extra_context: str = Form(""),
):
    start_time = time.time()

    if not file.filename:
        raise HTTPException(400, "No file provided")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported type: {ext}")

    file_id = uuid.uuid4().hex[:12]
    save_path = UPLOAD_DIR / f"{file_id}{ext}"
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(400, "File is empty")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File exceeds 25 MB Groq limit. Compress or shorten the recording.")
    with open(save_path, "wb") as f:
        f.write(content)

    try:
        transcription = transcribe_audio(str(save_path))
        transcript_text = transcription["text"]
        if not transcript_text.strip():
            raise ValueError("Empty transcript")
    except Exception as e:
        raise HTTPException(422, f"Transcription failed: {e}")

    website_data = {}
    if website_url:
        website_data = scrape_website(website_url)

    client_label = "influencer/creator" if client_type == "influencer" else "company/brand"
    enriched_context = f"Client type: {client_label}."
    if instagram_url:
        enriched_context += f" Instagram: {instagram_url}."
    if extra_context:
        enriched_context += f" {extra_context}"

    try:
        result = analyze_transcript(
            transcript=transcript_text, company_name=company_name, niche=niche,
            target_audience=target_audience, website_data=website_data,
            extra_context=enriched_context, client_type=client_type)
    except (ValueError, ConnectionError) as e:
        raise HTTPException(422, str(e))

    elapsed = round(time.time() - start_time, 2)
    result["metadata"] = {
        "file_name": file.filename, "file_size_kb": round(len(content)/1024, 1),
        "processing_time_seconds": elapsed, "language": transcription["language"],
        "engine": "groq", "transcript_length": len(transcript_text),
        "segments_count": len(transcription["segments"]),
    }

    session_id = uuid.uuid4().hex[:16]
    sessions[session_id] = {
        "id": session_id, "company_name": company_name or "Untitled", "niche": niche,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "input_type": "audio",
        "transcript": transcript_text, "result": result,
        "context": {"company_name": company_name, "niche": niche, "target_audience": target_audience,
                     "website_url": website_url, "extra_context": extra_context, "client_type": client_type},
    }
    result["session_id"] = session_id

    try: os.remove(save_path)
    except: pass
    return JSONResponse(content=result)


@app.post("/process-text/")
async def process_text(payload: dict):
    start_time = time.time()
    transcript = payload.get("transcript", "").strip()
    if not transcript:
        raise HTTPException(400, "No text provided")

    company_name = payload.get("company_name", "")
    niche = payload.get("niche", "")
    target_audience = payload.get("target_audience", "")
    website_url = payload.get("website_url", "")
    extra_context = payload.get("extra_context", "")
    client_type = payload.get("client_type", "company")
    instagram_url = payload.get("instagram_url", "")

    client_label = "influencer/creator" if client_type == "influencer" else "company/brand"
    enriched_context = f"Client type: {client_label}."
    if instagram_url:
        enriched_context += f" Instagram: {instagram_url}."
    if extra_context:
        enriched_context += f" {extra_context}"

    website_data = {}
    if website_url:
        website_data = scrape_website(website_url)

    try:
        result = analyze_transcript(
            transcript=transcript, company_name=company_name, niche=niche,
            target_audience=target_audience, website_data=website_data,
            extra_context=enriched_context, client_type=client_type)
    except (ValueError, ConnectionError) as e:
        raise HTTPException(422, str(e))

    elapsed = round(time.time() - start_time, 2)
    result["metadata"] = {"input_type": "text", "processing_time_seconds": elapsed, "engine": "groq", "transcript_length": len(transcript)}

    session_id = uuid.uuid4().hex[:16]
    sessions[session_id] = {
        "id": session_id, "company_name": company_name or "Untitled", "niche": niche,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "input_type": "text",
        "transcript": transcript, "result": result,
        "context": {"company_name": company_name, "niche": niche, "target_audience": target_audience,
                     "website_url": website_url, "extra_context": extra_context, "client_type": client_type},
    }
    result["session_id"] = session_id
    return JSONResponse(content=result)


@app.post("/regenerate/")
async def regenerate(payload: dict):
    session_id = payload.get("session_id")
    section = payload.get("section")

    if not session_id or session_id not in sessions:
        raise HTTPException(404, "Session not found")
    if section not in ("design", "content"):
        raise HTTPException(400, "Section must be 'design' or 'content'")

    session = sessions[session_id]
    ctx = session["context"]
    result = session["result"]

    extra = payload.get("extra_context", "")
    if extra:
        ctx["extra_context"] = (ctx.get("extra_context", "") + " " + extra).strip()

    topics_text = _topics_str(result.get("detected_topics", []))
    ct_label = "influencer" if ctx.get("client_type") == "influencer" else "brand"
    co = ctx.get("company_name") or "this brand"
    ni = ctx.get("niche") or "general"
    ta = ctx.get("target_audience") or "general audience"
    full_ctx = ctx.get("extra_context") or ""

    try:
        if section == "content":
            new_data = _call_groq(CHAIN2B_SYS, CHAIN2B_USR.format(
                company_name=co, niche=ni, client_type=ct_label,
                target_audience=ta, topics=topics_text, extra_context=full_ctx))
        elif section == "design":
            raw = _call_groq(CHAIN3_SYS, CHAIN3_USR.format(
                company_name=co, niche=ni, client_type=ct_label,
                target_audience=ta, topics=topics_text,
                existing_colors=", ".join(result.get("website_data",{}).get("colors_found",[])) or "none",
                existing_fonts=", ".join(result.get("website_data",{}).get("fonts_found",[])) or "none",
                has_existing_brand="Yes" if result.get("website_data",{}).get("has_content") else "No"))
            new_data = _restructure_design(raw)
    except Exception as e:
        logger.error(f"Regeneration failed: {e}")
        raise HTTPException(422, str(e))

    if section == "design":
        for key in ["design_direction","color_palette","typography","visual_style","design_search_queries","reference_accounts"]:
            if key in new_data: result[key] = new_data[key]
    elif section == "content":
        for key in ["tasks","marketing_ideas","content_concepts","assumptions"]:
            if key in new_data: result[key] = new_data[key]

    sessions[session_id]["result"] = result
    return JSONResponse(content=new_data)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
