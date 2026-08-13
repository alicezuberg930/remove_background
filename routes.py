import base64
import io

from fastapi import APIRouter, FastAPI, HTTPException, Request
from PIL import Image

from app import RemoveBackgroundRequest, _decode_base64_image, _pil_to_bytes, remove_bg_birefnet
from utils import remove_background_interceptor, set_remove_bg_response

router = APIRouter()


@router.get('/health')
def health():
    return {'status': 'ok'}

@router.post('/remove-background')
def remove_background(payload: RemoveBackgroundRequest, request: Request):
    try:
        image_data = _decode_base64_image(payload.image_base64)
        subject_img = Image.open(io.BytesIO(image_data)).convert('RGBA')
    except Exception as exc:
        set_remove_bg_response(
            request,
            message=f'Invalid base64 image data: {exc}',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail=f'Invalid base64 image data: {exc}') from exc

    fg_img, engine_used = remove_bg_birefnet(subject_img)

    if fg_img is None:
        set_remove_bg_response(
            request,
            message='Background removal failed for all configured engines.',
            status_code=503,
        )
        raise HTTPException(status_code=503, detail='Background removal failed for all configured engines.')

    output_bytes = _pil_to_bytes(fg_img, fmt='PNG')
    foreground_base64 = base64.b64encode(output_bytes).decode('ascii')
    response_data = {
        'foreground_image': f'data:image/png;base64,{foreground_base64}',
        'engine': engine_used,
    }
    set_remove_bg_response(
        request,
        message='Background removed successfully.',
        status_code=200,
        data=response_data,
    )
    return response_data


def register_routes(server: FastAPI):
    server.include_router(router)
    server.middleware('http')(remove_background_interceptor)
