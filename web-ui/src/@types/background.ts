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
