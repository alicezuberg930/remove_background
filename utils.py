import logging
import os
import secrets
import threading
import time

from fastapi import Request
from fastapi.responses import JSONResponse

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


def set_response(
    request: Request,
    *,
    message: str | None = None,
    status_code: int | None = None,
    data: object = _UNSET_RESPONSE_DATA,
) -> None:
    if message is not None:
        request.state.response_message = message

    if status_code is not None:
        request.state.response_status_code = int(status_code)

    if data is not _UNSET_RESPONSE_DATA:
        request.state.response_data = data


def build_envelope(
    request: Request,
    response: JSONResponse,
) -> dict[str, object]:
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

    envelope: dict[str, object] = {
        'statusCode': status_code,
        'message': message or '',
    }
    if explicit_data_set:
        envelope['data'] = explicit_data

    return envelope


async def interceptor(request: Request, call_next):
    if request.url.path.rstrip('/') != '/remove-background':
        return await call_next(request)

    try:
        response = await call_next(request)
    except Exception:
        logger.exception('[REMOVE-BG] Unhandled error in /remove-background')
        response = JSONResponse(status_code=500, content={'detail': 'Internal server error'})

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
