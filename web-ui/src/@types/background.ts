export type CleanedBackground = {
    job_id: string
    created_at: string
    cleaned_image: string
    engine: string
    width: number
    height: number
    bit_depth: number
    size: number
    original_image?: string
    original_size?: number
    original_bit_depth?: number
    original_extension?: string
}

export type BackgroundFilter = {
    page?: number
    page_size?: number
    sort?: string
}

export const models = new Map<string, string>([
    ["ZhengPeng7/BiRefNet", "BiRefNet - 0.2B"],
    ["ZhengPeng7/BiRefNet_HR", "BiRefNet_HR - 0.2B"],
    ["ZhengPeng7/BiRefNet-portrait", "BiRefNet-portrait - 0.2B"],
    ["ZhengPeng7/BiRefNet-matting", "BiRefNet-matting - 0.2B"],
    ["ZhengPeng7/BiRefNet_HR-matting", "BiRefNet_HR-matting - 0.2B"],
    ["ZhengPeng7/BiRefNet_dynamic", "BiRefNet_dynamic - 0.2B"],
    ["ZhengPeng7/BiRefNet_dynamic-matting", "BiRefNet_dynamic-matting - 0.2B"],
    ["ZhengPeng7/BiRefNet_lite", "BiRefNet_lite - 44.4M"],
    ["ZhengPeng7/BiRefNet_lite-2K", "BiRefNet_lite-2K - 44.4M"],
    ["ZhengPeng7/BiRefNet_lite-matting", "BiRefNet_lite-matting - 44.4M"],
    ["ZhengPeng7/BiRefNet-HRSOD", "BiRefNet-HRSOD - 0.2B"],
    ["ZhengPeng7/BiRefNet-DIS5K", "BiRefNet-DIS5K - 0.2B"],
    ["ZhengPeng7/BiRefNet-COD", "BiRefNet-COD - 0.2B"],
    ["ZhengPeng7/BiRefNet-legacy", "BiRefNet-legacy - 0.2B"],
    ["ZhengPeng7/BiRefNet-DIS5K-TR_TEs", "BiRefNet-DIS5K-TR_TEs - 0.2B"],
    ["ZhengPeng7/BiRefNet_512x512", "BiRefNet_512x512 - 0.2B"],
    ["../training/runs/group-matting/best", "Finetuned model - 0.2B"],
])

export const imageSizes = [
    "512",
    "1024",
    "2048",
]