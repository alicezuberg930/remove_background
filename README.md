# Remove Background Service

This repository runs a FastAPI background-removal service with optional Triton serving for BiRefNet.

## Structure

- `server.py`: FastAPI app entry point
- `Dockerfile`: service image
- `Dockerfile.triton`: Triton Inference Server image for BiRefNet
- `docker-compose.yml`: opens port `8010` for host access
- `.env.example`: sample environment variables
- `triton-model-repository/`: Triton model repository

## Run with Docker Compose

```bash
cd remove-background-service
cp .env.example .env
docker compose up -d --build
```

The service will be exposed on host port `8010`.

By default, the compose setup runs a Triton container, and `server.py` uses Triton first, then falls back to the local worker.

## Open port for backend access

If the backend runs on another host, make sure inbound port `8010` is accessible in your firewall/security group.

For a Django backend, set:

```dotenv
REMOVE_BG_SERVICE_URL=http://YOUR_SERVER_IP:8010
REMOVE_BG_SERVICE_TIMEOUT_SECONDS=120
```

## BiRefNet + Triton environment variables

```dotenv
BIREFNET_MODEL_ID=ZhengPeng7/BiRefNet
BIREFNET_DEVICE=
BIREFNET_USE_HALF=true
BIREFNET_IMAGE_SIZE=1024
BIREFNET_TIMEOUT_SECONDS=120
BIREFNET_ACQUIRE_TIMEOUT_SECONDS=10
BIREFNET_WORKER_POOL_SIZE=1
BIREFNET_TRITON_ENABLED=true
BIREFNET_TRITON_URL=http://triton:8000
BIREFNET_TRITON_MODEL_NAME=birefnet
```

Set `BIREFNET_TRITON_ENABLED=false` to disable Triton and use the local worker only.

## Pros and cons of Triton

- Separates inference from FastAPI and improves scalability.
- Helps with model cache/warmup behavior for production.
- Keeps orchestration and fallback logic in FastAPI.

- Adds one more container and extra monitoring overhead.
- Cold starts are longer when Triton loads model artifacts.
- Triton container still requires a compatible environment and image size.

## Run without Docker

```bash
cd remove-background-service
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
uvicorn server:server --host 0.0.0.0 --port 8010
```

## Fine-tuning

The repository runs inference/deployment from this service. Training is isolated in `training/`.

Dataset structure:

```text
training/data/group-matting/
  train/images/*.jpg
  train/masks/*.png
  val/images/*.jpg
  val/masks/*.png
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
To deploy this checkpoint in Docker Compose, set:

```dotenv
BIREFNET_MODEL_ID=/training/runs/group-matting/best
BIREFNET_PRESERVE_ASPECT_RATIO=true
```
