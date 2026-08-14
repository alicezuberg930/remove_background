import base64
import io
import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, HTTPException, Request
from PIL import Image

from app import RemoveBackgroundRequest, _decode_base64_image, _pil_to_bytes, remove_bg_birefnet
from utils import cuid_generator, interceptor, set_response

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
        set_response(
            request,
            message=f'Invalid base64 image data: {exc}',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail=f'Invalid base64 image data: {exc}') from exc

    fg_img, engine_used = remove_bg_birefnet(subject_img)

    if fg_img is None:
        set_response(
            request,
            message='Background removal failed for all configured engines.',
            status_code=503,
        )
        raise HTTPException(status_code=503, detail='Background removal failed for all configured engines.')

    output_bytes = _pil_to_bytes(fg_img, fmt='PNG')
    foreground_base64 = base64.b64encode(output_bytes).decode('ascii')
    foreground_image = f'data:image/png;base64,{foreground_base64}'
    job_id = cuid_generator()

    cleaned_results_dir = os.path.join('server', 'cleaned-results')
    os.makedirs(cleaned_results_dir, exist_ok=True)
    job_path = os.path.join(cleaned_results_dir, f'{job_id}.json')
    job_record = {
        'job_id': job_id,
        'foreground_image': foreground_image,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'engine': engine_used,
    }
    with open(job_path, 'w', encoding='utf-8') as handle:
        json.dump(job_record, handle, ensure_ascii=False)

    response_data = {
        'cuid': job_id,
        'foreground_image': foreground_image,
        'engine': engine_used,
    }
    set_response(
        request,
        message='Background removed successfully.',
        status_code=200,
        data=response_data,
    )
    return response_data


def register_routes(server: FastAPI):
    server.include_router(router)
    server.middleware('http')(interceptor)
