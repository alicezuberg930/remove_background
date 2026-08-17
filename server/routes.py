import io
import json
import os
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from app import _pil_to_bytes, remove_bg_birefnet
from utils import cuid_generator, interceptor, set_response, normalize_extension, image_bit_depth, job_directory, image_bit_depth, CLEANED_IMAGE_FILENAME, CLEANED_RESULTS_DIR, record_with_image_urls, is_valid_job_id, is_original_image_filename, image_media_type, image_response_headers

router = APIRouter()


@router.get('/health')
def health():
    return {'status': 'ok'}


@router.post('/remove-background')
async def remove_background(request: Request, image: UploadFile = File(...), model_id: str = Form(...)):
    if not model_id:
        set_response(
            request,
            message='model_id is required.',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail='model_id is required.')

    try:
        image_data = await image.read()
        if not image_data:
            raise ValueError('Uploaded image is empty')

        with Image.open(io.BytesIO(image_data)) as uploaded_img:
            uploaded_img.load()
            original_extension = normalize_extension(image.filename, uploaded_img.format)
            subject_img = uploaded_img.convert('RGBA')
            original_mode = uploaded_img.mode
            original_bytes = image_data
    except Exception as exc:
        set_response(
            request,
            message=f'Invalid image upload: {exc}',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail=f'Invalid image upload: {exc}') from exc
    finally:
        await image.close()

    original_size = len(original_bytes)
    original_bit_depth = image_bit_depth(original_mode)
    job_id = cuid_generator()
    job_dir = job_directory(job_id)
    original_filename = f'original.{original_extension}'
    original_path = os.path.join(job_dir, original_filename)
    cleaned_path = os.path.join(job_dir, CLEANED_IMAGE_FILENAME)
    job_path = os.path.join(job_dir, f'{job_id}.json')

    try:
        os.makedirs(job_dir, exist_ok=False)
        with open(original_path, 'wb') as handle:
            handle.write(original_bytes)

        fg_img, engine_used = remove_bg_birefnet(model_id, subject_img)
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
            bit_depth = image_bit_depth(output_image.mode)

        with open(cleaned_path, 'wb') as handle:
            handle.write(output_bytes)

        job_record = {
            'job_id': job_id,
            'cleaned_image': f'/cleaned_background_image/{job_id}/{CLEANED_IMAGE_FILENAME}',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'engine': engine_used,
            'width': width,
            'height': height,
            'bit_depth': bit_depth,
            'size': len(output_bytes),
            'original_image': f'/cleaned_background_image/{job_id}/{original_filename}',
            'original_size': original_size,
            'original_bit_depth': original_bit_depth,
            'original_extension': original_extension,
        }
        with open(job_path, 'w', encoding='utf-8') as handle:
            json.dump(job_record, handle, ensure_ascii=False)
    except HTTPException:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        set_response(
            request,
            message=f'Failed to process image: {exc}',
            status_code=500,
        )
        raise HTTPException(status_code=500, detail=f'Failed to process image: {exc}') from exc

    set_response(
        request,
        message='Background removed successfully.',
        status_code=200,
        data=record_with_image_urls(request, job_record),
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

    cleaned_results_dir = CLEANED_RESULTS_DIR
    if not os.path.isdir(cleaned_results_dir):
        set_response(
            request,
            message='No results found.',
            status_code=200,
        )
        return []

    results = []
    for entry in os.scandir(cleaned_results_dir):
        if not entry.is_dir(follow_symlinks=False) or not is_valid_job_id(entry.name):
            continue
        file_path = os.path.join(entry.path, f'{entry.name}.json')
        try:
            with open(file_path, 'r', encoding='utf-8') as handle:
                payload = json.load(handle)
        except (json.JSONDecodeError, OSError):
            continue
        if isinstance(payload, dict):
            results.append(record_with_image_urls(request, payload))

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


@router.get(
    '/cleaned_background_image/{job_id}/{filename}',
    name='cleaned_background_image',
)
def cleaned_background_image(request: Request, job_id: str, filename: str):
    is_original_image = is_original_image_filename(filename)
    if not is_valid_job_id(job_id) or (filename != CLEANED_IMAGE_FILENAME and not is_original_image):
        raise HTTPException(status_code=404, detail='Image not found.')

    job_dir = job_directory(job_id)
    image_path = os.path.join(job_dir, filename)
    if os.path.islink(job_dir) or os.path.islink(image_path) or not os.path.isfile(image_path):
        raise HTTPException(status_code=404, detail='Image not found.')

    return FileResponse(
        image_path,
        media_type=image_media_type(filename),
        headers=image_response_headers(request),
    )


@router.delete('/cleaned-backgrounds/{id}')
def delete_cleaned_background(id: str, request: Request):
    job_id = id.strip()
    if not is_valid_job_id(job_id):
        set_response(
            request,
            message='Invalid id path parameter.',
            status_code=400,
        )
        raise HTTPException(status_code=400, detail='Invalid id path parameter.')

    job_dir = job_directory(job_id)
    job_path = os.path.join(job_dir, f'{job_id}.json')
    if os.path.islink(job_dir) or not os.path.isfile(job_path):
        set_response(
            request,
            message=f'Cleaned background not found for id: {job_id}',
            status_code=404,
        )
        raise HTTPException(status_code=404, detail=f'Cleaned background not found for id: {job_id}')

    try:
        shutil.rmtree(job_dir)
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
