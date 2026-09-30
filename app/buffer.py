"""Buffer circular de vídeo via FFmpeg (segmentos) + corte dos últimos N segundos."""

from __future__ import annotations

import logging
import shutil
import subprocess
import time
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)
LOGO_PATH = Path(__file__).resolve().parent / "static" / "logo-watermark.png"


def _probe_duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        value = float(result.stdout.strip())
    except ValueError:
        return 0.0
    if value <= 0 or value > 3600:
        return 0.0
    return value


def _has_audio(path: Path) -> bool:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return bool(result.stdout.strip())


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
        segs = self._segments_newest_first()
        if not segs:
            raise RuntimeError("Buffer vazio — aguarde alguns segundos com a câmera ligada")

        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out = self.clips_dir / f"clip_{stamp}.mp4"
        work = self.clips_dir / f"parts_{stamp}"
        work.mkdir(parents=True, exist_ok=True)
        list_file = work / "list.txt"

        try:
            # Copia agora o pedaço que ainda está sendo gravado.
            # Assim o lance termina no clique, sem os 2 segundos seguintes.
            tail = work / segs[0].name
            tail.write_bytes(segs[0].read_bytes())
            if tail.stat().st_size < 1000 and len(segs) > 1:
                tail.unlink()
                tail = segs[1]
                older = segs[2:]
            else:
                older = segs[1:]

            tail_duration = _probe_duration(tail)
            covered = tail_duration
            chosen: list[Path] = []
            for seg in older:
                if covered >= seconds:
                    break
                chosen.append(seg)
                covered += _probe_duration(seg) or float(self.segment_seconds)
            # Sem duração do pedaço aberto, não corta o fim: o fim é o clique.
            if tail_duration <= 0:
                trim_start = 0.0
                trim_duration = max(seconds, int(covered) + self.segment_seconds)
            else:
                trim_start = max(0.0, covered - float(seconds))
                trim_duration = seconds

            ordered = list(reversed(chosen)) + [tail]
            list_file.write_text(
                "".join(f"file '{s.resolve()}'\n" for s in ordered),
                encoding="utf-8",
            )
            video_trim = (
                f"trim=start={trim_start:.3f}:duration={trim_duration},"
                "setpts=PTS-STARTPTS"
            )
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
            ]
            if LOGO_PATH.is_file():
                cmd += ["-i", str(LOGO_PATH)]
                filters = [
                    f"[0:v]{video_trim}[src]",
                    "[1:v]scale=-1:168,format=rgba,colorchannelmixer=rr=0:gg=0:bb=0:aa=0.55[sh]",
                    "[1:v]scale=-1:168[wm]",
                    "[src][sh]overlay=28:28[base]",
                    "[base][wm]overlay=24:24:format=auto[v]",
                ]
            else:
                filters = [f"[0:v]{video_trim}[v]"]
            maps = ["-map", "[v]"]
            if _has_audio(ordered[0]):
                audio_trim = (
                    f"atrim=start={trim_start:.3f}:duration={trim_duration},"
                    "asetpts=PTS-STARTPTS"
                )
                filters.append(f"[0:a]{audio_trim}[a]")
                maps += ["-map", "[a]"]
            cmd += [
                "-filter_complex",
                ";".join(filters),
                *maps,
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
            shutil.rmtree(work, ignore_errors=True)

        if not out.exists() or out.stat().st_size < 1000:
            raise RuntimeError("Falha ao gerar o clip")

        logger.info("Clip salvo: %s (%s bytes)", out.name, out.stat().st_size)
        return out
