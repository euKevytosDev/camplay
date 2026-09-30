"""Buffer circular de vídeo via FFmpeg (segmentos) + corte dos últimos N segundos."""

from __future__ import annotations

import logging
import shutil
import subprocess
import time
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class VideoBuffer:
    def __init__(
        self,
        rtsp_url: str,
        buffer_dir: Path,
        clips_dir: Path,
        buffer_seconds: int = 120,
        clip_seconds: int = 30,
        segment_seconds: int = 2,
    ) -> None:
        self.rtsp_url = rtsp_url
        self.buffer_dir = buffer_dir
        self.clips_dir = clips_dir
        self.buffer_seconds = buffer_seconds
        self.clip_seconds = clip_seconds
        self.segment_seconds = segment_seconds
        self._proc: subprocess.Popen[str] | None = None

        self.buffer_dir.mkdir(parents=True, exist_ok=True)
        self.clips_dir.mkdir(parents=True, exist_ok=True)

    @property
    def running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def start(self) -> None:
        if self.running:
            return

        # Limpa segmentos antigos ao iniciar
        for old in self.buffer_dir.glob("seg_*.ts"):
            old.unlink(missing_ok=True)

        pattern = str(self.buffer_dir / "seg_%Y%m%d_%H%M%S.ts")
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "warning",
            "-rtsp_transport",
            "tcp",
            "-i",
            self.rtsp_url,
            "-c",
            "copy",
            "-f",
            "segment",
            "-segment_time",
            str(self.segment_seconds),
            "-segment_atclocktime",
            "0",
            "-reset_timestamps",
            "1",
            "-strftime",
            "1",
            pattern,
        ]
        logger.info("Iniciando buffer FFmpeg…")
        self._proc = subprocess.Popen(cmd)
        # Espera primeiros segmentos
        deadline = time.time() + 15
        while time.time() < deadline:
            if list(self.buffer_dir.glob("seg_*.ts")):
                break
            if self._proc.poll() is not None:
                raise RuntimeError("FFmpeg encerrou ao iniciar o buffer")
            time.sleep(0.5)

    def stop(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        self._proc = None

    def _segments_newest_first(self) -> list[Path]:
        segs = sorted(self.buffer_dir.glob("seg_*.ts"), key=lambda p: p.name, reverse=True)
        # Remove segmentos além da janela do buffer
        max_files = max(1, (self.buffer_seconds // self.segment_seconds) + 3)
        keep = segs[:max_files]
        for stale in segs[max_files:]:
            stale.unlink(missing_ok=True)
        return keep

    def save_clip(self, seconds: int | None = None) -> Path:
        seconds = seconds or self.clip_seconds
        needed = max(1, (seconds // self.segment_seconds) + 1)
        segs = self._segments_newest_first()
        if not segs:
            raise RuntimeError("Buffer vazio — aguarde alguns segundos com a câmera ligada")

        selected = list(reversed(segs[:needed]))
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out = self.clips_dir / f"clip_{stamp}.mp4"
        list_file = self.clips_dir / f"concat_{stamp}.txt"

        list_file.write_text(
            "".join(f"file '{s.resolve()}'\n" for s in selected),
            encoding="utf-8",
        )
        try:
            cmd = [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-map",
                "0:v:0",
                "-map",
                "0:a:0?",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "23",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-movflags",
                "+faststart",
                str(out),
            ]
            subprocess.run(cmd, check=True)
            poster = out.with_suffix(".jpg")
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-ss",
                    "0.4",
                    "-i",
                    str(out),
                    "-frames:v",
                    "1",
                    "-q:v",
                    "3",
                    str(poster),
                ],
                check=False,
            )
        finally:
            list_file.unlink(missing_ok=True)

        if not out.exists() or out.stat().st_size < 1000:
            raise RuntimeError("Falha ao gerar o clip")

        logger.info("Clip salvo: %s (%s bytes)", out.name, out.stat().st_size)
        return out
