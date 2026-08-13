import logging
import os

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger('remove_background_service')
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO'))


_UNSET_RESPONSE_DATA = object()


def set_remove_bg_response(
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


def build_remove_background_envelope(
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


async def remove_background_interceptor(request: Request, call_next):
    if request.url.path.rstrip('/') != '/remove-background':
        return await call_next(request)

    try:
        response = await call_next(request)
    except Exception:
        logger.exception('[REMOVE-BG] Unhandled error in /remove-background')
        response = JSONResponse(status_code=500, content={'detail': 'Internal server error'})

    envelope = build_remove_background_envelope(request, response)
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
