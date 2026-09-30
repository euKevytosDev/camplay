# CliquePlay

Site para ver e baixar o replay da quadra. A câmera manda o vídeo, o botão pede os últimos 30s e o card aparece no celular.

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

- Site: http://127.0.0.1:8000/
- Saúde: http://127.0.0.1:8000/health
- Simular botão: `curl -X POST http://127.0.0.1:8000/clip`
- Download: use a URL retornada em `download`

## URL RTSP Intelbras (exemplo)

```
rtsp://USUARIO:SENHA@IP:554/cam/realmonitor?channel=1&subtype=0
```

`subtype=0` = stream principal (alta qualidade).

## Deploy no Coolify

O app sobe com o `Dockerfile` desta pasta. O site e a API ficam no mesmo serviço.

1. Porta do container: `8000`.
2. `CAMERA_RTSP` só quando a câmera for alcançável pela VPS.
3. Volumes persistentes em `/app/clips`, `/app/data` e, se quiser, `/app/buffer`.

O health check é `GET /health`. O site abre em `/`.

A câmera em `192.168.x.x` só é vista na rede da quadra. O servidor na nuvem só recebe o vídeo quando existir um túnel (Tailscale, Cloudflare ou similar) entre a quadra e a VPS, ou quando o stream for enviado para um endereço público.

## Próximos passos

- [x] Página mobile: quadras, card do lance, download sem conta
- [x] Conta opcional, favoritos e pedido de vídeo reservado
- [ ] Plaquinha WT32 chama `POST /clip` na rede
- [ ] Pagamento do lance reservado direto para o dono da quadra
- [ ] Túnel da quadra até o Coolify
- [ ] Segundo ângulo no mesmo card
- [ ] Apontar cliqueplay.com.br para este serviço
