FROM python:3.12-slim-bullseye

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install --no-install-recommends -y curl libgomp1 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt

RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY server ./server

EXPOSE 8010

WORKDIR /app/server

CMD ["uvicorn", "server:server", "--host", "0.0.0.0", "--port", "8010"]
