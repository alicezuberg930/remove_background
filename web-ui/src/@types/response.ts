export type Response<T = unknown> = {
    message: string
    data?: T
    statusCode?: number
    paginate?: {
        page: number
        total_page: number
        page_size: number
    }
}