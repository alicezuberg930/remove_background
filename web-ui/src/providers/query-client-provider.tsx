import {
    defaultShouldDehydrateQuery,
    QueryCache,
    QueryClient,
    QueryClientProvider as QCP,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { HttpError } from '@/lib/repository/http-error'
import { showResponseError } from '@/lib/utils'

const createQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: (failureCount, error) => {
                // eslint-disable-next-line no-console
                if (import.meta.env.DEV) console.log({ failureCount, error })
                if (failureCount >= 0 && import.meta.env.DEV) return false
                if (failureCount > 3 && import.meta.env.PROD) return false
                return !(error instanceof HttpError && [401, 403].includes(error.status ?? 0))
            },
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 60 * 60 * 1000, // 60 minutes
            gcTime: 1000 * 60 * 60 * 1, // 1 hours (must be >= maxAge for persister)
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnWindowFocus: false, // Disable refetch on window focus
            refetchOnReconnect: true, // Refetch when internet reconnects
            refetchOnMount: true, // Refetch when component mounts if data is stale
        },
        mutations: {
            onError: (error) => {
                console.log(error instanceof HttpError)
                if (error instanceof HttpError) {
                    if (error.status === 304) {
                        toast.error('Content not modified!')
                    }
                    toast.error(error.message)
                }
            },
        },
        dehydrate: {
            shouldDehydrateQuery: (query) =>
                defaultShouldDehydrateQuery(query) ||
                query.state.status === 'pending',
        },
        hydrate: {},
    },
    queryCache: new QueryCache({
        onError: (error) => {
            showResponseError(error)
        },
    }),
})

let clientQueryClientSingleton: QueryClient | undefined = undefined

const queryClient = () => {
    // Server: always return a new query client
    if (typeof globalThis === 'undefined') return createQueryClient()
    // Browser: reuse singleton to avoid creating new clients on every request
    clientQueryClientSingleton ??= createQueryClient()
    return clientQueryClientSingleton
}

const QueryClientProvider = ({ children }: { children: React.ReactNode }) => {
    return <QCP client={queryClient()}>{children}</QCP>
}

export { QueryClientProvider, queryClient }