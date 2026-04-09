/**
 * Archivo: src/routes/r-auth.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se localiza en la capa dos de la arquitectura, que engloba la interfaz de 
 * programacion de aplicaciones y la logica de negocio. Su proposito es exponer los puntos de 
 * acceso publicos para el ciclo de vida de la autenticacion de usuarios, abarcando el registro, 
 * inicio de sesion y renovacion de credenciales temporales. Al emplear validadores de esquema 
 * estrictos en el perimetro de la red, se garantiza que la informacion procesada por los servicios 
 * subyacentes posea el formato adecuado. Esta estrategia protege al sistema contra inyecciones de 
 * datos maliciosos y reduce la carga de procesamiento innecesario hacia la capa tres de almacenamiento.
 */

// Endpoints de autenticación.
// POST /api/v1/auth/register
// POST /api/v1/auth/login
// POST /api/v1/auth/refresh

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { sRegister, sLogin, sRefreshTokens } from '../services/s-auth.js'
import type { ApiResponse } from '../types/t-app.js'

export const rAuth = new Hono()

/**
 * Esquemas de validacion estructural.
 *
 * Efecto: Definir las reglas estrictas de longitud, formato y tipado para los datos de entrada, 
 * asegurando la integridad de las peticiones antes de invocar la logica de dominio y consumir 
 * ciclos computacionales del servidor o de la base de datos.
 */

const rRegisterSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'Contraseña demasiado larga'),
  displayName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(80, 'El nombre es demasiado largo')
    .trim(),
    role: z.enum(['tourist', 'owner']).default('tourist'),
    preferredLang: z.enum(['es', 'en', 'fr', 'pt', 'de', 'zh']).optional(),
})

const rLoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

const rRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'El refresh token es requerido'),
})

/**
 * Registrar un nuevo usuario en la plataforma.
 *
 * Ruta asociada: Peticion tipo Post orientada al recurso de registro.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red que transporta el cuerpo de la peticion validada, conteniendo el 
 * correo electronico, contrasena, nombre de presentacion, rol asignado e idioma de preferencia.
 * Retorno: Promesa que resuelve en un objeto estandarizado portando los identificadores de acceso 
 * y datos basicos del usuario, o un estado de conflicto si el recurso ya existe.
 * Efecto: Delegar la construccion del usuario al servicio correspondiente, interceptar 
 * excepciones nativas emitidas por el proveedor de identidad y transformarlas en mensajes 
 * comprensibles para la aplicacion cliente.
 *
 * Complejidad temporal: Orden constante O(1) relativo a la logica del controlador. El tiempo 
 * principal de ejecucion es absorbido por el retardo de red hacia el gestor de identidades.
 * Complejidad espacial: Orden constante O(1). La memoria utilizada es transitoria y acotada a la 
 * estructura de datos de entrada.
 * Escalabilidad: Alta. La validacion local de datos evita llamadas externas por peticiones 
 * malformadas. El diseno soporta registros masivos al depender de un proveedor de identidad robusto.
 */
// POST /register

rAuth.post('/register', zValidator('json', rRegisterSchema), async (ctx) => {
  const body = ctx.req.valid('json')

  try {
    const result = await sRegister(body)

    const response: ApiResponse = {
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        role: result.role,
        displayName:  result.displayName,
      },
      error: null,
    }

    return ctx.json(response, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al registrar usuario'

    // Supabase devuelve "User already registered" cuando el email existe
    const status = message.toLowerCase().includes('already') ? 409 : 400

    return ctx.json<ApiResponse>({ data: null, error: message }, status)
  }
})

/**
 * Validar credenciales de acceso y generar tokens de sesion.
 *
 * Ruta asociada: Peticion tipo Post orientada al recurso de inicio de sesion.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red adjuntando el correo electronico y la contrasena limpios de formatos no validos.
 * Retorno: Promesa que entrega un nuevo par de credenciales temporales o un estado de autorizacion denegada.
 * Efecto: Intermediar la comunicacion con el proveedor de seguridad para autenticar los factores provistos, 
 * emitiendo el token portador que permitira al cliente consumir rutas protegidas.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Muy robusta. La arquitectura es puramente libre de estado; al no crear sesiones en memoria 
 * del servidor local ni bloqueos en disco, multiples instancias pueden atender miles de autenticaciones simultaneas.
 */
// POST /login

rAuth.post('/login', zValidator('json', rLoginSchema), async (ctx) => {
  const { email, password } = ctx.req.valid('json')

  try {
    const result = await sLogin(email, password)

    return ctx.json<ApiResponse>({
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        role: result.role,
        displayName:  result.displayName,
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al iniciar sesión'
    return ctx.json<ApiResponse>({ data: null, error: message }, 401)
  }
})

/**
 * Renovar credenciales temporales caducadas empleando un token de largo plazo.
 *
 * Ruta asociada: Peticion tipo Post orientada al recurso de renovacion.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto conteniendo unicamente el token de actualizacion vigente.
 * Retorno: Promesa que resuelve en un nuevo conjunto de credenciales o informa la caducidad total.
 * Efecto: Negociar la emision de un nuevo acceso principal validando criptograficamente el token 
 * de refresco provisto, asegurando asi la continuidad operativa del usuario sin friccion manual.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Excelente. Siendo esta una de las operaciones mas reiterativas en aplicaciones de 
 * arquitectura moderna, delegar la creacion criptografica al gestor de identidades asegura viabilidad 
 * tecnica ante volumenes considerables de trafico en segundo plano.
 */
// POST /refresh

rAuth.post('/refresh', zValidator('json', rRefreshSchema), async (ctx) => {
  const { refreshToken } = ctx.req.valid('json')

  try {
    const result = await sRefreshTokens(refreshToken)

    return ctx.json<ApiResponse>({
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.userId,
        role: result.role,
        displayName:  result.displayName,
      },
      error: null,
    })
  } catch {
    return ctx.json<ApiResponse>(
      { data: null, error: 'Refresh token inválido o expirado' },
      401
    )
  }
})