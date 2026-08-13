# Remove Background Service

Service này chạy độc lập với `backend-main`, đặt ngang cấp với thư mục backend để có thể deploy lên server riêng.

## Cấu trúc

- `app.py`: API FastAPI cho remove background
- `Dockerfile`: image chạy service
- `Dockerfile.triton`: image Triton Inference Server cho BiRefNet
- `docker-compose.yml`: mở port `8010` ra ngoài
- `.env.example`: biến môi trường mẫu
- `triton-model-repository/`: model repository cho Triton

## Endpoint

- `GET /health`
- `POST /remove-background`

Request JSON:

```json
{
  "image_base64": "data:image/png;base64,..."
}
```

Response JSON:

```json
{
  "foreground_image": "data:image/png;base64,...",
  "engine": "BiRefNet:ZhengPeng7/BiRefNet"
}
```

## Run bằng Docker Compose

```bash
cd remove-background-service
cp .env.example .env
docker compose up -d --build
```

Service sẽ lắng nghe trên port `8010` của máy host.

Theo mặc định compose mới sẽ chạy thêm một container Triton nội bộ. `app.py` sẽ gọi Triton trước cho BiRefNet, nếu Triton lỗi hoặc chưa sẵn sàng thì fallback về local worker như cũ.

## Mở port cho backend gọi sang

Nếu backend chạy ở máy khác, server service phải mở inbound port `8010` trên firewall/security group.

Backend Django trỏ tới service qua biến env:

```dotenv
REMOVE_BG_SERVICE_URL=http://YOUR_SERVER_IP:8010
REMOVE_BG_SERVICE_TIMEOUT_SECONDS=120
```

## Biến môi trường BiRefNet + Triton

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

Để Triton ưu tiên GPU, để `BIREFNET_DEVICE` rỗng. Khi đó model sẽ tự chọn `cuda` nếu container thấy GPU, và fallback về `cpu` nếu không có GPU. Với host có NVIDIA Container Toolkit, compose đã bật `gpus: all` cho container Triton.

Nếu muốn tắt Triton, set `BIREFNET_TRITON_ENABLED=false`. Khi đó service sẽ chỉ dùng local worker như trước.

## Ưu điểm khi dùng Triton cho BiRefNet

- Tách riêng tầng inference khỏi FastAPI, dễ scale độc lập.
- Model cache và vòng đời model rõ ràng hơn cho production.
- Dễ chuyển sang GPU hoặc tối ưu batching sau này mà không phải viết lại API remove background.
- FastAPI vẫn giữ được orchestration logic và fallback engine hiện có.

## Nhược điểm khi dùng Triton cho BiRefNet

- Thêm một container và thêm một lớp vận hành cần monitor.
- Cold start lớn hơn nếu Triton phải tải lại model.
- Python backend trong Triton vẫn phải cài `torch`, `transformers`, `timm`, `kornia`, nên image khá nặng.
- Với tải nhỏ, lợi ích throughput có thể chưa bù được độ phức tạp tăng thêm.

## Chạy không dùng Docker

```bash
cd remove-background-service
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8010
```

## Kiểm tra nhanh

```bash
curl http://127.0.0.1:8010/health
```

Nếu trả về `{"status":"ok"}` thì backend có thể kết nối tới service này.

## Fine-tune cho anh nhieu nguoi/vat sat nhau

Repo nay chay inference/deploy. Training duoc tach rieng trong `training/` de
khong lam phuc tap service production.

Dataset need to have mask:

```text
training/data/group-matting/
  train/images/*.jpg
  train/masks/*.png
  val/images/*.jpg
  val/masks/*.png
```

image name and mask name needs to match, for example `group-001.jpg` and `group-001.png`. Priority for images with many people next to each other, people touching objects, hair/clothes/bag/chair/table/product stuck to each other.

Check dataset:

```bash
python training/audit_dataset.py training/data/group-matting
```

Fine-tune:

```bash
python training/finetune_birefnet.py \
  --train-images training/data/group-matting/train/images \
  --train-masks training/data/group-matting/train/masks \
  --val-images training/data/group-matting/val/images \
  --val-masks training/data/group-matting/val/masks \
  --base-model ZhengPeng7/BiRefNet_HR-matting \
  --output-dir training/runs/group-matting \
  --image-size 512 \
  --epochs 20 \
  --batch-size 1 \
  --grad-accum-steps 8 \
  --lr 1e-5 \
  --trainable-patterns decoder \
  --fp16
```

```bash
docker compose --profile train build birefnet-trainer
docker compose --profile train run --rm birefnet-trainer \
  python3 training/finetune_birefnet.py \
  --train-images training/data/group-matting/train/images \
  --train-masks training/data/group-matting/train/masks \
  --val-images training/data/group-matting/val/images \
  --val-masks training/data/group-matting/val/masks \
  --base-model ZhengPeng7/BiRefNet_HR-matting \
  --output-dir training/runs/group-matting \
  --image-size 512 \
  --epochs 20 \
  --batch-size 1 \
  --grad-accum-steps 8 \
  --lr 1e-5 \
  --trainable-patterns decoder \
  --fp16
```

best checkpoint is in `training/runs/group-matting/best`. to deploy to docker Compose, set:

```dotenv
BIREFNET_MODEL_ID=/training/runs/group-matting/best
BIREFNET_PRESERVE_ASPECT_RATIO=true
```