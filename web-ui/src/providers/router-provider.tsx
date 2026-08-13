import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { RouterProvider as RP } from '@tanstack/react-router'
import { ResultProvider } from './result-provider'
import { HomePage } from '@/pages/home'
import { ResultPage } from '@/pages/result'

const rootRoute = createRootRoute({
    component: () => (
        <div className="h-screen w-full p-3">
            <ResultProvider>
                <Outlet />
            </ResultProvider>
        </div>
    ),
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

export const router = createRouter({ routeTree })

export default function RouterProvider() {
    return (
        <RP router={router} />
    )
}
