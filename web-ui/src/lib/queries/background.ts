import { mutationOptions, queryOptions } from '@tanstack/react-query'
import type { ApiResponse, BackgroundFilter, CleanedBackground } from '@/@types'
import { queryClient } from '@/providers/query-client-provider'
import { httpClient } from '../repository/http-client'

const keys = {
    all: (opts: BackgroundFilter) => ['posts', opts],
    one: (id: string) => ['posts', id],
    create: () => ['posts', 'create'],
    update: () => ['posts', 'update'],
    delete: () => ['posts', 'delete'],
}

export const backgrounds = () => ({
    all: {
        queryKey: keys.all,
        queryOptions: (opts: BackgroundFilter = {}) =>
            queryOptions({
                queryKey: keys.all(opts),
                queryFn: async () => {
                    const data = await httpClient.get<ApiResponse<CleanedBackground[]>>('/cleaned-backgrounds', opts)
                    return data
                },
            }),
    },

    one: {
        queryKey: keys.one,
        queryOptions: (id: string) =>
            queryOptions({
                queryKey: keys.one(id),
                queryFn: async () => {
                    const { data } = await httpClient.get<ApiResponse<CleanedBackground>>(`/cleaned-backgrounds/${id}`)
                    return data
                },
            }),
    },

    create: {
        mutationKey: keys.create,
        mutationOptions: () =>
            mutationOptions({
                mutationKey: keys.create(),
                mutationFn: async (form: FormData) => {
                    return await httpClient.post<ApiResponse>('/cleaned-backgrounds', form)
                },
                onSuccess: () => {
                    queryClient().invalidateQueries({ queryKey: keys.all({}) })
                },
            }),
    },

    delete: {
        mutationKey: keys.delete,
        mutationOptions: () =>
            mutationOptions({
                mutationKey: keys.delete(),
                mutationFn: async (id: string) => {
                    return await httpClient.delete<ApiResponse>(`/cleaned-backgrounds/${id}`)
                },
                onSuccess: () => {
                    queryClient().invalidateQueries({ queryKey: keys.all({}) })
                },
            }),
    },
})
