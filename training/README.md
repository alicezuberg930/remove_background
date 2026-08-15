# BiRefNet fine-tuning for group/person/object background removal

This folder contains the local training path for cases where BiRefNet misses
multiple people standing close together or mixed people + objects.

## Dataset format

Put manually checked images and masks here:

```text
training/data/group-matting/
  train/
    images/
      sample-001.jpg
    masks/
      sample-001.png
  val/
    images/
      sample-101.jpg
    masks/
      sample-101.png
```

Mask file names must match image file names by stem. Example:
`images/family-01.jpg` pairs with `masks/family-01.png`.

For this bug, include many samples where:

- 2-8 people stand close together or overlap.
- Clothes, hair, bags, props, chairs, tables, products, and hands touch each other.
- Foreground color is close to the background.
- Full body, half body, wide horizontal group photos, and tall portrait photos are mixed.

Use masks that keep every intended person/object as foreground. Do not train on
raw auto-generated masks unless they were reviewed, because the model will learn
the old mistakes.

## Audit the dataset

```bash
python training/audit_dataset.py training/data/group-matting
```

Fix missing masks, size mismatches, empty masks, and full-image masks before
training.

## Fine-tune

Run fine-tuning:

- On linux

```bash
bash scripts/run-finetune.sh
```

- On windows

```bash
scripts\run-finetune.bat
```

On an 8GB GPU, start with `--image-size 512`. Try `768` after the first run
works. Use `1024`, `1536`, or `2048` only on larger GPUs.

The best deployable checkpoint is saved at:

```text
training/runs/group-matting/best
```

## Deploy the fine-tuned model

Best checkpoint is stored at `training/runs/group-matting/best`.
To deploy this checkpoint in Docker Compose or local machine, set:

```dotenv
BIREFNET_MODEL_ID=/models-finetuned/group-matting/best
BIREFNET_IMAGE_SIZE=1024
```