# Backend — Mexeando

> **Plataforma Integral de Turismo Gastronómico y Gamificación — Mundial FIFA 2026**
>
> Arquitectura orientada a servicios basada en **Node.js 20+**, **Hono**, y **TypeScript**. Diseñada para alta concurrencia, implementa una API RESTful, WebSockets para mensajería IA bidireccional, colas de trabajo distribuidas (BullMQ) y rutinas de evaluación geoespacial delegadas directamente al motor de base de datos.

---

## Stack Tecnológico

| Tecnología | Versión | Propósito Arquitectónico |
|---|---|---|
| **Node.js** | 20 LTS | Entorno de ejecución principal (Runtime). |
| **Hono** | 4.x | Micro-framework web ultraligero (~12 KB) optimizado para *Edge* y alta concurrencia. |
| **TypeScript** | 5.x | Tipado estático estricto para garantizar contratos de datos (Domain Driven Design). |
| **Zod** | 3.x | Validación de esquemas en tiempo de ejecución (`@hono/zod-validator`). |
| **Socket.io** | 4.x | Conexiones TCP persistentes para interacciones fluidas con IA en tiempo real. |
| **BullMQ** | 5.x | Encolamiento de tareas pesadas en segundo plano y procesamiento asíncrono. |
| **Supabase** | 2.x | ORM/Cliente para PostgreSQL, Auth y Storage con *Service Role Key*. |
| **Redis** | 7.x | Memoria caché (Upstash) y Message Broker para colas de BullMQ. |
| **Google GenAI** | 0.x | SDK nativo de **Gemini 2.5 Flash** (RAG, Análisis de Intents y Onboarding). |
| **DeepL API** | 2.x | Traducción neuronal multilingüe con patrón *Cache-Aside* en Redis. |
| **web-push** | 3.x | Criptografía VAPID para notificaciones asíncronas *Server-to-Client*. |
| **jose** | 5.x | Emisión y verificación algorítmica de JSON Web Tokens (JWT) sin estado. |

---

## Algoritmos Core y Lógica de Negocio

Este backend trasciende las operaciones CRUD básicas, implementando motores de decisión complejos evaluados en tiempo real.

### 1. Índice Ola (Motor de Recomendación Geoespacial Contextual)

Define la relevancia y el orden de aparición de los negocios en el mapa del turista. Para evitar la saturación de memoria (OOM) en Node.js, **el cálculo se ejecuta 100% dentro de PostgreSQL** (`fn_indice_ola`) utilizando funciones de `PostGIS` (`ST_DWithin`, `ST_Distance`).

Genera un *score* continuo de `0.0` a `1.0` combinando 5 variables ponderadas:

| Variable | Peso | Descripción |
|---|---|---|
| **Proximidad** | 30% | Distancia real en metros normalizada contra el radio de búsqueda (`1.0 - (distancia/radio)`). |
| **Calidad** | 25% | Calificación histórica del negocio (`avg_rating / 5.0`). |
| **Horario** | 20% | Recompensa paramétrica a negocios con horarios declarados y activos al momento de la consulta. |
| **Afinidad** | 15% | Cruza el historial de *check-ins* del token JWT del turista con la categoría del negocio actual. Asume un peso neutro si el usuario es anónimo. |
| **Calor Reciente** | 10% | Evalúa el tráfico en tiempo real (`recent_heat_score`) normalizado contra el local más concurrido de la zona delimitada. |

### 2. Sistema de Probabilidad Garantizada (Pity System)

Ubicado en `s-passport.ts`. Regula la economía virtual de apertura de sobres de estampas, asegurando matemáticamente que la varianza (mala suerte) no frustre al usuario.

- **Fórmula de Ajuste**: `p_real = min(1.0, base_probability + (packs_since_last * pity_increment))`
- **Mecánica**: Ejecuta un muestreo aleatorio ponderado *sin reemplazo* en la memoria del servidor (eventos de Bernoulli). Posteriormente, ejecuta una transacción atómica para persistir las recompensas y actualizar los contadores de infortunio (`stamp_pity`) en la base de datos.

### 3. Motor de Gamificación y Economía de Lealtad

Gestionado a través de los controladores `r-checkins.ts`, `r-reviews.ts` y consolidado en `r-users.ts`.

| Acción | Puntos | Detalle |
|---|---|---|
| Check-in físico | +50 pts | Validación de firma JWT embebida en el QR. |
| Descubrimiento de nueva categoría | +30 pts | Bono por primera visita a una categoría nueva. |
| Reseña verificada | +80 pts | Creación de contenido validada por restricción *UNIQUE* de check-in previo. |
| Like recibido | +10 pts | Transferidos al creador del contenido, incentivando aportaciones orgánicas. |

**Niveles Dinámicos** (evaluación local `O(1)`): Turista Novato → Viajero Frecuente → Explorador Ola → Máster Garnachero.

### 4. Traducción Distribuida (Background Workers)

Implementado en `w-translate-chat.ts` y `s-translations.ts`.

- **Problema**: Las llamadas a APIs externas para traducir un texto a 5 idiomas de forma síncrona bloquean el *Event Loop* de Node y agotan las cuotas del proveedor.
- **Solución**: Se encola la carga de trabajo en **BullMQ**. Un consumidor asíncrono (Worker) procesa los idiomas en segundo plano. Emplea el patrón **Cache-Aside** con Redis: si una frase ya existe en caché, se resuelve en `0ms`; si es un *Cache Miss*, consume DeepL y persiste el resultado.

### 5. Agente Conversacional (RAG & Intents)

Implementado en `s-assistant.ts` y `chatHandler.ts`. Aplica el patrón *Retrieval-Augmented Generation (RAG)*: clasifica la intención del usuario (ej. `BUSCAR_CERCANOS`, `VER_MENU`), extrae datos deterministas de PostgreSQL, inyecta este contexto como "verdad absoluta" en el *system prompt* de Gemini 2.5 Flash y retorna una respuesta humanizada por WebSockets, eliminando el riesgo de alucinaciones.

---

## Arquitectura de Archivos

El código fuente utiliza prefijos arquitectónicos en la nomenclatura de archivos para garantizar una separación de responsabilidades (SoC) inquebrantable.

```text
src/
├── routes/                # [r-*] Capa 2: Controladores REST y Validación (Zod)
│   ├── r-admin.ts         # Métricas globales y flujos de aprobación
│   ├── r-assistant.ts     # Endpoints auxiliares de IA
│   ├── r-auth.ts          # Gestión de sesión, JWT y registros
│   ├── r-businesses.ts    # Entidad Comercial (CRUD, Menús, Imágenes, Videos)
│   ├── r-checkins.ts      # Validación QR de visitas físicas
│   ├── r-dashboard.ts     # Orquestador (BFF) de métricas del propietario
│   ├── r-favorites.ts     # Listas de deseos de usuarios
│   ├── r-feed.ts          # Paginación por Cursor de reseñas (Recent/Popular)
│   ├── r-passport.ts      # Transacciones de sobres y álbum virtual
│   ├── r-profile.ts       # OAuth, recuperación de claves y Storage de Avatares
│   ├── r-reviews.ts       # Creación de contenido UGC y motor de likes
│   ├── r-translate.ts     # Proxy HTTP al servicio de traducción
│   └── r-users.ts         # Consolidación del estado de gamificación
│
├── middleware/            # [m-*] Interceptores de Red y Seguridad
│   ├── m-auth.ts          # Verificación JWT y decodificación de roles
│   ├── m-rate-limiter.ts  # Control de tráfico (DDoS Mitigation) vía Redis
│   └── m-rbac.ts          # Control de Acceso Basado en Roles (RBAC)
│
├── services/              # [s-*] Capa de Dominio e Integraciones (Capa 4)
│   ├── s-assistant.ts     # RAG, Inferencia de Intents y Prompts
│   ├── s-auth.ts          # Lógica criptográfica (JOSE) y Auth Provider
│   ├── s-gemini.ts        # Extracción determinista a JSON (Onboarding)
│   ├── s-passport.ts      # Algoritmo matemático del Pity System
│   ├── s-push.ts          # Motor de alertas Web Push (VAPID)
│   ├── s-qr.ts            # Emisión criptográfica de tokens perpetuos
│   └── s-translations.ts  # Cliente DeepL + Caché distribuida en Redis
│
├── workers/               # [w-*] Procesos Asíncronos Desacoplados
│   └── w-translate-chat.ts# Consumidor BullMQ para traducción masiva (Side-effects)
│
├── db/                    # [q-*] Capa de Datos Transaccional (Capa 3)
│   └── queries/           # Abstracciones de consultas SQL complejas
│
├── lib/                   # [l-*] Instancias Singleton de Infraestructura
│   ├── l-redis.ts         # Conexión persistente a Upstash
│   ├── l-sendgrid.ts      # Motor de correos transaccionales
│   └── l-supabase.ts      # Cliente ORM/PostgreSQL
│
├── socket/
│   └── chatHandler.ts     # Manejador bidireccional (Socket.io) del Chatbot
│
├── types/
│   └── t-app.ts           # [t-*] Contratos estrictos (Types/Interfaces)
│
└── index.ts               # Entry Point (Bootstrap del Servidor HTTP y WS)
```

---

## Referencia de la API

Todas las respuestas del servidor cumplen estrictamente con la interfaz genérica `ApiResponse`:

```json
{ "data": { ... }, "error": null }
```

### Identidad y Perfil (`/api/v1/auth` & `/api/v1/profiles`)

| Método | Ruta | Auth | Acción |
|---|---|---|---|
| POST | `/auth/register` | — | Registro e instanciación de perfiles. |
| POST | `/auth/login` | — | Emisión de JWT (Access + Refresh). |
| POST | `/auth/refresh` | Token | Renovación de credenciales criptográficas. |
| GET | `/auth/oauth/[google\|apple]` | — | Genera URL firmada de redirección OAuth. |
| POST | `/auth/oauth/callback` | — | Negociación e intercambio de tokens post-OAuth. |
| POST | `/auth/forgot-password` | — | Despacha email de recuperación mitigando enumeración. |
| POST | `/auth/reset-password` | JWT (Reset) | Asigna nueva contraseña vía firma asimétrica. |
| GET | `/profiles/me` | JWT | Retorna datos estructurados del perfil y métricas. |
| PATCH | `/profiles/me` | JWT | Mutación parcial (`display_name`, `lang`, `avatar`). |
| POST | `/profiles/me/avatar` | JWT | Subida Multipart procesada hacia Supabase Storage. |

### Dominio Comercial (`/api/v1/businesses` & `/api/v1/owner`)

| Método | Ruta | Auth | Acción |
|---|---|---|---|
| GET | `/owner/dashboard` | JWT owner | Orquesta KPIs, gráficas y RAG de Gemini sobre reseñas. |
| GET | `/businesses/owner/mine` | JWT owner | Retorna el catálogo transaccional del propio negocio. |
| POST | `/businesses/onboarding/chat` | JWT owner | Extrae JSON estructurado desde chat natural. |
| POST | `/businesses` | JWT owner | Consolida la entidad comercial en base de datos. |
| PATCH | `/businesses/:id` | JWT owner | Actualización posicional y de metadatos operativos. |
| POST | `/businesses/save-images` | JWT owner | Ensambla y persiste rutas de Storage en lote. |
| DELETE | `/businesses/:id/images/:imgId` | JWT owner | Destrucción física en Storage y lógica relacional. |
| POST | `/businesses/:id/menu` | JWT owner | Expansión del catálogo de productos. |
| DELETE | `/businesses/:id/menu/:itemId` | JWT owner | Contracción del catálogo de productos. |
| POST | `/businesses/:id/videos` | JWT owner | Vinculación de contenido audiovisual (Pre/Post evento). |
| GET | `/businesses/:id/qr-token` | JWT owner | Emisión de JWT perpetuo firmado para impresión QR. |

### Turismo, Descubrimiento y Gamificación (`/api/v1`)

| Método | Ruta | Auth | Acción |
|---|---|---|---|
| GET | `/businesses` | Opcional | Motor geoespacial Índice Ola (Params: `lat`, `lng`, `radius`). |
| GET | `/businesses/:id` | — | Perfil público comercial (Menú, reseñas, atributos). |
| POST | `/translate` | JWT | Interfaz proxy determinista a DeepL con memoria caché. |
| POST | `/checkins` | JWT tourist | Validación de firma QR, registro espacial y emisión de puntos. |
| GET | `/checkins/history` | JWT tourist | Cruce relacional del historial cronológico de visitas. |
| GET | `/users/me/stats` | JWT tourist | Agregador BFF: Nivel, puntos, recuentos de iteración. |
| POST | `/businesses/:id/reviews` | JWT tourist | Inserción de reseñas (Exige restricción lógica de check-in). |
| GET | `/feed` | JWT | Recuperación paginada por cursor (*cursor-based*) de actividad. |
| POST | `/reviews/:id/like` | JWT tourist | Alternador (Toggle) transaccional de Puntos y Likes. |
| POST | `/favorites` | JWT tourist | Inserción idempotente a la lista de deseos del usuario. |
| GET | `/favorites` | JWT tourist | Recuperación y normalización de entidades guardadas. |
| GET | `/passport/album` | JWT tourist | Estructura de matrices de las colecciones virtuales. |
| POST | `/passport/open-pack` | JWT tourist | Ejecución del motor probabilístico (Pity System). |

### Administración Central (`/api/v1/admin`)

| Método | Ruta | Auth | Acción |
|---|---|---|---|
| GET | `/admin/businesses` | JWT admin | Flujo tabular de auditoría y revisión comercial. |
| PATCH | `/admin/businesses/:id/status` | JWT admin | Alteración de visibilidad y disparo de alertas Web Push. |
| GET | `/admin/metrics` | JWT admin | Extracción analítica de KPIs de la plataforma. |

---

## Tiempo Real (WebSockets con Socket.io)

El backend expone un túnel TCP persistente adyacente a la capa HTTP para gobernar los diálogos asíncronos entre el turista y el modelo fundacional (Gemini).

| Evento de Red | Dirección | Responsabilidad |
|---|---|---|
| `chat:join` | Cliente → Servidor | Suscripción de sala e instanciación de memoria RAG del negocio. |
| `chat:message` | Cliente → Servidor | Transporte del prompt natural del turista. |
| `chat:typing` | Servidor → Cliente | Emisión de retroalimentación mecánica simulando latencia humana. |
| `chat:response` | Servidor → Cliente | Entrega final de inferencias estructuradas por IA. |
| `chat:error` | Servidor → Cliente | Interrupción limpia y manejada ante caídas del proveedor (Graceful degradation). |

---

## Despliegue y Configuración Local

### 1. Instalación de Dependencias

```bash
npm install
```

### 2. Mapeo de Variables de Entorno

Copia el archivo `.env.example` a `.env`. Configura los identificadores de Supabase, Upstash (Redis), y las llaves de API (Gemini/DeepL). Asegúrate de definir secretos criptográficos robustos para el bloque JWT.

### 3. Broker de Mensajería (Redis)

Requerido localmente para inicializar la máquina de estados de BullMQ.

```bash
docker run -p 6379:6379 -d redis
```

### 4. Inicialización del Servidor (Modo Desarrollo)

```bash
npm run dev
```

### 5. (Opcional) Procesamiento en Segundo Plano

Dependiendo de los scripts de tu `package.json`, levanta a los consumidores de BullMQ en un proceso terminal aislado:

```bash
npm run worker
```

---

*Arquitectura y desarrollo diseñado para el ecosistema **La Ruta de la Garnacha** · Talent Land 2026.*