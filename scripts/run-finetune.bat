@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
cd /d "%PROJECT_DIR%"

if exist "%PROJECT_DIR%\.venv\Scripts\activate.bat" (
  call "%PROJECT_DIR%\.venv\Scripts\activate.bat"
) else (
  echo Virtual environment not found. Expected .venv\Scripts\activate.bat.
  exit /b 1
)

python training/finetune_birefnet.py ^
  --train-images training/data/group-matting/train/images ^
  --train-masks training/data/group-matting/train/masks ^
  --val-images training/data/group-matting/val/images ^
  --val-masks training/data/group-matting/val/masks ^
  --base-model ZhengPeng7/BiRefNet_HR-matting ^
  --output-dir training/runs/group-matting ^
  --image-size 512 ^
  --epochs 20 ^
  --batch-size 2 ^
  --grad-accum-steps 8 ^
  --lr 1e-5 ^
  --trainable-patterns decoder ^
  --fp16 ^
  --resume
if errorlevel 1 exit /b %errorlevel%

endlocal
