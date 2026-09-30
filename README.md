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

## Deploy no Coolify (projeto Kevin 3)

O app sobe com o `Dockerfile` desta pasta. No Coolify:

1. Criar um **projeto novo** chamado `Kevin 3` (separado dos outros).
2. Adicionar um recurso **Application** apontando para este repositório, ou colar o Dockerfile.
3. Porta do container: `8000`.
4. Variável de ambiente `CAMERA_RTSP` com a URL da câmera.
5. Volume persistente em `/app/clips` (e `/app/buffer`, se quiser).

O health check é `GET /health`.

A câmera em `192.168.x.x` só é vista na rede da quadra. O servidor na nuvem só recebe o vídeo quando existir um túnel (Tailscale, Cloudflare ou similar) entre a quadra e a VPS, ou quando o stream for enviado para um endereço público.

## Próximos passos

- [ ] Plaquinha WT32 chama `POST /clip` na rede
- [ ] Página com um card por aperto (dois vídeos juntos)
- [ ] Túnel da quadra até o Coolify
- [ ] Multi-câmera por quadra
