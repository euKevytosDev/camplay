"""API Camplay — buffer RTSP + endpoint do botão (/clip)."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.buffer import VideoBuffer

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("camplay")

ROOT = Path(__file__).resolve().parent.parent
BUFFER_DIR = ROOT / "buffer"
CLIPS_DIR = ROOT / "clips"

RTSP = os.getenv("CAMERA_RTSP", "")
BUFFER_SECONDS = int(os.getenv("BUFFER_SECONDS", "120"))
CLIP_SECONDS = int(os.getenv("CLIP_SECONDS", "30"))
SEGMENT_SECONDS = int(os.getenv("SEGMENT_SECONDS", "2"))

video_buffer = VideoBuffer(
    rtsp_url=RTSP,
    buffer_dir=BUFFER_DIR,
    clips_dir=CLIPS_DIR,
    buffer_seconds=BUFFER_SECONDS,
    clip_seconds=CLIP_SECONDS,
    segment_seconds=SEGMENT_SECONDS,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not RTSP:
        logger.error("CAMERA_RTSP não configurada no .env")
    else:
        try:
            video_buffer.start()
            logger.info("Buffer ativo (%ss, clip %ss)", BUFFER_SECONDS, CLIP_SECONDS)
        except Exception:
            logger.exception("Não foi possível iniciar o buffer")
    yield
    video_buffer.stop()


app = FastAPI(title="Camplay", version="0.1.0", lifespan=lifespan)
CLIPS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=str(CLIPS_DIR)), name="files")


@app.get("/health")
def health():
    segs = list(BUFFER_DIR.glob("seg_*.ts"))
    return {
        "ok": True,
        "buffer_running": video_buffer.running,
        "segments": len(segs),
        "buffer_seconds": BUFFER_SECONDS,
        "clip_seconds": CLIP_SECONDS,
    }


@app.post("/clip")
def create_clip():
    """Chamado pela plaquinha quando o botão é apertado."""
    if not video_buffer.running:
        raise HTTPException(503, "Buffer não está rodando")
    try:
        path = video_buffer.save_clip()
    except Exception as exc:
        logger.exception("Erro ao criar clip")
        raise HTTPException(500, str(exc)) from exc

    return {
        "ok": True,
        "file": path.name,
        "url": f"/files/{path.name}",
        "download": f"/download/{path.name}",
    }


@app.get("/download/{name}")
def download_clip(name: str):
    path = CLIPS_DIR / name
    if not path.exists() or ".." in name or "/" in name:
        raise HTTPException(404, "Clip não encontrado")
    return FileResponse(path, media_type="video/mp4", filename=name)
