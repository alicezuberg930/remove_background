import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { ReactNode } from 'react'
import { RouterProvider as RP } from '@tanstack/react-router'
import { ResultProvider } from './result-provider'
import { HomePage } from '@/pages/home'
import { ResultPage } from '@/pages/result'

const RootLayout = ({ children }: { children?: ReactNode }) => (
    <div className="min-h-screen bg-slate-950 text-slate-100">
        <main className="mx-auto w-full max-w-6xl px-4 py-6">
            <ResultProvider>{children}</ResultProvider>
        </main>
    </div>
)

const rootRoute = createRootRoute({
    component: () => (
        <RootLayout>
            <Outlet />
        </RootLayout>
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