import base64
import io
import logging
import multiprocessing as mp
import os
import threading
import time
from urllib.parse import urlsplit
import numpy as np
from pydantic import BaseModel
from PIL import Image, ImageFilter


logger = logging.getLogger('remove_background_service')
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO'))

_birefnet_runtime_cache: dict[tuple[str, str, int, bool, bool, tuple[int, int, int]], dict] = {}
_BIREFNET_TIMEOUT_SECONDS = int(os.getenv('BIREFNET_TIMEOUT_SECONDS', '120'))
_BIREFNET_ACQUIRE_TIMEOUT_SECONDS = int(os.getenv('BIREFNET_ACQUIRE_TIMEOUT_SECONDS', '10'))
_BIREFNET_POLL_INTERVAL_SECONDS = 0.5
_BIREFNET_WORKER_POOL_SIZE = int(os.getenv('BIREFNET_WORKER_POOL_SIZE', '1'))
_birefnet_worker_pool_condition = threading.Condition()
_birefnet_worker_pool: list[dict[str, object]] = []
_birefnet_worker_next_index = 0


class RemoveBackgroundRequest(BaseModel):
    image_base64: str


class BiRefNetWorkerAcquireTimeout(Exception):
    """Raised when all BiRefNet workers stay busy past the wait budget."""


def _env_bool(name: str, default: bool) -> bool:
    raw_value = (os.getenv(name, '') or '').strip().lower()
    if not raw_value:
        return default
    return raw_value in ('1', 'true', 'yes', 'on')


def _env_int(name: str, default: int, min_value: int | None = None, max_value: int | None = None) -> int:
    try:
        value = int(os.getenv(name, str(default)) or default)
    except (TypeError, ValueError):
        value = default

    if min_value is not None:
        value = max(min_value, value)
    if max_value is not None:
        value = min(max_value, value)
    return value


def _parse_rgb_env(name: str, default: tuple[int, int, int]) -> tuple[int, int, int]:
    raw_value = (os.getenv(name, '') or '').strip()
    if not raw_value:
        return default

    parts = [part.strip() for part in raw_value.split(',')]
    if len(parts) != 3:
        return default

    try:
        return tuple(max(0, min(255, int(part))) for part in parts)  # type: ignore[return-value]
    except ValueError:
        return default


def _clean_alpha_image(img: Image.Image) -> Image.Image:
    if not _env_bool('REMOVE_BG_ALPHA_CLEANUP_ENABLED', True):
        return img

    arr = np.array(img)
    alpha = arr[:, :, 3].copy()

    low_threshold = _env_int('REMOVE_BG_ALPHA_LOW_THRESHOLD', 10, min_value=0, max_value=255)
    high_threshold = _env_int('REMOVE_BG_ALPHA_HIGH_THRESHOLD', 245, min_value=0, max_value=255)
    if low_threshold > 0:
        alpha[alpha < low_threshold] = 0
    if high_threshold < 255:
        alpha[alpha > high_threshold] = 255

    arr[:, :, 3] = alpha
    cleaned = Image.fromarray(arr, 'RGBA')

    if not _env_bool('REMOVE_BG_ALPHA_SMOOTH_ENABLED', True):
        return cleaned

    smooth_alpha = cleaned.split()[3].filter(ImageFilter.SMOOTH)
    orig_alpha = cleaned.split()[3]
    mask_arr = np.array(orig_alpha)
    smooth_arr = np.array(smooth_alpha)
    edge_mask = (mask_arr > 0) & (mask_arr < 255)
    final_alpha = mask_arr.copy()
    final_alpha[edge_mask] = smooth_arr[edge_mask]
    cleaned.putalpha(Image.fromarray(final_alpha))

    return cleaned


def _decode_base64_image(raw: str) -> bytes:
    if ',' in raw and raw.startswith('data:'):
        raw = raw.split(',', 1)[1]
    return base64.b64decode(raw)


def _pil_to_bytes(img: Image.Image, fmt: str = 'PNG') -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _extract_birefnet_prediction(outputs):
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
    return tensors[-1]


def _prepare_birefnet_image(
    image_rgb: Image.Image,
    image_size: int,
    preserve_aspect_ratio: bool,
    pad_color: tuple[int, int, int],
) -> tuple[Image.Image, tuple[int, int, int, int] | None]:
    if not preserve_aspect_ratio:
        return image_rgb, None

    original_width, original_height = image_rgb.size
    if original_width <= 0 or original_height <= 0:
        return image_rgb, None

    scale = min(image_size / original_width, image_size / original_height)
    resized_width = max(1, int(round(original_width * scale)))
    resized_height = max(1, int(round(original_height * scale)))
    left = (image_size - resized_width) // 2
    top = (image_size - resized_height) // 2

    canvas = Image.new('RGB', (image_size, image_size), pad_color)
    resized = image_rgb.resize((resized_width, resized_height), Image.LANCZOS)
    canvas.paste(resized, (left, top))
    return canvas, (left, top, resized_width, resized_height)


def _prediction_to_mask_image(pred_mask) -> Image.Image:
    if hasattr(pred_mask, 'detach'):
        pred_mask = pred_mask.detach().float().cpu().numpy()

    mask_arr = np.asarray(pred_mask, dtype=np.float32)
    mask_arr = np.squeeze(mask_arr)
    if mask_arr.ndim != 2:
        raise ValueError(f'Expected a 2D mask, got shape {mask_arr.shape}')

    mask_arr = np.clip(mask_arr, 0.0, 1.0)
    return Image.fromarray((mask_arr * 255).astype(np.uint8), 'L')


def _mask_to_foreground_png(
    subject_img: Image.Image,
    pred_mask,
    mask_box: tuple[int, int, int, int] | None = None,
) -> bytes:
    pred_pil = _prediction_to_mask_image(pred_mask)
    if mask_box is not None:
        left, top, width, height = mask_box
        pred_pil = pred_pil.crop((left, top, left + width, top + height))

    mask = pred_pil.resize(subject_img.size, Image.LANCZOS)

    fg_img = subject_img.convert('RGB').convert('RGBA')
    fg_img.putalpha(mask)
    fg_img = _clean_alpha_image(fg_img)

    output = io.BytesIO()
    fg_img.save(output, format='PNG')
    return output.getvalue()


def _normalize_triton_http_url(triton_url: str) -> str:
    normalized_url = (triton_url or '').strip().rstrip('/')
    if not normalized_url:
        return normalized_url

    if '://' not in normalized_url:
        return normalized_url

    parsed = urlsplit(normalized_url)
    if parsed.scheme not in ('http', 'https'):
        raise ValueError(f'Unsupported Triton URL scheme: {parsed.scheme}')
    if not parsed.netloc:
        raise ValueError('Triton URL must include a host')
    if parsed.path not in ('', '/') or parsed.query or parsed.fragment:
        raise ValueError('Triton URL must point to the Triton server root')
    return parsed.netloc


def _run_birefnet_via_triton(
    image_bytes: bytes,
    model_name: str,
    triton_url: str,
    image_size: int,
    timeout_seconds: int,
    preserve_aspect_ratio: bool,
    pad_color: tuple[int, int, int],
) -> tuple[bytes | None, str | None]:
    from torchvision import transforms

    try:
        import tritonclient.http as triton_http
    except ImportError as exc:
        logger.warning('[REMOVE-BG] Triton client dependency missing: %s', exc)
        return None, None

    try:
        subject_img = Image.open(io.BytesIO(image_bytes)).convert('RGBA')
        image_rgb = subject_img.convert('RGB')
        prepared_img, mask_box = _prepare_birefnet_image(
            image_rgb=image_rgb,
            image_size=image_size,
            preserve_aspect_ratio=preserve_aspect_ratio,
            pad_color=pad_color,
        )
        client_url = _normalize_triton_http_url(triton_url)
        if preserve_aspect_ratio:
            transform_image = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
        else:
            transform_image = transforms.Compose([
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
        input_tensor = transform_image(prepared_img).unsqueeze(0).numpy().astype(np.float32)

        client = triton_http.InferenceServerClient(
            url=client_url,
            connection_timeout=timeout_seconds,
            network_timeout=timeout_seconds,
        )
        infer_input = triton_http.InferInput('input', input_tensor.shape, 'FP32')
        infer_input.set_data_from_numpy(input_tensor, binary_data=True)
        infer_output = triton_http.InferRequestedOutput('mask', binary_data=True)
        result = client.infer(model_name=model_name, inputs=[infer_input], outputs=[infer_output])
        pred_mask = result.as_numpy('mask')
        if pred_mask is None:
            logger.warning('[REMOVE-BG] Triton returned no mask output')
            return None, None

        if pred_mask.ndim == 4:
            pred_mask = pred_mask[0, 0]
        elif pred_mask.ndim == 3:
            pred_mask = pred_mask[0]

        output_bytes = _mask_to_foreground_png(subject_img, pred_mask, mask_box=mask_box)
        return output_bytes, f'Triton:{model_name}'
    except Exception as exc:
        logger.warning('[REMOVE-BG] Triton inference failed: %s', exc)
        return None, None


def _run_birefnet_inference(
    image_bytes: bytes,
    model_id: str,
    configured_device: str,
    image_size: int,
    use_half: bool,
    preserve_aspect_ratio: bool,
    pad_color: tuple[int, int, int],
) -> tuple[bytes | None, str | None]:
    import torch
    from torchvision import transforms
    from transformers import AutoModelForImageSegmentation

    subject_img = Image.open(io.BytesIO(image_bytes)).convert('RGBA')
    image_rgb = subject_img.convert('RGB')

    if configured_device:
        device_name = configured_device
    else:
        device_name = 'cuda' if torch.cuda.is_available() else 'cpu'

    image_size = max(256, int(image_size or 1024))
    use_half = bool(use_half) and device_name.startswith('cuda')
    cache_key = (model_id, device_name, image_size, use_half, preserve_aspect_ratio, pad_color)

    runtime = _birefnet_runtime_cache.get(cache_key)
    if runtime is None:
        device = torch.device(device_name)
        model = AutoModelForImageSegmentation.from_pretrained(
            model_id,
            trust_remote_code=True,
        )
        model.to(device)
        model.eval()
        if use_half:
            model.half()

        if preserve_aspect_ratio:
            transform_image = transforms.Compose([
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
        else:
            transform_image = transforms.Compose([
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
        runtime = {
            'device': device,
            'model': model,
            'transform': transform_image,
            'use_half': use_half,
            'device_name': device_name,
        }
        _birefnet_runtime_cache[cache_key] = runtime

    model = runtime['model']
    device = runtime['device']
    transform_image = runtime['transform']
    prepared_img, mask_box = _prepare_birefnet_image(
        image_rgb=image_rgb,
        image_size=image_size,
        preserve_aspect_ratio=preserve_aspect_ratio,
        pad_color=pad_color,
    )
    input_tensor = transform_image(prepared_img).unsqueeze(0).to(device)
    if runtime['use_half']:
        input_tensor = input_tensor.half()

    with torch.no_grad():
        outputs = model(input_tensor)

    pred_tensor = _extract_birefnet_prediction(outputs)
    pred_mask = pred_tensor.sigmoid().cpu()[0].squeeze()
    return _mask_to_foreground_png(subject_img, pred_mask, mask_box=mask_box), f'BiRefNet:{model_id}'


def _birefnet_worker_main(conn):
    try:
        while True:
            request = conn.recv()
            if request is None or request.get('command') == 'shutdown':
                break

            try:
                output_bytes, engine_name = _run_birefnet_inference(
                    image_bytes=request['image_bytes'],
                    model_id=request['model_id'],
                    configured_device=request['configured_device'],
                    image_size=request['image_size'],
                    use_half=request['use_half'],
                    preserve_aspect_ratio=request['preserve_aspect_ratio'],
                    pad_color=request['pad_color'],
                )
                conn.send({'ok': True, 'image_bytes': output_bytes, 'engine': engine_name})
            except Exception as exc:
                conn.send({'ok': False, 'error': str(exc)})
    except EOFError:
        pass
    finally:
        conn.close()


def _stop_birefnet_worker_locked(runtime: dict[str, object]):
    process = runtime['process']
    conn = runtime['conn']

    try:
        if process.is_alive():
            try:
                conn.send({'command': 'shutdown'})
            except (BrokenPipeError, EOFError, OSError):
                pass
            process.join(1)

        if process.is_alive():
            process.terminate()
            process.join(5)

        if process.is_alive() and hasattr(process, 'kill'):
            process.kill()
            process.join(5)
    finally:
        try:
            conn.close()
        except OSError:
            pass


def _get_birefnet_pool_size() -> int:
    return max(1, _BIREFNET_WORKER_POOL_SIZE)


def _get_birefnet_mp_context():
    if 'fork' in mp.get_all_start_methods():
        return mp.get_context('fork')
    return mp.get_context('spawn')


def _start_birefnet_worker_locked(worker_id: int) -> dict[str, object]:
    ctx = _get_birefnet_mp_context()
    parent_conn, child_conn = ctx.Pipe()
    process = ctx.Process(
        target=_birefnet_worker_main,
        args=(child_conn,),
        daemon=True,
    )
    process.start()
    child_conn.close()
    return {
        'worker_id': worker_id,
        'process': process,
        'conn': parent_conn,
        'busy': False,
    }


def _ensure_birefnet_worker_pool_locked():
    desired_size = _get_birefnet_pool_size()
    if len(_birefnet_worker_pool) != desired_size:
        for runtime in _birefnet_worker_pool:
            _stop_birefnet_worker_locked(runtime)
        _birefnet_worker_pool.clear()

        for worker_id in range(desired_size):
            _birefnet_worker_pool.append(_start_birefnet_worker_locked(worker_id))
        return

    for index, runtime in enumerate(_birefnet_worker_pool):
        if runtime['process'].is_alive():
            continue

        _stop_birefnet_worker_locked(runtime)
        replacement = _start_birefnet_worker_locked(runtime['worker_id'])
        _birefnet_worker_pool[index] = replacement


def _acquire_birefnet_worker(timeout_seconds: float | None = None) -> tuple[int, dict[str, object]]:
    global _birefnet_worker_next_index

    with _birefnet_worker_pool_condition:
        deadline = None if timeout_seconds is None else (time.monotonic() + max(0.0, timeout_seconds))

        while True:
            _ensure_birefnet_worker_pool_locked()
            pool_size = len(_birefnet_worker_pool)

            for offset in range(pool_size):
                index = (_birefnet_worker_next_index + offset) % pool_size
                runtime = _birefnet_worker_pool[index]
                if runtime['busy']:
                    continue

                runtime['busy'] = True
                _birefnet_worker_next_index = (index + 1) % pool_size
                return index, runtime

            if deadline is None:
                _birefnet_worker_pool_condition.wait()
                continue

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise BiRefNetWorkerAcquireTimeout()
            _birefnet_worker_pool_condition.wait(remaining)


def _release_birefnet_worker(index: int, runtime: dict[str, object], reset: bool = False):
    with _birefnet_worker_pool_condition:
        if index >= len(_birefnet_worker_pool) or _birefnet_worker_pool[index] is not runtime:
            _stop_birefnet_worker_locked(runtime)
            _birefnet_worker_pool_condition.notify()
            return

        if reset or not runtime['process'].is_alive():
            _stop_birefnet_worker_locked(runtime)
            runtime = _start_birefnet_worker_locked(runtime['worker_id'])
            _birefnet_worker_pool[index] = runtime

        runtime['busy'] = False
        _birefnet_worker_pool_condition.notify()


def remove_bg_birefnet(subject_img: Image.Image):
    model_id = (os.getenv('BIREFNET_MODEL_ID', 'ZhengPeng7/BiRefNet') or '').strip()
    if not model_id:
        return None, None

    configured_device = (os.getenv('BIREFNET_DEVICE', '') or '').strip().lower()
    image_size = int(os.getenv('BIREFNET_IMAGE_SIZE', '1024') or '1024')
    timeout_seconds = max(1, _BIREFNET_TIMEOUT_SECONDS)
    acquire_timeout_seconds = max(1, _BIREFNET_ACQUIRE_TIMEOUT_SECONDS)
    use_half = (os.getenv('BIREFNET_USE_HALF', 'true').strip().lower() in ('1', 'true', 'yes', 'on'))
    preserve_aspect_ratio = _env_bool('BIREFNET_PRESERVE_ASPECT_RATIO', True)
    pad_color = _parse_rgb_env('BIREFNET_PAD_COLOR', (123, 116, 103))
    image_bytes = _pil_to_bytes(subject_img, fmt='PNG')

    triton_enabled = (os.getenv('BIREFNET_TRITON_ENABLED', 'true').strip().lower() in ('1', 'true', 'yes', 'on'))
    triton_url = (os.getenv('BIREFNET_TRITON_URL', '') or '').strip().rstrip('/')
    triton_model_name = (os.getenv('BIREFNET_TRITON_MODEL_NAME', 'birefnet') or 'birefnet').strip()
    if triton_enabled and triton_url:
        output_bytes, engine_name = _run_birefnet_via_triton(
            image_bytes=image_bytes,
            model_name=triton_model_name,
            triton_url=triton_url,
            image_size=image_size,
            timeout_seconds=timeout_seconds,
            preserve_aspect_ratio=preserve_aspect_ratio,
            pad_color=pad_color,
        )
        if output_bytes is not None:
            fg_img = Image.open(io.BytesIO(output_bytes)).convert('RGBA')
            logger.info('[REMOVE-BG] BiRefNet Triton success (%s via %s)', triton_model_name, triton_url)
            return fg_img, engine_name

    try:
        import torch
    except ImportError as exc:
        logger.warning('[REMOVE-BG] BiRefNet dependencies missing: %s', exc)
        return None, None

    deadline = time.monotonic() + timeout_seconds

    try:
        worker_index, runtime = _acquire_birefnet_worker(timeout_seconds=acquire_timeout_seconds)
    except BiRefNetWorkerAcquireTimeout:
        logger.warning('[REMOVE-BG] BiRefNet pool saturated for %ss; falling back', acquire_timeout_seconds)
        return None, None

    reset_worker = False
    try:
        process = runtime['process']
        conn = runtime['conn']

        try:
            conn.send(
                {
                    'image_bytes': image_bytes,
                    'model_id': model_id,
                    'configured_device': configured_device,
                    'image_size': image_size,
                    'use_half': use_half,
                    'preserve_aspect_ratio': preserve_aspect_ratio,
                    'pad_color': pad_color,
                }
            )
        except (BrokenPipeError, EOFError, OSError) as exc:
            logger.warning('[REMOVE-BG] BiRefNet worker unavailable: %s', exc)
            reset_worker = True
            return None, None

        result = None
        while time.monotonic() < deadline:
            remaining = max(0.0, deadline - time.monotonic())
            if conn.poll(min(_BIREFNET_POLL_INTERVAL_SECONDS, remaining)):
                try:
                    result = conn.recv()
                except (EOFError, OSError) as exc:
                    logger.warning('[REMOVE-BG] BiRefNet worker connection dropped: %s', exc)
                    reset_worker = True
                    return None, None
                break

            if not process.is_alive():
                logger.warning('[REMOVE-BG] BiRefNet worker exited before returning a result')
                reset_worker = True
                return None, None

        if result is None:
            logger.error('[REMOVE-BG] BiRefNet timed out after %ss; resetting worker', timeout_seconds)
            reset_worker = True
            return None, None

        if not result.get('ok'):
            logger.warning('[REMOVE-BG] BiRefNet worker failed: %s', result.get('error', 'unknown error'))
            reset_worker = True
            return None, None

        fg_img = Image.open(io.BytesIO(result['image_bytes'])).convert('RGBA')
        logger.info('[REMOVE-BG] BiRefNet success (%s)', model_id)
        return fg_img, result['engine']
    finally:
        _release_birefnet_worker(worker_index, runtime, reset=reset_worker)
