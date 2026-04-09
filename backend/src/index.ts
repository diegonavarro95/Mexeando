/**
 * Archivo: src/index.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo representa el punto de entrada principal (Entry Point) del servidor de Node.js, 
 * unificando las diferentes sub-capas operativas. En terminos de arquitectura, funciona como 
 * el Capitan de la aplicacion, orquestando el ciclo de arranque.
 * Sus responsabilidades son:
 * 1. Inicializar la escucha del protocolo HTTP mediante el micro-framework Hono (Capa de Red).
 * 2. Anclar el servidor de WebSockets (Socket.io) sobre el mismo puerto para comunicaciones bidireccionales.
 * 3. Configurar la bateria de interceptores globales (Middlewares) para garantizar la seguridad 
 * perimetral (CORS), la proteccion contra saturacion (Rate Limiting) y la observabilidad (Logs).
 * 4. Registrar y mapear todas las ramas de enrutamiento (Controladores) definidas en la capa dos 
 * hacia las correspondientes rutas relativas del Api publico.
 */

import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Server as SocketServer } from 'socket.io'
import { registerChatHandler } from './socket/chatHandler.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { rAuth } from './routes/r-auth.js'
import { rBusinesses } from './routes/r-businesses.js'
import type { AppContext } from './types/t-app.js'
import { rateLimiter } from './middleware/m-rate-limiter.js'
import translateRoute from './routes/r-translate.js';
import { rCheckins } from './routes/r-checkins.js'
import { rPassport } from './routes/r-passport.js'
import { rReviews }  from './routes/r-reviews.js'
import { rAdmin }    from './routes/r-admin.js'
import { rFeed } from './routes/r-feed.js'
import { rDashboard } from './routes/r-dashboard.js'
import { rProfile } from './routes/r-profile.js'
import { rAssistant } from './routes/r-assistant.js'
import { rFavorites } from './routes/r-favorites.js'
import { rUsers } from './routes/r-users.js'

// Inicializar la aplicacion dotada con el contexto de identidad global
const app = new Hono<AppContext>()

// ─── Middlewares Globales (Seguridad y Operaciones) ──────────────────────────

/**
 * Registro de transacciones (Logging).
 * Imprime en la consola un rastro estandarizado de cada peticion entrante para auditoria.
 */
// Logger de requests en desarrollo
app.use('*', logger())

/**
 * Formateo inteligente (Pretty JSON).
 * Habilita tabulaciones espaciadas en las respuestas JSON unicamente en el entorno local, 
 * facilitando la depuracion visual sin castigar el ancho de banda en produccion.
 */
// Pretty JSON en desarrollo para facilitar lectura en Postman
if (process.env.NODE_ENV === 'development') {
  app.use('*', prettyJSON())
}

/**
 * Control de Acceso HTTP (CORS - Cross-Origin Resource Sharing).
 * Restringe la aceptacion de peticiones exclusivamente a los origenes preaprobados (por ejemplo, el dominio del frontend), 
 * mitigando vulnerabilidades de secuestro de sesion desde paginas fraudulentas.
 */
// CORS: solo permitir orígenes configurados
app.use(
  '*',
  cors({
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','),
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // Instructivo para cacheo de consultas preliminares preflight (24 horas)
  })
)

/**
 * Interceptor de control de flujo (Rate Limiting).
 * Protege al servidor de ataques de denegacion de servicio (DDoS) o fuerza bruta, 
 * limitando el numero maximo de peticiones por segundo que un mismo origen (IP) puede ejecutar.
 */
//CORS: Rate Limiter
app.use(
  '*', 
  rateLimiter
);

// ─── Rutas Base y de Salud ───────────────────────────────────────────────────

/**
 * Endpoint de estado o latido (Healthcheck).
 * Utilizado por balanceadores de carga y servicios en la nube para confirmar 
 * que el servidor esta vivo y en capacidad de atender trafico.
 */
// Es un check
app.get('/', (ctx) =>
  ctx.json({
    status: 'ok',
    project: 'La Ruta de la Garnacha',
    version: '1.0.0',
    env: process.env.NODE_ENV,
  })
)

// ─── Registro de Modulos de la Capa Dos ──────────────────────────────────────
// Mapeo exhaustivo de las logicas de negocio encapsuladas hacia los directorios de la API.

// Rutas de la API
app.route('/api/v1/auth', rAuth)
app.route('/api/v1/businesses', rBusinesses)
app.route('/api/v1/checkins', rCheckins)
app.route('/api/v1/favorites', rFavorites)
app.route('/api/v1/translate', translateRoute)
app.route('/api/v1/passport', rPassport)
app.route('/api/v1', rReviews)   
app.route('/api/v1/admin', rAdmin);
app.route('/api/v1/feed', rFeed)
app.route('/api/v1/owner/dashboard', rDashboard)
app.route('/api/v1', rProfile)
app.route('/api/v1/assistant', rAssistant)
app.route('/api/v1/users', rUsers)

// ─── Control de Excepciones Globales ─────────────────────────────────────────

/**
 * Trampa de errores no interceptados (Catch-all).
 * Captura excepciones subyacentes lanzadas por controladores sin bloque try/catch. 
 * Escribe la traza real en los registros, pero envuelve la respuesta en un Json homogeneo, 
 * impidiendo la fuga de informacion sensitiva de base de datos hacia el cliente.
 */
// Errores de handler 
app.onError((err, ctx) => {
  console.error('[ERROR NO CONTROLADO DEL SERVIDOR]', err)
  return ctx.json(
    { data: null, error: 'Error interno del servidor' },
    500
  )
})

/**
 * Respuesta generica de localizacion inexistente (Fallback).
 * Interrumpe las peticiones hacia rutas no registradas devolviendo el estandar 404.
 */
app.notFound((ctx) =>
  ctx.json({ data: null, error: `Ruta no encontrada o metodo no permitido: ${ctx.req.path}` }, 404)
)

// ─── Inicializacion y Servidor Fisico ────────────────────────────────────────

const port = Number(process.env.PORT ?? 3000)

/**
 * Arranque de la infraestructura del servidor de Node nativo inyectando el procesador de Hono.
 */
const httpServer = serve({
  fetch: app.fetch,
  port: port
}, (info) => {
  console.log(`\nLa Ruta de la Garnacha — Backend Principal Iniciado`)
  console.log(`HTTP + WebSocket operativos en http://localhost:${info.port}`)
  console.log(`Entorno de ejecucion: ${process.env.NODE_ENV ?? 'development'}\n`)
})

/**
 * Acoplamiento del servidor de tiempo real.
 * Reutiliza el mismo puerto nativo, montando la maquina de estados de Socket.io y 
 * compartiendo las reglas perimetrales de CORS.
 */
const io = new SocketServer(httpServer as any, {
  cors: {
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// Activar la intercepcion del canal conversacional interactivo
registerChatHandler(io)

// Exportar la instancia de la aplicacion para consumo por suites de pruebas locales (Tests)
export default app