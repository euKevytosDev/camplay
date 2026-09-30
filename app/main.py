"""CliquePlay — site das quadras + buffer RTSP + botão (/clip)."""

from __future__ import annotations

import json
import logging
import os
import secrets
import subprocess
import urllib.error
import urllib.request
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.buffer import VideoBuffer
from app import store

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("camplay")

ROOT = Path(__file__).resolve().parent.parent
BUFFER_DIR = ROOT / "buffer"
CLIPS_DIR = ROOT / "clips"
STATIC_DIR = Path(__file__).resolve().parent / "static"
SESSION_COOKIE = "cliqueplay_session"

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
    store.init_db()
    if not RTSP:
        logger.info("CAMERA_RTSP vazia — site no ar, buffer da câmera desligado")
    else:
        try:
            video_buffer.start()
            logger.info("Buffer ativo (%ss, clip %ss)", BUFFER_SECONDS, CLIP_SECONDS)
        except Exception:
            logger.exception("Não foi possível iniciar o buffer")
    yield
    video_buffer.stop()


app = FastAPI(title="CliquePlay", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://eukevytosdev.github.io"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
CLIPS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


def _current_user(request: Request) -> dict | None:
    return store.user_from_token(request.cookies.get(SESSION_COOKIE))


def _require_user(request: Request) -> dict:
    user = _current_user(request)
    if user is None:
        raise HTTPException(401, "Entre na sua conta para continuar.")
    return user


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


@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})


@app.get("/api/courts")
def api_courts(request: Request):
    user = _current_user(request)
    return store.list_courts(user["id"] if user else None)


@app.get("/api/courts/{slug}")
def api_court(slug: str, request: Request):
    user = _current_user(request)
    court = store.get_court(slug, user["id"] if user else None)
    if court is None:
        raise HTTPException(404, "Quadra não encontrada.")
    return court


@app.get("/api/courts/{slug}/quadras/{quadra_slug}")
def api_quadra(slug: str, quadra_slug: str):
    found = store.get_quadra(slug, quadra_slug)
    if found is None:
        raise HTTPException(404, "Quadra não encontrada.")
    return found


@app.post("/api/conta")
def api_signup(body: dict):
    try:
        user = store.register_user(body.get("name", ""), body.get("email", ""), body.get("password", ""))
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"user": user}


@app.post("/api/entrar")
def api_login(body: dict):
    try:
        user, token = store.login_user(body.get("email", ""), body.get("password", ""))
    except ValueError as exc:
        raise HTTPException(401, str(exc)) from exc
    response = JSONResponse({"user": user})
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30, path="/")
    return response


@app.post("/api/sair")
def api_logout(request: Request):
    store.logout_token(request.cookies.get(SESSION_COOKIE, ""))
    response = JSONResponse({"ok": True})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@app.get("/api/me")
def api_me(request: Request):
    return {"user": _current_user(request)}


@app.get("/api/me/favoritos")
def api_favorites(request: Request):
    user = _require_user(request)
    return store.list_favorites(user["id"])


@app.get("/api/me/pedidos")
def api_purchases(request: Request):
    user = _require_user(request)
    return store.list_purchases(user["id"])


@app.post("/api/courts/{slug}/favorito")
def api_favorite_on(slug: str, request: Request):
    user = _require_user(request)
    try:
        return store.set_favorite(user["id"], slug, True)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.delete("/api/courts/{slug}/favorito")
def api_favorite_off(slug: str, request: Request):
    user = _require_user(request)
    try:
        return store.set_favorite(user["id"], slug, False)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/api/replays/{replay_id}/pedido")
def api_purchase(replay_id: int, request: Request):
    user = _require_user(request)
    try:
        return store.request_purchase(user["id"], replay_id)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/replays/{replay_id}/arquivo/{angle}")
def api_replay_file(replay_id: int, angle: str, download: int = 0):
    found = store.replay_file(replay_id, angle)
    if found is None:
        raise HTTPException(404, "Vídeo não encontrado.")
    name, locked = found
    if locked:
        raise HTTPException(403, "Este lance está reservado pela quadra.")
    path = CLIPS_DIR / name
    if not path.is_file():
        raise HTTPException(404, "Arquivo do vídeo não está no servidor.")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=name if download else None,
        content_disposition_type="attachment" if download else "inline",
    )


@app.get("/api/replays/{replay_id}/capa")
def api_replay_poster(replay_id: int):
    found = store.replay_file(replay_id, "frente")
    if found is None:
        raise HTTPException(404, "Capa não encontrada.")
    name, locked = found
    if locked:
        raise HTTPException(403, "Este lance está reservado pela quadra.")
    poster = CLIPS_DIR / f"{Path(name).stem}.jpg"
    if not poster.is_file():
        raise HTTPException(404, "Capa não encontrada.")
    return FileResponse(poster, media_type="image/jpeg")


def _upload_token() -> str:
    return os.getenv("UPLOAD_TOKEN", "").strip()


def _save_poster(video_path: Path) -> None:
    poster = video_path.with_suffix(".jpg")
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", "0.4", "-i", str(video_path),
            "-frames:v", "1", "-q:v", "3", str(poster),
        ],
        check=False,
    )


def _publish_clip(path: Path) -> dict | None:
    url = os.getenv("UPLOAD_URL", "").strip()
    token = _upload_token()
    if not url or not token:
        return None
    request = urllib.request.Request(
        url,
        data=path.read_bytes(),
        headers={"X-Upload-Token": token, "Content-Type": "video/mp4"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        logger.error("Falha ao enviar o lance ao servidor: %s %s", exc.code, detail)
        return {"ok": False, "error": detail or str(exc.code)}
    except Exception as exc:
        logger.exception("Falha ao enviar o lance ao servidor")
        return {"ok": False, "error": str(exc)}


@app.post("/api/lances")
async def receive_lance(request: Request):
    """Recebe o vídeo gravado na quadra e publica no site."""
    expected = _upload_token()
    sent = request.headers.get("x-upload-token", "")
    if not expected or not secrets.compare_digest(sent, expected):
        raise HTTPException(401, "Envio não autorizado.")
    payload = await request.body()
    if len(payload) < 1000 or len(payload) > 80 * 1024 * 1024:
        raise HTTPException(400, "Vídeo inválido.")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = CLIPS_DIR / f"clip_{stamp}.mp4"
    path.write_bytes(payload)
    _save_poster(path)
    replay = store.add_replay(path.name)
    logger.info("Lance recebido: %s", path.name)
    return {
        "ok": True,
        "file": path.name,
        "replay_id": replay["id"],
        "court_slug": replay["court_slug"],
        "page": f"/#quadra/{replay['court_slug']}/quadra-teste-1",
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

    replay = store.add_replay(path.name)
    published = _publish_clip(path)
    return {
        "ok": True,
        "file": path.name,
        "replay_id": replay["id"],
        "court_slug": replay["court_slug"],
        "url": f"/api/replays/{replay['id']}/arquivo/frente",
        "download": f"/api/replays/{replay['id']}/arquivo/frente?download=1",
        "page": f"/#quadra/{replay['court_slug']}",
        "publicado": published,
    }


@app.get("/download/{name}")
def download_clip(name: str):
    if ".." in name or "/" in name:
        raise HTTPException(404, "Clip não encontrado")
    if store.file_is_locked(name):
        raise HTTPException(403, "Este lance está reservado pela quadra.")
    path = CLIPS_DIR / name
    if not path.is_file():
        raise HTTPException(404, "Clip não encontrado")
    return FileResponse(path, media_type="video/mp4", filename=name)
