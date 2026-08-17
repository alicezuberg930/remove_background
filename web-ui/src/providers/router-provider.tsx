import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { RouterProvider as RP } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { PageNotFoundIllustration, SeverErrorIllustration } from '@/lib/illustrations'
import { HomePage } from '@/pages/home'
import { ResultPage } from '@/pages/result'

const RouterErrorPage = ({ error, reset }: ErrorComponentProps) => (
    <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-xl text-center">
            <SeverErrorIllustration className="mx-auto h-64 max-w-full" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error.message || 'Unable to render this page.'}</p>
            <div className="mt-6 flex justify-center gap-2">
                <Button type="button" variant="outline" onClick={reset}>
                    Try again
                </Button>
                <Button type="button" onClick={() => window.location.assign('/')}>
                    Go home
                </Button>
            </div>
        </div>
    </div>
)

const RouterNotFoundPage = () => (
    <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-xl text-center">
            <PageNotFoundIllustration className="mx-auto h-64 max-w-full" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">The requested page does not exist.</p>
            <Button type="button" className="mt-6" onClick={() => window.location.assign('/')}>
                Go home
            </Button>
        </div>
    </div>
)

const rootRoute = createRootRoute({
    component: () => (
        <div className="h-screen w-full">
            <Outlet />
        </div>
    ),
    errorComponent: RouterErrorPage,
    notFoundComponent: RouterNotFoundPage,
})

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomePage,
})

const resultRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/result/$id',
    component: ResultPage,
})

const routeTree = rootRoute.addChildren([indexRoute, resultRoute])

export const router = createRouter({
    routeTree,
    defaultNotFoundComponent: RouterNotFoundPage,
})

export default function RouterProvider() {
    return (
        <RP router={router} />
    )
}
