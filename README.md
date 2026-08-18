# Remove Background Service

This repository runs a FastAPI background removal service with BiRefNet. Require maximum python version 3.12, any newer version will not work.

## Structure

- `server/server.py`: FastAPI app entry point
- `server/Dockerfile`: service image
- `server/docker-compose.yml`: opens port `8010` for host access
- `server/.env.example`: sample environment variables

## Run with Docker Compose

```bash
cp server/.env.example server/.env
docker compose -f server/docker-compose.yml up -d --build
```

The service will be exposed on host port `8010`. If the backend runs on another host, make sure inbound port `8010` is accessible in your firewall/security group.

## BiRefNet environment variables

```dotenv
BIREFNET_DEVICE=
BIREFNET_USE_HALF=false
BIREFNET_PRESERVE_ASPECT_RATIO=true
BIREFNET_PAD_COLOR=123,116,103
BIREFNET_TIMEOUT_SECONDS=120
BIREFNET_ACQUIRE_TIMEOUT_SECONDS=10
BIREFNET_WORKER_POOL_SIZE=1
REMOVE_BG_ALPHA_CLEANUP_ENABLED=true
REMOVE_BG_ALPHA_LOW_THRESHOLD=10
REMOVE_BG_ALPHA_HIGH_THRESHOLD=245
REMOVE_BG_ALPHA_SMOOTH_ENABLED=true
LOG_LEVEL=INFO
```

## Run fast API server without Docker

- On Windows

```bash
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
cd server
uvicorn server:server --host 0.0.0.0 --port 8010
```

- On Linux

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd server
uvicorn server:server --host 0.0.0.0 --port 8010
```

## Run webiste user interface server

```bash
cd web-ui
bun install
bun run dev
```

## Fine-tuning

The repository runs inference/deployment from this service. Training is isolated in `training/`.

Dataset structure:

```text
training
└── data/
    └── group-matting/
        ├── train/
        │   ├── images/*.jpg
        │   └── masks/*.png
        │
        └── val/
            ├── images/*.jpg
            └── masks/*.png
```

Image and mask names must match, for example `group-001.jpg` and `group-001.png`.

Validate dataset:

```bash
python training/audit_dataset.py training/data/group-matting
```

Run fine-tuning:

- On linux

```bash
bash scripts/run-finetune.sh
```

- On windows

```bash
scripts\run-finetune.bat
```

Best checkpoint is stored at `training/runs/group-matting/best`.
To deploy this checkpoint in Docker Compose or local machine, set:

```dotenv
BIREFNET_MODEL_ID=/training/runs/group-matting/best
```

## On linux - If fast API server is terminated but encounter error "Address already in use", run these commands:

```bash
sudo ss -ltnp 'sport = :8010'
kill -9 pid
```
