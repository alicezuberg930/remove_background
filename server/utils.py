import logging
import os
import secrets
import threading
import time
from typing import Any, Dict, TypedDict
from PIL import Image

from fastapi import Request
from fastapi.responses import JSONResponse

from env import load_server_env

load_server_env()

logger = logging.getLogger('remove_background_service')
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO'))

_CUID_COUNTER = 0
_CUID_COUNTER_LOCK = threading.Lock()


def _to_base36(value: int) -> str:
    if value == 0:
        return '0'

    alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
    result = []
    current = value
    while current > 0:
        current, remainder = divmod(current, 36)
        result.append(alphabet[remainder])

    return ''.join(reversed(result))


def cuid_generator() -> str:
    """Generate a time-based, collision-resistant ID."""
    timestamp_ms = int(time.time() * 1000)

    with _CUID_COUNTER_LOCK:
        global _CUID_COUNTER
        _CUID_COUNTER = (_CUID_COUNTER + 1) % (1 << 16)
        counter = _CUID_COUNTER

    random_suffix = _to_base36(secrets.randbits(48))
    pid_suffix = _to_base36(os.getpid() % 10000)
    return f"c{_to_base36(timestamp_ms)}{_to_base36(counter).zfill(4)}{pid_suffix}{random_suffix}"


_UNSET_RESPONSE_DATA = object()

class PaginateMetadata(TypedDict):
    page: int
    total_page: int
    page_size: int


def set_response(
    request: Request,
    *,
    message: str | None = None,
    status_code: int | None = None,
    data: object = _UNSET_RESPONSE_DATA,
    paginate: PaginateMetadata | None = None,
) -> None:
    if message is not None:
        request.state.response_message = message

    if status_code is not None:
        request.state.response_status_code = int(status_code)

    if data is not _UNSET_RESPONSE_DATA:
        request.state.response_data = data

    if paginate is not None:
        request.state.response_paginate = paginate   


def build_envelope(
    request: Request,
    response: JSONResponse,
) -> Dict[str, Any]:
    # Keep compatibility with older type checkers by avoiding
    # newer builtin generic dict expression forms.
    status_code = getattr(request.state, 'response_status_code', None)
    if isinstance(status_code, int):
        status_code = int(status_code)
    else:
        status_code = response.status_code

    explicit_message = getattr(request.state, 'response_message', None)
    explicit_data_set = hasattr(request.state, 'response_data')
    explicit_data = getattr(request.state, 'response_data', _UNSET_RESPONSE_DATA)

    message = explicit_message
    if message is None:
        message = 'Success' if status_code < 400 else 'Request failed'

    envelope: Dict[str, Any] = {
        'statusCode': status_code,
        'message': message or '',
    }
    if explicit_data_set:
        envelope['data'] = explicit_data
    if hasattr(request.state, 'response_paginate'):
        envelope['paginate'] = request.state.response_paginate
        delattr(request.state, 'response_paginate')

    return envelope


async def interceptor(request: Request, call_next):
    try:
        response = await call_next(request)
    except Exception:
        logger.exception('[REMOVE-BG] Unhandled error in /remove-background')
        response = JSONResponse(status_code=500, content={'detail': 'Internal server error'})

    if response.headers.get('content-type', '').lower().startswith('image/'):
        return response

    envelope = build_envelope(request, response)
    wrapped_headers = {
        name: value
        for name, value in response.headers.items()
        if name.lower() not in {'content-type', 'content-length'}
    }
    return JSONResponse(
        status_code=response.status_code,
        content=envelope,
        headers=wrapped_headers,
    )


CLEANED_RESULTS_DIR = 'cleaned-results'
CLEANED_IMAGE_FILENAME = 'cleaned.png'
CORS_ALLOWED_ORIGINS = (
    'http://localhost:5173',
    'http://127.0.0.1:5173',
)
IMAGE_MEDIA_TYPES = {
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.webp': 'image/webp',
}


def is_valid_job_id(job_id: str) -> bool:
    return bool(job_id) and job_id.isalnum()


def job_directory(job_id: str) -> str:
    return os.path.join(CLEANED_RESULTS_DIR, job_id)


def image_bit_depth(mode: str) -> int:
    if mode == '1':
        return 1
    if mode.startswith('I;16'):
        return 16
    if mode in {'I', 'F'}:
        return 32
    return Image.getmodebands(mode) * 8


def normalize_extension(filename: str | None, detected_format: str | None) -> str:
    base_name = (filename or '').strip()
    _, ext = os.path.splitext(base_name)
    ext = ext[1:].strip().lower()
    if ext and ext.replace('_', '').replace('-', '').isalnum():
        return ext
    if detected_format and detected_format.isalpha():
        return detected_format.lower()
    return 'png'


def is_original_image_filename(filename: str) -> bool:
    name, ext = os.path.splitext(filename)
    return name == 'original' and bool(ext) and ext[1:].isalnum()


def image_media_type(filename: str) -> str:
    return IMAGE_MEDIA_TYPES.get(os.path.splitext(filename)[1].lower(), 'application/octet-stream')


def image_response_headers(request: Request) -> dict[str, str]:
    headers = {'Cache-Control': 'public, max-age=31536000, immutable'}
    origin = request.headers.get('origin')
    if origin in CORS_ALLOWED_ORIGINS:
        headers['Access-Control-Allow-Origin'] = origin
        headers['Access-Control-Allow-Credentials'] = 'true'
        headers['Vary'] = 'Origin'
    return headers


def extract_original_filename(record: dict) -> str:
    original_image = str(record.get('original_image')).strip()
    filename = os.path.basename(original_image)
    if is_original_image_filename(filename):
        return filename
    original_extension = str(record.get('original_extension', 'png')).lower()
    return f'original.{original_extension or "png"}'


def record_with_image_urls(request: Request, record: dict) -> dict:
    response_record = dict(record)
    job_id = str(record.get('job_id'))
    if is_valid_job_id(job_id):
        original_filename = extract_original_filename(record)
        response_record['original_image'] = str(
            request.url_for('cleaned_background_image', job_id=job_id, filename=original_filename)
        )
        response_record['cleaned_image'] = str(
            request.url_for('cleaned_background_image', job_id=job_id, filename=CLEANED_IMAGE_FILENAME)
        )
    return response_record
