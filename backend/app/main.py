"""FastAPI application exposing the SoftPrompt encoder, scanner and analysers."""

from __future__ import annotations

import base64
import io
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from . import analysis, reliability, stego

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

app = FastAPI(
    title="SoftPrompt API",
    description="Hidden prompt detection in images - educational defensive tooling.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _load_image(upload: UploadFile) -> tuple[Image.Image, bytes]:
    raw = await upload.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 25 MB.")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="File is not a readable image.") from exc
    return image, raw


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "softprompt", "version": app.version}


@app.post("/api/capacity")
async def capacity(image: UploadFile = File(...)) -> dict:
    img, raw = await _load_image(image)
    width, height = img.size
    total = stego.capacity_bytes(width, height)
    return {
        "width": width,
        "height": height,
        "format": img.format,
        "mode": img.mode,
        "size_bytes": len(raw),
        "capacity_bytes": total,
        "header_bytes": stego.HEADER_SIZE,
        "usable_text_bytes": max(0, total - stego.HEADER_SIZE),
        "lossless": (img.format or "").upper() in stego.LOSSLESS_FORMATS,
        "sha256": analysis.sha256_hex(raw),
    }


@app.post("/api/encode")
async def encode(
    image: UploadFile = File(...),
    message: str = Form(...),
    password: Optional[str] = Form(None),
    output_format: str = Form("PNG"),
) -> JSONResponse:
    img, raw = await _load_image(image)
    if not message:
        raise HTTPException(status_code=400, detail="Message is empty.")

    fmt = output_format.upper()
    if fmt not in {"PNG", "BMP", "TIFF"}:
        raise HTTPException(
            status_code=400,
            detail="Output format must be PNG, BMP or TIFF (lossless formats only).",
        )

    packet = stego.build_packet(message, password or None)
    try:
        encoded = stego.embed(img, packet)
    except stego.StegoError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if fmt in {"BMP", "JPEG"} and encoded.mode == "RGBA":
        encoded = encoded.convert("RGB")

    buf = io.BytesIO()
    encoded.save(buf, format=fmt)
    encoded_bytes = buf.getvalue()

    width, height = img.size
    total_capacity = stego.capacity_bytes(width, height)
    return JSONResponse(
        {
            "ok": True,
            "encoding_method": "LSB (1 bit/channel, RGB)"
            + (" + AES-256-GCM" if password else ""),
            "encrypted": bool(password),
            "message_chars": len(message),
            "packet_bytes": len(packet),
            "header_bytes": stego.HEADER_SIZE,
            "capacity_bytes": total_capacity,
            "capacity_used_percent": round(100.0 * len(packet) / total_capacity, 4)
            if total_capacity
            else 0.0,
            "psnr_db": round(analysis.psnr(img, encoded), 2)
            if analysis.psnr(img, encoded) != float("inf")
            else None,
            "original": {
                "filename": image.filename,
                "format": img.format,
                "size_bytes": len(raw),
                "sha256": analysis.sha256_hex(raw),
            },
            "encoded": {
                "filename": f"softprompt_{fmt.lower()}_{(image.filename or 'image').rsplit('.', 1)[0]}.{fmt.lower()}",
                "format": fmt,
                "size_bytes": len(encoded_bytes),
                "sha256": analysis.sha256_hex(encoded_bytes),
                "data_url": f"data:image/{fmt.lower()};base64,"
                + base64.b64encode(encoded_bytes).decode("ascii"),
            },
        }
    )


@app.post("/api/scan")
async def scan(
    image: UploadFile = File(...),
    password: Optional[str] = Form(None),
) -> dict:
    img, raw = await _load_image(image)
    result = stego.extract(img, password or None)
    width, height = img.size
    return {
        "detection": result.to_dict(),
        "image": {
            "filename": image.filename,
            "format": img.format,
            "mode": img.mode,
            "width": width,
            "height": height,
            "size_bytes": len(raw),
            "capacity_bytes": stego.capacity_bytes(width, height),
            "lossless": (img.format or "").upper() in stego.LOSSLESS_FORMATS,
        },
        "sha256": analysis.sha256_hex(raw),
        "safety_notice": (
            "Extracted text is untrusted data. SoftPrompt never executes, follows or "
            "forwards it to any AI service - it is only displayed."
        ),
    }


@app.post("/api/analyze")
async def analyze_image(image: UploadFile = File(...)) -> dict:
    img, raw = await _load_image(image)
    return analysis.analyze(img, raw, image.filename or "upload")


@app.post("/api/reliability/run")
def reliability_run(repeats: int = 1) -> dict:
    if repeats < 1 or repeats > 5:
        raise HTTPException(status_code=400, detail="repeats must be between 1 and 5.")
    return reliability.run_suite(repeats).to_dict()
