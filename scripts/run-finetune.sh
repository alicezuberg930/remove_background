#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

if [ -d ".venv" ] && [ -f ".venv/bin/activate" ]; then
  # shellcheck source=/dev/null
  source ".venv/bin/activate"
elif [ -d ".venv" ] && [ -f ".venv/Scripts/activate" ]; then
  # shellcheck source=/dev/null
  source ".venv/Scripts/activate"
else
  echo "Virtual environment not found. Expected .venv with bin/activate (Linux/macOS) or Scripts/activate (Windows)."
  exit 1
fi

python training/finetune_birefnet.py \
  --train-images training/data/group-matting/train/images \
  --train-masks training/data/group-matting/train/masks \
  --val-images training/data/group-matting/val/images \
  --val-masks training/data/group-matting/val/masks \
  --base-model ZhengPeng7/BiRefNet_HR-matting \
  --output-dir training/runs/group-matting \
  --image-size 512 \
  --epochs 20 \
  --batch-size 2 \
  --grad-accum-steps 8 \
  --lr 1e-5 \
  --trainable-patterns decoder \
  --fp16 \
  --resume
