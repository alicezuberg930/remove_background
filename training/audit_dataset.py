import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'}


def _first_existing(root: Path, names: tuple[str, ...]) -> Path | None:
    for name in names:
        candidate = root / name
        if candidate.exists():
            return candidate
    return None


def _collect_files(path: Path) -> dict[str, Path]:
    if not path.exists():
        return {}
    return {
        item.stem: item
        for item in sorted(path.iterdir())
        if item.is_file() and item.suffix.lower() in IMAGE_EXTS
    }


def _load_mask(path: Path) -> np.ndarray:
    mask = Image.open(path)
    if 'A' in mask.getbands():
        mask = mask.getchannel('A')
    else:
        mask = mask.convert('L')
    return np.asarray(mask, dtype=np.float32) / 255.0


def _audit_split(root: Path, split: str) -> dict:
    split_root = root / split
    image_dir = _first_existing(split_root, ('images', 'im', 'image'))
    mask_dir = _first_existing(split_root, ('masks', 'gt', 'mask'))

    result = {
        'split': split,
        'image_dir': str(image_dir) if image_dir else None,
        'mask_dir': str(mask_dir) if mask_dir else None,
        'image_count': 0,
        'mask_count': 0,
        'paired_count': 0,
        'missing_masks': [],
        'missing_images': [],
        'size_mismatches': [],
        'empty_masks': [],
        'full_masks': [],
        'soft_mask_count': 0,
        'mean_foreground_ratio': None,
    }

    if image_dir is None or mask_dir is None:
        return result

    images = _collect_files(image_dir)
    masks = _collect_files(mask_dir)
    result['image_count'] = len(images)
    result['mask_count'] = len(masks)

    image_stems = set(images)
    mask_stems = set(masks)
    paired_stems = sorted(image_stems & mask_stems)
    result['paired_count'] = len(paired_stems)
    result['missing_masks'] = sorted(image_stems - mask_stems)[:50]
    result['missing_images'] = sorted(mask_stems - image_stems)[:50]

    foreground_ratios = []
    for stem in paired_stems:
        image_path = images[stem]
        mask_path = masks[stem]
        with Image.open(image_path) as image:
            image_size = image.size
        with Image.open(mask_path) as mask_image:
            mask_size = mask_image.size

        if image_size != mask_size:
            result['size_mismatches'].append({
                'stem': stem,
                'image_size': image_size,
                'mask_size': mask_size,
            })
            continue

        mask = _load_mask(mask_path)
        foreground_ratio = float((mask > 0.5).mean())
        foreground_ratios.append(foreground_ratio)

        if foreground_ratio < 0.001:
            result['empty_masks'].append(stem)
        if foreground_ratio > 0.999:
            result['full_masks'].append(stem)

        unique_values = np.unique((mask * 255).astype(np.uint8))
        if len(unique_values) > 2:
            result['soft_mask_count'] += 1

    if foreground_ratios:
        result['mean_foreground_ratio'] = float(np.mean(foreground_ratios))

    result['size_mismatches'] = result['size_mismatches'][:50]
    result['empty_masks'] = result['empty_masks'][:50]
    result['full_masks'] = result['full_masks'][:50]
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description='Audit a remove-background fine-tuning dataset.')
    parser.add_argument(
        'dataset_root',
        type=Path,
        help='Dataset root with train/images + train/masks and val/images + val/masks.',
    )
    args = parser.parse_args()

    summary = {
        'dataset_root': str(args.dataset_root),
        'splits': [
            _audit_split(args.dataset_root, 'train'),
            _audit_split(args.dataset_root, 'val'),
        ],
    }
    print(json.dumps(summary, indent=2))

    has_error = False
    for split in summary['splits']:
        has_error = has_error or not split['image_dir'] or not split['mask_dir']
        has_error = has_error or split['paired_count'] == 0
        has_error = has_error or bool(split['missing_masks'])
        has_error = has_error or bool(split['size_mismatches'])
        has_error = has_error or bool(split['empty_masks'])
        has_error = has_error or bool(split['full_masks'])

    return 1 if has_error else 0


if __name__ == '__main__':
    raise SystemExit(main())
