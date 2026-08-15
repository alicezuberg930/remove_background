import base64
import io
import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, HTTPException, Request
from PIL import Image

from .app import RemoveBackgroundRequest, _decode_base64_image, _pil_to_bytes, remove_bg_birefnet
from .utils import cuid_generator, interceptor, set_response

router = APIRouter()


@router.get('/health')
def health():
    return {'status': 'ok'}


@router.post('/remove-background')
def remove_background(payload: RemoveBackgroundRequest, request: Request):
    try:
        image_data = _decode_base64_image(payload.image_base64)
        original_img = Image.open(io.BytesIO(image_data))
        subject_img = original_img.convert('RGBA')
    except Exception as exc:
        set_response(
            request,
            message=f'Invalid base64 image data: {exc}',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail=f'Invalid base64 image data: {exc}') from exc

    original_size = len(image_data)
    if original_img.mode == '1':
        original_bit_depth = 1
    elif original_img.mode.startswith('I;16'):
        original_bit_depth = 16
    elif original_img.mode in {'I', 'F'}:
        original_bit_depth = 32
    else:
        original_bit_depth = len(original_img.getbands()) * 8
    original_extension = (original_img.format or 'png').lower()

    fg_img, engine_used = remove_bg_birefnet(subject_img)

    if fg_img is None:
        set_response(
            request,
            message='Background removal failed for all configured engines.',
            status_code=503,
        )
        raise HTTPException(status_code=503, detail='Background removal failed for all configured engines.')

    output_bytes = _pil_to_bytes(fg_img, fmt='PNG')
    with Image.open(io.BytesIO(output_bytes)) as output_image:
        width, height = output_image.size
        if output_image.mode == '1':
            bit_depth = 1
        elif output_image.mode.startswith('I;16'):
            bit_depth = 16
        elif output_image.mode in {'I', 'F'}:
            bit_depth = 32
        else:
            bit_depth = len(output_image.getbands()) * 8

    cleaned_base64 = base64.b64encode(output_bytes).decode('ascii')
    cleaned_image = f'data:image/png;base64,{cleaned_base64}'
    job_id = cuid_generator()

    cleaned_results_dir = os.path.join('cleaned-results')
    os.makedirs(cleaned_results_dir, exist_ok=True)
    job_path = os.path.join(cleaned_results_dir, f'{job_id}.json')
    job_record = {
        'job_id': job_id,
        'cleaned_image': cleaned_image,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'engine': engine_used,
        'width': width,
        'height': height,
        'bit_depth': bit_depth,
        'size': len(output_bytes),
        'original_image': payload.image_base64,
        'original_size': original_size,
        'original_bit_depth': original_bit_depth,
        'original_extension': original_extension,
    }
    with open(job_path, 'w', encoding='utf-8') as handle:
        json.dump(job_record, handle, ensure_ascii=False)

    response_data = {
        'job_id': job_id,
        'cleaned_image': cleaned_image,
        'engine': engine_used,
        'original_image': payload.image_base64,
        'original_size': original_size,
        'original_bit_depth': original_bit_depth,
        'original_extension': original_extension,
    }
    set_response(
        request,
        message='Background removed successfully.',
        status_code=200,
        data=response_data,
    )


@router.get('/cleaned-backgrounds')
def cleaned_backgrounds(
    request: Request,
    page: int = 1,
    page_size: int = 100,
    sort: str = 'created_at_desc',
):
    if page < 1:
        set_response(
            request,
            message='Invalid page value. Use a positive integer.',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail='Invalid page value. Use a positive integer.')

    if page_size < 1:
        set_response(
            request,
            message='Invalid page_size value. Use a positive integer.',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail='Invalid page_size value. Use a positive integer.')

    cleaned_results_dir = os.path.join('cleaned-results')
    if not os.path.isdir(cleaned_results_dir):
        set_response(
            request,
            message='No results found.',
            status_code=200,
        )
        return []

    results = []
    for filename in os.listdir(cleaned_results_dir):
        if not filename.lower().endswith('.json'):
            continue
        file_path = os.path.join(cleaned_results_dir, filename)
        try:
            with open(file_path, 'r', encoding='utf-8') as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError):
            continue
        if isinstance(payload, dict):
            results.append(payload)

    if sort not in {'created_at_desc', 'created_at_asc'}:
        set_response(
            request,
            message='Invalid sort value. Use created_at_desc or created_at_asc.',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail='Invalid sort value. Use created_at_desc or created_at_asc.')

    reverse = sort == 'created_at_desc'
    try:
        results.sort(
            key=lambda item: item.get('created_at', ''),
            reverse=reverse,
        )
    except TypeError:
        results.sort(key=lambda item: str(item.get('created_at', '')), reverse=reverse)

    results_count = len(results)
    total_pages = (results_count + page_size - 1) // page_size if results_count else 0
    if page > max(1, total_pages):
        set_response(
            request,
            message='Page out of range.',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail='Page out of range.')

    start = (page - 1) * page_size
    end = start + page_size
    paged_items = results[start:end]
    set_response(
        request,
        message='Results fetched successfully.',
        status_code=200,
        data=paged_items,
        paginate={
            'page': page,
            'total_page': total_pages,
            'page_size': page_size,
        },
    )


@router.delete('/cleaned-backgrounds/{id}')
def delete_cleaned_background(request: Request):
    job_id = (request.path_params.get('id') or '').strip()
    if not job_id or '/' in job_id or '\\' in job_id:
        set_response(
            request,
            message='Invalid id path parameter.',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail='Invalid id path parameter.')

    cleaned_results_dir = os.path.join('cleaned-results')
    job_path = os.path.join(cleaned_results_dir, f'{job_id}.json')
    if not os.path.isfile(job_path):
        set_response(
            request,
            message=f'Cleaned background not found for id: {job_id}',
            status_code=404,
        )
        raise HTTPException(status_code=404, detail=f'Cleaned background not found for id: {job_id}')

    try:
        os.remove(job_path)
    except OSError as exc:
        set_response(
            request,
            message=f'Failed to delete cleaned background: {exc}',
            status_code=500,
        )
        raise HTTPException(status_code=500, detail=f'Failed to delete cleaned background: {exc}') from exc

    set_response(
        request,
        message='Cleaned background deleted successfully.',
        status_code=200,
    )


def register_routes(server: FastAPI):
    server.include_router(router)
    server.middleware('http')(interceptor)
