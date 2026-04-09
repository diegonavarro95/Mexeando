/**
 * Archivo: src/types/t-app.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura (Logica de Negocio e Interfaz de Aplicacion).
 * Su funcion arquitectonica es establecer el contrato de datos (Domain Driven Design) para todo el ecosistema 
 * del servidor en Node.js. Al centralizar las definiciones de tipos de TypeScript que modelan las entidades 
 * de la base de datos (Capa 3), las credenciales criptograficas y el formato estandar de las respuestas 
 * de red (API Responses), garantiza que todos los controladores, interceptores y servicios mantengan 
 * consistencia y seguridad de tipado estricto durante el tiempo de compilacion y desarrollo.
 */

// src/types/t-app.ts
// Tipos compartidos en todo el backend.
// Se derivan del schema de la BD para mantener consistencia.

/**
 * Enumerador estricto para gobernar el control de acceso basado en roles (RBAC).
 */
export type UserRole = 'tourist' | 'owner' | 'admin'

/**
 * Estructura de la carga util (Payload) embebida en los testigos criptograficos de sesion.
 * Permite a la aplicacion validar la identidad y los privilegios sin realizar consultas a la base de datos.
 */
// Payload que vive dentro del JWT de acceso
export interface JwtPayload {
  sub: string       // Identificador unico universal del usuario (UUID)
  role: UserRole    // Nivel de privilegio operativo
  iat: number       // Marca de tiempo de emision (Issued At)
  exp: number       // Marca de tiempo de expiracion
}

/**
 * Estructura del testigo criptografico persistente utilizado para emitir nuevos tokens de sesion.
 */
// Payload del refresh token
export interface RefreshPayload {
  sub: string
  iat: number
  exp: number
}

/**
 * Contrato de configuracion del entorno de despliegue.
 * Define las credenciales minimas requeridas para que el servidor pueda inicializarse de forma segura.
 */
// Variables de entorno tipadas falla en startup si falta alguna
export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  JWT_SECRET: string
  JWT_REFRESH_SECRET: string
  PORT: string
  NODE_ENV: string
  ALLOWED_ORIGINS: string
}

/**
 * Extension del contexto de ejecucion nativo del enrutador (Hono).
 * Permite que los interceptores (Middlewares) inyecten la informacion de sesion decodificada 
 * para que los controladores finales puedan consumirla de manera tipada.
 */
// Contexto de Hono extendido con el usuario autenticado
// Se inyecta por el middleware m-auth en cada request protegido
export type AppContext = {
  Variables: {
    userId: string
    userRole: UserRole
  }
}

/**
 * Envoltorio estandarizado (Wrapper) para todas las respuestas de red emitidas por la capa dos.
 * Garantiza un contrato predecible para el cliente frontal (Capa 1), facilitando el manejo de errores.
 */
// Respuesta estándar de la API
// Todas las rutas devuelven este shape para consistencia
export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

/**
 * Estructura de los elementos comerciales retornados por las busquedas geoespaciales complejas.
 * Refleja el resultado enriquecido generado por la funcion analitica `fn_indice_ola` en la capa de datos.
 */
// Resultado del Índice Ola devuelto por fn_indice_ola
export interface BusinessMapResult {
  id: string
  name: string
  slug: string
  category_slug: string
  category_icon: string
  lat: number
  lng: number
  primary_image: string | null
  avg_rating: number
  review_count: number
  checkin_count: number
  accepts_card: boolean
  ola_verified: boolean
  distance_m: number
  indice_ola: number
  is_open_now: boolean
}