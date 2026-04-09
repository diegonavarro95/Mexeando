# Frontend — Mexeando

> React 18 + Vite + Tailwind CSS + PWA  
> Interfaz principal para Turistas, Dueños de Negocio y Administradores.

---

## Stack

| Tecnología | Versión | Uso |
|---|---|---|
| React | 18.x | Framework UI |
| Vite | 5.x | Bundler + servidor de desarrollo |
| TypeScript | 5.x | Tipado estático |
| Tailwind CSS | 3.x | Estilos utility-first |
| React Router | 6.x | Enrutamiento SPA |
| Zustand | 4.x | Estado global |
| React Query | 5.x | Caché y sincronización de datos |
| i18next | 23.x | Internacionalización (ES, EN, FR, PT, DE, ZH) |
| Vite PWA Plugin | 0.x | Service Worker + Web App Manifest |
| Workbox | 7.x | Estrategias de caché offline |
| Socket.io-client | 4.x | WebSocket para chat IA |
| @supabase/supabase-js | 2.x | Auth OAuth en cliente |
| @googlemaps/js-api-loader | 1.x | Google Maps |
| qrcode | 1.x | Lector de QR (check-in turista) |

---

## Estructura de carpetas

```
frontend/
├── public/
│   ├── icons/                  # Íconos PWA: icon-192.png, icon-512.png
│   ├── manifest.json           # Web App Manifest
│   └── sw.js                   # Entry del Service Worker (generado por Vite)
│
├── src/
│   ├── assets/                 # Imágenes estáticas, fuentes
│   │
│   ├── components/             # Componentes reutilizables
│   │   ├── ui/                 # Átomos: Button, Input, Card, Modal, Badge, Spinner
│   │   ├── map/                # MapView, BusinessMarker, FilterChips, SearchBar
│   │   ├── passport/           # AlbumGrid, StampCard, PackOpenAnimation, PointsCounter
│   │   └── chat/               # ChatBubble, ChatInput, QuickReplies, TypingIndicator
│   │
│   ├── pages/
│   │   ├── tourist/
│   │   │   ├── ExplorePage.tsx       # Mapa principal con Índice Ola
│   │   │   ├── BusinessDetailPage.tsx# Detalle de negocio + chat IA
│   │   │   ├── CheckInPage.tsx       # Escaneo de QR
│   │   │   ├── PassportPage.tsx      # Álbum de estampas
│   │   │   ├── FeedPage.tsx          # Feed de actividad social
│   │   │   └── ProfilePage.tsx       # Perfil del turista
│   │   ├── owner/
│   │   │   ├── OnboardingPage.tsx    # Registro guiado por IA
│   │   │   ├── EditBusinessPage.tsx  # Editar perfil del negocio
│   │   │   └── DashboardPage.tsx     # Métricas del negocio
│   │   ├── admin/
│   │   │   ├── AdminDashboardPage.tsx# KPIs globales
│   │   │   └── BusinessReviewPage.tsx# Aprobar / rechazar negocios
│   │   └── auth/
│   │       ├── LoginPage.tsx
│   │       └── RegisterPage.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts          # Sesión y rol del usuario
│   │   ├── useMap.ts           # Ubicación GPS + negocios cercanos
│   │   ├── useChat.ts          # Conexión Socket.io al chat IA
│   │   ├── usePassport.ts      # Puntos, sobres y álbum
│   │   └── useOffline.ts       # Estado de conexión + sync pendiente
│   │
│   ├── store/
│   │   ├── authStore.ts        # Usuario autenticado y rol
│   │   ├── mapStore.ts         # Negocios cargados + filtros activos
│   │   └── passportStore.ts    # Puntos y estampas del turista
│   │
│   ├── services/
│   │   ├── api.ts              # Cliente Axios con interceptor JWT
│   │   ├── businessService.ts  # Llamadas a /api/v1/businesses
│   │   ├── passportService.ts  # Llamadas a /api/v1/passport
│   │   ├── reviewService.ts    # Llamadas a /api/v1/reviews
│   │   └── adminService.ts     # Llamadas a /api/v1/admin
│   │
│   ├── lib/
│   │   ├── indexedDB.ts        # Helpers para leer/escribir offline data
│   │   ├── qr.ts               # Generación y lectura de QR
│   │   └── geo.ts              # Cálculo de distancias Haversine
│   │
│   ├── i18n/
│   │   ├── index.ts            # Configuración de i18next
│   │   ├── es.json
│   │   ├── en.json
│   │   ├── fr.json
│   │   ├── pt.json
│   │   ├── de.json
│   │   └── zh.json
│   │
│   ├── sw/
│   │   └── strategies.ts       # Estrategias Workbox: Cache First, Network First, SWR
│   │
│   ├── types/
│   │   ├── business.ts
│   │   ├── user.ts
│   │   ├── passport.ts
│   │   └── api.ts              # Tipos de respuesta de la API
│   │
│   ├── App.tsx                 # Router principal + providers
│   └── main.tsx                # Entry point
│
├── .env                        # Variables locales (no commitear)
├── .env.example                # Plantilla de variables (sí commitear)
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md                   
```

---

## Variables de entorno

Guía para instalación en caso de volver la repo pública.

Copiar `.env.example` a `.env` y rellena los valores:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GOOGLE_MAPS_API_KEY=your-maps-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

> Todas las variables del frontend deben empezar con `VITE_` para que Vite las exponga al cliente.

---

## Comandos

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (localhost:5173)
npm run dev

# Build de producción (genera /dist con PWA optimizada)
npm run build

# Previsualizar el build localmente
npm run preview

# Lint
npm run lint

# Verificar tipos TypeScript
npm run typecheck
```

---

## Paleta de colores

Definida en `tailwind.config.ts` como colores personalizados:

| Variable | Valor | Uso |
|---|---|---|
| `rojo` | `#C1121F` | Acciones primarias, headers de sección |
| `amarillo` | `#F4A300` | Acentos, puntos, calificaciones |
| `verde` | `#2D6A4F` | Estados positivos, turista |
| `verdeLight` | `#52B788` | Badges de verificación |
| `naranja` | `#E85D04` | Dueño de negocio |
| `bgDark` | `#110800` | Fondo principal |
| `crema` | `#FFF3DC` | Texto principal sobre fondo oscuro |

---

## Estrategia PWA y offline

| Recurso | Estrategia | TTL caché |
|---|---|---|
| JS, CSS, fuentes, íconos | Cache First | Indefinido (hasta nueva versión) |
| Listados de negocios (`/businesses`) | Network First | 10 minutos |
| Perfil individual (`/businesses/:id`) | Stale-While-Revalidate | 5 minutos |
| 50 negocios más cercanos (IndexedDB) | Cache Only cuando offline | Hasta nueva ubicación |
| Chat IA, notificaciones | Network Only | No aplica |

---

## Rutas de la aplicación

```
/                       → Redirect según rol
/explore                → Mapa principal (Turista)
/business/:id           → Detalle de negocio
/checkin                → Escaneo de QR
/passport               → Álbum de estampas
/feed                   → Feed de actividad
/profile                → Perfil del turista
/owner/onboarding       → Registro guiado por IA (Dueño)
/owner/edit             → Editar negocio
/owner/dashboard        → Métricas del negocio
/admin                  → Panel de administración
/login                  → Inicio de sesión
```

---

*Abstractos F.C. · Talent Land 2026*
