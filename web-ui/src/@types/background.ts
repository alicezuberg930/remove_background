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

export const models = new Map<string, string>([
    ["ZhengPeng7/BiRefNet", "ZhengPeng7 - BiRefNet"],
    ["ZhengPeng7/BiRefNet_HR", "ZhengPeng7 - BiRefNet_HR"],
    ["ZhengPeng7/BiRefNet-portrait", "ZhengPeng7 - BiRefNet-portrait"],
    ["ZhengPeng7/BiRefNet-matting", "ZhengPeng7 - BiRefNet-matting"],
    ["ZhengPeng7/BiRefNet_HR-matting", "ZhengPeng7 - BiRefNet_HR-matting"],
    ["ZhengPeng7/BiRefNet_dynamic", "ZhengPeng7 - BiRefNet_dynamic"],
    ["ZhengPeng7/BiRefNet_dynamic-matting", "ZhengPeng7 - BiRefNet_dynamic-matting"],
    ["ZhengPeng7/BiRefNet_lite", "ZhengPeng7 - BiRefNet_lite"],
    ["ZhengPeng7/BiRefNet_lite-2K", "ZhengPeng7 - BiRefNet_lite-2K"],
    ["ZhengPeng7/BiRefNet_lite-matting", "ZhengPeng7 - BiRefNet_lite-matting"],
    ["ZhengPeng7/BiRefNet-HRSOD", "ZhengPeng7 - BiRefNet-HRSOD"],
    ["ZhengPeng7/BiRefNet-DIS5K", "ZhengPeng7 - BiRefNet-DIS5K"],
    ["ZhengPeng7/BiRefNet-COD", "ZhengPeng7 - BiRefNet-COD"],
    ["ZhengPeng7/BiRefNet-legacy", "ZhengPeng7 - BiRefNet-legacy"],
    ["ZhengPeng7/BiRefNet-DIS5K-TR_TEs", "ZhengPeng7 - BiRefNet-DIS5K-TR_TEs"],
    ["ZhengPeng7/BiRefNet_512x512", "ZhengPeng7 - BiRefNet_512x512"],
    ["../training/runs/group-matting/best", "finetuned model"],
])
