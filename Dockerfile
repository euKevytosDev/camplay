FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN mkdir -p /app/buffer /app/clips

ENV HOST=0.0.0.0
ENV PORT=8000
ENV BUFFER_SECONDS=120
ENV CLIP_SECONDS=30
ENV SEGMENT_SECONDS=2

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
