from __future__ import annotations

import argparse
import inspect
import json
import math
import random
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'}
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
PAD_COLOR = (123, 116, 103)
torch = None
F = None
DataLoader = None
AutoModelForImageSegmentation = None


def load_training_dependencies() -> None:
    global torch, F, DataLoader, AutoModelForImageSegmentation

    if torch is not None:
        return

    try:
        import torch as torch_module
        import torch.nn.functional as functional_module
        from torch.utils.data import DataLoader as data_loader_cls
        from transformers import AutoModelForImageSegmentation as auto_model_cls
    except ModuleNotFoundError as exc:
        raise SystemExit(
            f'Missing training dependency: {exc.name}. '
            'Install requirements-train.txt before running fine-tuning.'
        ) from exc

    torch = torch_module
    F = functional_module
    DataLoader = data_loader_cls
    AutoModelForImageSegmentation = auto_model_cls


def collect_pairs(image_dir: Path, mask_dir: Path) -> list[tuple[Path, Path]]:
    if not image_dir.exists() or not mask_dir.exists():
        return []

    images = {
        item.stem: item
        for item in sorted(image_dir.iterdir())
        if item.is_file() and item.suffix.lower() in IMAGE_EXTS
    }
    masks = {
        item.stem: item
        for item in sorted(mask_dir.iterdir())
        if item.is_file() and item.suffix.lower() in IMAGE_EXTS
    }
    pairs = []
    for stem in sorted(set(images) & set(masks)):
        with Image.open(images[stem]) as image:
            image_size = image.size
        with Image.open(masks[stem]) as mask:
            mask_size = mask.size
        if image_size != mask_size:
            continue
        pairs.append((images[stem], masks[stem]))
    return pairs


def load_pairs_manifest(path: Path) -> list[tuple[Path, Path]]:
    with path.open('r', encoding='utf-8') as handle:
        rows = json.load(handle)
    return [(Path(row['image']), Path(row['mask'])) for row in rows]


def load_mask(path: Path) -> Image.Image:
    mask = Image.open(path)
    if 'A' in mask.getbands():
        mask = mask.getchannel('A')
    else:
        mask = mask.convert('L')
    return mask


def letterbox_pair(image: Image.Image, mask: Image.Image, size: int) -> tuple[Image.Image, Image.Image]:
    width, height = image.size
    scale = min(size / width, size / height)
    resized_width = max(1, int(round(width * scale)))
    resized_height = max(1, int(round(height * scale)))
    left = (size - resized_width) // 2
    top = (size - resized_height) // 2

    image_canvas = Image.new('RGB', (size, size), PAD_COLOR)
    mask_canvas = Image.new('L', (size, size), 0)
    image_canvas.paste(image.resize((resized_width, resized_height), Image.LANCZOS), (left, top))
    mask_canvas.paste(mask.resize((resized_width, resized_height), Image.LANCZOS), (left, top))
    return image_canvas, mask_canvas


class MattingDataset:
    def __init__(
        self,
        image_dir: Path,
        mask_dir: Path,
        image_size: int,
        training: bool,
        augment: bool,
        pairs: list[tuple[Path, Path]] | None = None,
    ):
        self.pairs = pairs if pairs is not None else collect_pairs(image_dir, mask_dir)
        self.image_size = image_size
        self.training = training
        self.augment = augment
        from torchvision import transforms

        self.color_jitter = transforms.ColorJitter(
            brightness=0.12,
            contrast=0.12,
            saturation=0.08,
            hue=0.02,
        )
        self.to_tensor = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ])

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        load_training_dependencies()
        image_path, mask_path = self.pairs[index]
        image = Image.open(image_path).convert('RGB')
        image = ImageOps.exif_transpose(image)
        mask = load_mask(mask_path)
        mask = ImageOps.exif_transpose(mask)

        if image.size != mask.size:
            raise ValueError(f'Image and mask size mismatch: {image_path} vs {mask_path}')

        if self.training and self.augment:
            if random.random() < 0.5:
                image = ImageOps.mirror(image)
                mask = ImageOps.mirror(mask)
            if random.random() < 0.8:
                image = self.color_jitter(image)

        image, mask = letterbox_pair(image, mask, self.image_size)
        image_tensor = self.to_tensor(image)
        mask_array = np.asarray(mask, dtype=np.float32) / 255.0
        mask_tensor = torch.from_numpy(mask_array).unsqueeze(0)
        return {
            'image': image_tensor,
            'mask': mask_tensor,
        }


def extract_prediction(outputs) -> torch.Tensor:
    tensors = []

    def collect_tensors(value):
        if value is None:
            return
        if hasattr(value, 'logits'):
            collect_tensors(value.logits)
            return
        if hasattr(value, 'ndim'):
            tensors.append(value)
            return
        if isinstance(value, (list, tuple)):
            for item in value:
                collect_tensors(item)

    collect_tensors(outputs)
    if not tensors:
        raise ValueError('BiRefNet returned no tensor prediction')

    pred = tensors[-1]
    if pred.ndim == 3:
        pred = pred.unsqueeze(1)
    return pred


def dice_loss(probs: torch.Tensor, target: torch.Tensor, eps: float = 1e-6) -> torch.Tensor:
    dims = (1, 2, 3)
    intersection = torch.sum(probs * target, dim=dims)
    union = torch.sum(probs + target, dim=dims)
    dice = (2.0 * intersection + eps) / (union + eps)
    return 1.0 - dice.mean()


def boundary_loss(probs: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    probs_dx = torch.abs(probs[:, :, :, 1:] - probs[:, :, :, :-1])
    target_dx = torch.abs(target[:, :, :, 1:] - target[:, :, :, :-1])
    probs_dy = torch.abs(probs[:, :, 1:, :] - probs[:, :, :-1, :])
    target_dy = torch.abs(target[:, :, 1:, :] - target[:, :, :-1, :])
    return F.l1_loss(probs_dx, target_dx) + F.l1_loss(probs_dy, target_dy)


def compute_loss(logits: torch.Tensor, target: torch.Tensor, args: argparse.Namespace) -> torch.Tensor:
    if logits.shape[-2:] != target.shape[-2:]:
        logits = F.interpolate(logits, size=target.shape[-2:], mode='bilinear', align_corners=False)

    probs = torch.sigmoid(logits)
    bce = F.binary_cross_entropy_with_logits(logits, target)
    dice = dice_loss(probs, target)
    mae = F.l1_loss(probs, target)
    edge = boundary_loss(probs, target)
    return (
        args.bce_weight * bce
        + args.dice_weight * dice
        + args.mae_weight * mae
        + args.boundary_weight * edge
    )


def validate(model, loader: DataLoader, device: torch.device) -> dict[str, float]:
    model.eval()
    total_intersection = 0.0
    total_union = 0.0
    total_dice_num = 0.0
    total_dice_den = 0.0
    total_mae = 0.0
    total_pixels = 0

    with torch.no_grad():
        for batch in loader:
            images = batch['image'].to(device, non_blocking=True)
            masks = batch['mask'].to(device, non_blocking=True)
            outputs = model(images)
            logits = extract_prediction(outputs)
            if logits.shape[-2:] != masks.shape[-2:]:
                logits = F.interpolate(logits, size=masks.shape[-2:], mode='bilinear', align_corners=False)
            probs = torch.sigmoid(logits)
            pred = probs > 0.5
            target = masks > 0.5

            intersection = torch.logical_and(pred, target).sum().item()
            union = torch.logical_or(pred, target).sum().item()
            total_intersection += intersection
            total_union += union
            total_dice_num += 2.0 * intersection
            total_dice_den += pred.sum().item() + target.sum().item()
            total_mae += torch.abs(probs - masks).sum().item()
            total_pixels += masks.numel()

    return {
        'iou': total_intersection / max(1.0, total_union),
        'dice': total_dice_num / max(1.0, total_dice_den),
        'mae': total_mae / max(1, total_pixels),
    }


def save_model(model, output_dir: Path, metadata: dict) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(output_dir)

    config_path = output_dir / 'config.json'
    with config_path.open('r', encoding='utf-8') as handle:
        config = json.load(handle)
    config.update({
        'model_type': 'SegformerForSemanticSegmentation',
        'auto_map': {
            'AutoConfig': 'BiRefNet_config.BiRefNetConfig',
            'AutoModelForImageSegmentation': 'birefnet.BiRefNet',
        },
        'custom_pipelines': {
            'image-segmentation': {
                'pt': ['AutoModelForImageSegmentation'],
                'tf': [],
                'type': 'image',
            },
        },
        'bb_pretrained': False,
    })
    with config_path.open('w', encoding='utf-8') as handle:
        json.dump(config, handle, indent=2)

    for cls in (model.__class__, model.config.__class__):
        source_path = Path(inspect.getfile(cls))
        if source_path.exists() and source_path.suffix == '.py':
            shutil.copy2(source_path, output_dir / source_path.name)
            config_source_path = source_path.parent / 'BiRefNet_config.py'
            if config_source_path.exists():
                shutil.copy2(config_source_path, output_dir / config_source_path.name)

    with (output_dir / 'training_metadata.json').open('w', encoding='utf-8') as handle:
        json.dump(metadata, handle, indent=2)


def configure_trainable_parameters(model, patterns: str) -> dict[str, int]:
    total_params = 0
    trainable_params = 0
    pattern_list = [pattern.strip().lower() for pattern in patterns.split(',') if pattern.strip()]

    for name, param in model.named_parameters():
        total_params += param.numel()
        if pattern_list:
            param.requires_grad = any(pattern in name.lower() for pattern in pattern_list)
        if param.requires_grad:
            trainable_params += param.numel()

    if pattern_list and trainable_params == 0:
        raise SystemExit(
            'No trainable parameters matched --trainable-patterns. '
            'Run without this option or inspect model.named_parameters().'
        )

    return {
        'total_params': total_params,
        'trainable_params': trainable_params,
    }


def freeze_batchnorm_layers(model) -> int:
    frozen_count = 0
    batchnorm_types = (
        torch.nn.BatchNorm1d,
        torch.nn.BatchNorm2d,
        torch.nn.BatchNorm3d,
        torch.nn.SyncBatchNorm,
    )
    for module in model.modules():
        if isinstance(module, batchnorm_types):
            module.eval()
            frozen_count += 1
            for param in module.parameters(recurse=False):
                param.requires_grad = False
    return frozen_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Fine-tune BiRefNet for local remove-background cases.')
    parser.add_argument('--train-images', type=Path, required=True)
    parser.add_argument('--train-masks', type=Path, required=True)
    parser.add_argument('--val-images', type=Path, required=True)
    parser.add_argument('--val-masks', type=Path, required=True)
    parser.add_argument('--train-pairs-json', type=Path)
    parser.add_argument('--val-pairs-json', type=Path)
    parser.add_argument('--base-model', default='ZhengPeng7/BiRefNet_HR-matting')
    parser.add_argument('--output-dir', type=Path, default=Path('training/runs/group-matting'))
    parser.add_argument('--image-size', type=int, default=1024)
    parser.add_argument('--epochs', type=int, default=20)
    parser.add_argument('--batch-size', type=int, default=1)
    parser.add_argument('--grad-accum-steps', type=int, default=4)
    parser.add_argument('--lr', type=float, default=1e-5)
    parser.add_argument('--weight-decay', type=float, default=1e-4)
    parser.add_argument('--num-workers', type=int, default=2)
    parser.add_argument('--seed', type=int, default=1337)
    parser.add_argument('--log-every-steps', type=int, default=100)
    parser.add_argument('--no-augment', action='store_true')
    parser.add_argument(
        '--trainable-patterns',
        default='',
        help='Comma-separated parameter name fragments to train. Empty means full fine-tune.',
    )
    parser.add_argument(
        '--train-batchnorm',
        action='store_true',
        help='Allow BatchNorm layers to update. Leave disabled for small batch fine-tuning.',
    )
    parser.add_argument('--gradient-checkpointing', action='store_true')
    parser.add_argument('--bce-weight', type=float, default=1.0)
    parser.add_argument('--dice-weight', type=float, default=1.0)
    parser.add_argument('--mae-weight', type=float, default=0.5)
    parser.add_argument('--boundary-weight', type=float, default=0.2)
    parser.add_argument('--device', default='auto', help='Use auto, cuda, or cpu.')
    parser.add_argument('--fp16', action='store_true')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    train_pairs = load_pairs_manifest(args.train_pairs_json) if args.train_pairs_json else collect_pairs(
        args.train_images,
        args.train_masks,
    )
    val_pairs = load_pairs_manifest(args.val_pairs_json) if args.val_pairs_json else collect_pairs(
        args.val_images,
        args.val_masks,
    )
    if not train_pairs:
        raise SystemExit('No training image/mask pairs found.')
    if not val_pairs:
        raise SystemExit('No validation image/mask pairs found.')
    print(json.dumps({'dataset': {'train_pairs': len(train_pairs), 'val_pairs': len(val_pairs)}}), flush=True)

    load_training_dependencies()
    if args.device == 'auto':
        args.device = 'cuda' if torch.cuda.is_available() else 'cpu'

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    train_dataset = MattingDataset(
        image_dir=args.train_images,
        mask_dir=args.train_masks,
        image_size=args.image_size,
        training=True,
        augment=not args.no_augment,
        pairs=train_pairs,
    )
    val_dataset = MattingDataset(
        image_dir=args.val_images,
        mask_dir=args.val_masks,
        image_size=args.image_size,
        training=False,
        augment=False,
        pairs=val_pairs,
    )
    device = torch.device(args.device)
    pin_memory = device.type == 'cuda'
    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=pin_memory,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=1,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=pin_memory,
    )

    model = AutoModelForImageSegmentation.from_pretrained(
        args.base_model,
        trust_remote_code=True,
    )
    if args.gradient_checkpointing:
        if hasattr(model, 'gradient_checkpointing_enable'):
            try:
                model.gradient_checkpointing_enable()
            except ValueError as exc:
                print(json.dumps({'warning': str(exc)}), flush=True)
        else:
            print(json.dumps({'warning': 'Model does not expose gradient_checkpointing_enable.'}), flush=True)

    param_stats = configure_trainable_parameters(model, args.trainable_patterns)
    model.to(device)
    model.train()
    batchnorm_stats = {'frozen_batchnorm_layers': 0}
    if not args.train_batchnorm:
        batchnorm_stats['frozen_batchnorm_layers'] = freeze_batchnorm_layers(model)

    optimizer = torch.optim.AdamW(
        [param for param in model.parameters() if param.requires_grad],
        lr=args.lr,
        weight_decay=args.weight_decay,
    )
    scaler = torch.cuda.amp.GradScaler(enabled=args.fp16 and device.type == 'cuda')
    steps_per_epoch = math.ceil(len(train_loader) / max(1, args.grad_accum_steps))
    best_dice = -1.0

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with (args.output_dir / 'run_args.json').open('w', encoding='utf-8') as handle:
        json.dump(
            vars(args) | {'steps_per_epoch': steps_per_epoch} | param_stats | batchnorm_stats,
            handle,
            indent=2,
            default=str,
        )
    print(json.dumps({'setup': vars(args) | param_stats | batchnorm_stats}, default=str), flush=True)

    for epoch in range(1, args.epochs + 1):
        model.train()
        if not args.train_batchnorm:
            freeze_batchnorm_layers(model)
        optimizer.zero_grad(set_to_none=True)
        running_loss = 0.0

        for step, batch in enumerate(train_loader, start=1):
            images = batch['image'].to(device, non_blocking=True)
            masks = batch['mask'].to(device, non_blocking=True)

            with torch.cuda.amp.autocast(enabled=args.fp16 and device.type == 'cuda'):
                outputs = model(images)
                logits = extract_prediction(outputs)
                loss = compute_loss(logits, masks, args) / max(1, args.grad_accum_steps)

            scaler.scale(loss).backward()
            running_loss += loss.item() * max(1, args.grad_accum_steps)

            if step % max(1, args.grad_accum_steps) == 0 or step == len(train_loader):
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad(set_to_none=True)

            if args.log_every_steps > 0 and step % args.log_every_steps == 0:
                print(
                    json.dumps({
                        'epoch': epoch,
                        'step': step,
                        'steps': len(train_loader),
                        'avg_train_loss': running_loss / max(1, step),
                    }),
                    flush=True,
                )

        metrics = validate(model, val_loader, device)
        epoch_summary = {
            'epoch': epoch,
            'train_loss': running_loss / max(1, len(train_loader)),
            **metrics,
        }
        print(json.dumps(epoch_summary), flush=True)

        save_model(
            model,
            args.output_dir / 'last',
            {
                **epoch_summary,
                'base_model': args.base_model,
                'image_size': args.image_size,
            },
        )
        if metrics['dice'] > best_dice:
            best_dice = metrics['dice']
            save_model(
                model,
                args.output_dir / 'best',
                {
                    **epoch_summary,
                    'base_model': args.base_model,
                    'image_size': args.image_size,
                },
            )

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
