// src/main.tsx
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n' 
import App from './App.tsx'
import { initAuth } from './services/initAuth'

const updateSW = registerSW({
  immediate: false,
  onNeedRefresh() {
    const shouldUpdate = window.confirm(
      'Hay una nueva version disponible de la app. ¿Quieres actualizar ahora?'
    )

    if (shouldUpdate) {
      void updateSW(true)
    }
  },
})
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Evita recargar el mapa al cambiar de pestaña
      retry: 2,                    // Reintentos automáticos si el internet parpadea
      staleTime: 1000 * 60 * 5,    // La data se considera fresca por 5 minutos
    },
  },
})

function BootApp() {
  useEffect(() => {
    void initAuth().catch((error) => {
      console.error('Error durante la inicialización de auth:', error)
    })
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('No se encontró el elemento root')
}

createRoot(rootElement).render(<BootApp />)
