import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RouterProvider from './providers/router-provider'
import { Toaster } from './components/ui/sonner'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <RouterProvider />
    <Toaster />
  </StrictMode>,
)
