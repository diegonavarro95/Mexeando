# La Ruta de la Garnacha

> **Progressive Web App** que conecta a turistas del Mundial FIFA 2026 con los micronegocios locales mexicanos certificados por el programa **Ola México**.  
> Hackathon Talent Land 2026 — Track: *Cancha justa en el mundial para los negocios turísticos locales*  
> Equipo: **Abstractos F.C.**

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Arquitectura del sistema](#arquitectura-del-sistema)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Variables de entorno](#variables-de-entorno)
- [Comandos clave](#comandos-clave)
- [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)
- [Equipo](#equipo)

---

## Descripción

**La Ruta de la Garnacha** es una PWA accesible desde cualquier navegador vía código QR. Sus pilares principales son:

- **Mapa inteligente** con algoritmo de scoring propio (*Índice Ola*)
- **Asistente IA multilingüe** disponibilidad multilingüe (Gemini Flash)
- **Pasaporte del Mundial** — sistema de recompensas gamificado con álbum de estampas coleccionables
- **Registro guiado por IA** para dueños de negocios sin experiencia digital
- **Modo offline** funcional para zonas con red saturada durante el torneo

**Tres tipos de usuario:** Turista · Dueño de Negocio · Administrador Ola México

---

## Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA 1 — CLIENTE (PWA)                   │
│         React 18 + Vite + Tailwind + Workbox                │
│    Turista (navegador/QR) │ Dueño (navegador) │ Admin       │
└─────────────────┬───────────────────────────────────────────┘
                  │  HTTPS + WebSocket (TLS 1.3)
┌─────────────────▼───────────────────────────────────────────┐
│                 CAPA 2 — API / LÓGICA                       │
│    Node.js 20 + Hono + TypeScript + Zod + Socket.io         │
│    REST /api/v1/  │  WebSocket (chat IA)  │  Índice Ola     │
└─────────────────┬───────────────────────────────────────────┘
                  │  Supabase SDK + REST interno
┌─────────────────▼───────────────────────────────────────────┐
│              CAPA 3 — DATOS Y ALMACENAMIENTO                │
│   Supabase (PostgreSQL 15 + Auth + Storage)  │  Redis       │
│   IndexedDB (offline local)  │  GitHub Actions CI/CD        │
└─────────────────┬───────────────────────────────────────────┘
                  │  SDK calls / HTTP
┌─────────────────▼───────────────────────────────────────────┐
│                CAPA 4 — APIs EXTERNAS                       │
│  Google Maps  │  Gemini Flash  │  DeepL  │  Web Push VAPID  │
└─────────────────────────────────────────────────────────────┘
```

---

## Estructura del repositorio

```
la-ruta-de-la-garnacha/
│
├── frontend/                   # React 18 + Vite PWA
│   ├── public/
│   │   ├── icons/              # Íconos PWA (192x192, 512x512)
│   │   └── manifest.json       # Web App Manifest
│   ├── src/
│   │   ├── assets/             # Imágenes, fuentes
│   │   ├── components/         # Componentes reutilizables
│   │   │   ├── ui/             # Botones, inputs, cards, modales
│   │   │   ├── map/            # Componentes del mapa
│   │   │   ├── passport/       # Álbum de estampas y Pasaporte
│   │   │   └── chat/           # Asistente IA
│   │   ├── pages/              # Vistas principales
│   │   │   ├── tourist/        # Flujo del turista
│   │   │   ├── owner/          # Flujo del dueño
│   │   │   └── admin/          # Panel de administración
│   │   ├── hooks/              # Custom hooks (useMap, useAuth, etc.)
│   │   ├── store/              # Estado global con Zustand
│   │   ├── services/           # Llamadas a la API y servicios externos
│   │   ├── lib/                # Utilidades y helpers
│   │   ├── i18n/               # Archivos de traducción
│   │   │   ├── es.json
│   │   │   ├── en.json
│   │   │   └── ...
│   │   ├── sw/                 # Lógica del Service Worker
│   │   └── types/              # Tipos TypeScript compartidos
│   ├── .env.example
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md
│
├── backend/                    # Node.js 20 + Hono + TypeScript
│   ├── src/
│   │   ├── routes/             # Endpoints REST organizados por recurso
│   │   │   ├── auth.ts
│   │   │   ├── businesses.ts
│   │   │   ├── reviews.ts
│   │   │   ├── passport.ts     # Lógica de puntos y estampas
│   │   │   ├── translate.ts
│   │   │   └── admin.ts
│   │   ├── middleware/         # Auth JWT, rate limiting, RBAC
│   │   ├── services/           # Lógica de negocio desacoplada
│   │   │   ├── indiceOla.ts    # Algoritmo de scoring
│   │   │   ├── stamps.ts       # Sistema de probabilidad garantizada
│   │   │   ├── ai.ts           # Gemini + onboarding
│   │   │   └── translation.ts  # DeepL
│   │   ├── workers/            # Jobs de BullMQ
│   │   ├── db/                 # Queries y tipos de Supabase
│   │   ├── lib/                # Redis, clientes externos
│   │   └── index.ts            # Entrada principal
│   ├── .env.example
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md
│
├── .github/
│   └── workflows/
│       ├── frontend-deploy.yml
│       └── backend-deploy.yml
│
├── docs/                       # Documentación del proyecto
│   ├── TECH_STACK.md
│   ├── TIMELINE.md
│   ├── arquitectura-diagrama.png
│   └── db-schema.md
│
├── .gitignore
└── README.md                  
```

---

## Requisitos previos

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org |
| npm | 10.x | Incluido con Node.js |
| Git | 2.40+ | https://git-scm.com |
| Cuenta Supabase | — | https://supabase.com |
| Cuenta Vercel | — | https://vercel.com |
| Cuenta Railway | — | https://railway.app |

---

## Instalación y configuración
Guía para instalar en caso de volver el repositorio público en el futuro.

### 1. Clonar el repositorio

```bash
git clone https://github.com/abstractos-fc/la-ruta-de-la-garnacha.git
cd la-ruta-de-la-garnacha
```

### 2. Configurar el backend

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con las variables correspondientes
npm run dev
```

### 3. Configurar el frontend

```bash
cd frontend
npm install
cp .env.example .env
# Editar .env con las variables correspondientes
npm run dev
```

---

## Variables de entorno

### Backend — `backend/.env`

```env
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://xxxxxxxxxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# IA
GEMINI_API_KEY=your-gemini-key
DEEPL_API_KEY=your-deepl-key

# Auth
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key

# Web Push VAPID
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:team@abstractosfc.dev

# App
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
```

### Frontend — `frontend/.env`

```env
# API
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# Supabase (solo anon key en el cliente)
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Maps
VITE_GOOGLE_MAPS_API_KEY=your-maps-key

# Web Push
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

> Nota para el equipo de desarrollo: **Nunca** subir archivos `.env` al repositorio. Solo `.env.example` con valores vacíos.

---

## Comandos clave

### Desarrollo

```bash
# Backend — servidor con hot reload
cd backend && npm run dev

# Frontend — servidor de desarrollo Vite
cd frontend && npm run dev

# Ambos en paralelo (desde la raíz, requiere concurrently)
npm run dev
```

### Build y producción

```bash
# Frontend — genera el build optimizado para PWA
cd frontend && npm run build

# Frontend — previsualizar el build localmente
cd frontend && npm run preview

# Backend — compilar TypeScript
cd backend && npm run build

# Backend — ejecutar compilado
cd backend && npm start
```

### Calidad de código

```bash
# Lint
npm run lint

# Tipos TypeScript
npm run typecheck

# Tests (cuando estén disponibles)
npm run test
```

### Supabase

```bash
# Instalar CLI de Supabase
npm install -g supabase

# Iniciar Supabase local (opcional para desarrollo)
supabase start

# Ver estado
supabase status

# Aplicar migraciones
supabase db push
```

---

## Flujo de trabajo con Git

### Ramas

```
main          ← producción, solo merge via PR aprobado
develop       ← integración, base para todas las features
feature/*     ← desarrollo de funcionalidades
fix/*         ← corrección de bugs
```

### Convención de commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(mapa): agregar algoritmo Índice Ola con 5 variables
fix(auth): corregir expiración de refresh token
chore(deps): actualizar Hono a 4.x
docs(readme): agregar sección de variables de entorno
refactor(passport): separar lógica de probabilidad en servicio propio
```

### Proceso de PR

1. Crear rama desde `develop`: `git checkout -b feature/nombre-feature`
2. Hacer commits con la convención establecida
3. Abrir PR hacia `develop` con descripción de los cambios
4. Revisión de al menos **1 integrante** antes de hacer merge
5. Merge a `main` solo cuando el módulo esté completamente funcional

---

## Equipo

| Integrante | Rol | Área principal |
|---|---|---|
| Navarro Arellano Diego Emiliano | Backend Lead | API, base de datos, algoritmo Índice Ola |
| Romero Bautista Demian | Product Owner | Coordinación, integración, pitch |
| Rodríguez Guarneros Héctor Daniel| Algoritmos e IA | Pasaporte, Gemini, onboarding conversacional |
| Fernández Anguiano Guillermo Jesús | Frontend Lead | PWA, React, Google Maps, UI |
| Pueblita Bautista Patrick Guillermo | Full-stack / QA | APIs externas, dashboards, testing |

---

*Talent Land 2026 · Track: Cancha justa en el mundial para los negocios turísticos locales · Abstractos F.C.*
