# Camplay

Sistema de replay de jogadas: câmera IP → buffer no servidor → botão salva os últimos 30s → download/QR.

## O que já funciona (MVP local)

1. Câmera Intelbras VIPC via **RTSP**
2. Buffer contínuo (~2 min) em segmentos
3. `POST /clip` gera MP4 dos últimos ~30s (simula o botão)

## Requisitos

- Python 3.11+
- [FFmpeg](https://ffmpeg.org/) instalado (`ffmpeg` no PATH)

## Setup

```bash
cd camplay
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edite CAMERA_RTSP
```

## Rodar

```bash
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

- Saúde: http://127.0.0.1:8000/health  
- Simular botão: `curl -X POST http://127.0.0.1:8000/clip`  
- Download: use a URL retornada em `download`

## URL RTSP Intelbras (exemplo)

```
rtsp://USUARIO:SENHA@IP:554/cam/realmonitor?channel=1&subtype=0
```

`subtype=0` = stream principal (alta qualidade).

## Próximos passos

- [ ] Plaquinha WT32 chama `POST /clip` na rede
- [ ] Upload + página com QR
- [ ] Deploy no Coolify (IP real da VPS)
- [ ] Multi-câmera por quadra
