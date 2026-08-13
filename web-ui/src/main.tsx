import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RouterProvider from './providers/router-provider'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <RouterProvider />
  </StrictMode>,
)
