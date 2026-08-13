export type Response<T = unknown> = {
    message: string
    data?: T
    statusCode?: number
}