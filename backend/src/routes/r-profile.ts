/**
 * Archivo: src/routes/r-profile.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se consolida en la capa dos de la arquitectura, conformando la interfaz de
 * programacion de aplicaciones y la logica de dominio. Su proposito arquitectonico es 
 * administrar la identidad de los usuarios, gestionando la edicion de perfiles, la 
 * recuperacion de contrasenas y delegando el flujo de autenticacion delegada (Oauth) hacia 
 * proveedores de identidad en la capa externa (Google y Apple). Actua como un puente seguro 
 * entre los clientes de la capa uno y el gestor de autenticacion integrado en la capa tres.
 */

// src/routes/r-profile.ts
// Endpoints de gestión del perfil y autenticación OAuth.
//
// GET    /api/v1/auth/oauth/google          — iniciar flujo OAuth con Google
// GET    /api/v1/auth/oauth/apple           — iniciar flujo OAuth con Apple
// GET    /api/v1/auth/oauth/callback        — callback compartido post-OAuth
// POST   /api/v1/auth/forgot-password       — enviar correo de recuperación
// POST   /api/v1/auth/reset-password        — cambiar contraseña con token
// GET    /api/v1/profiles/me                — obtener perfil propio
// PATCH  /api/v1/profiles/me                — editar perfil (display_name, avatar_url, preferred_lang)
// PATCH  /api/v1/profiles/me/password       — cambiar contraseña (solo cuentas email)

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { mAuth } from '../middleware/m-auth.js'
import { lSupabase } from '../lib/l-supabase.js'
import { lSendEmail, lPasswordResetEmail } from '../lib/l-sendgrid.js'
import {
  sGenerateAccessToken,
  sGenerateRefreshToken,
} from '../services/s-auth.js'
import { SignJWT, jwtVerify } from 'jose'
import type { ApiResponse, AppContext, UserRole } from '../types/t-app.js'

export const rProfile = new Hono<AppContext>()

// Secret para los tokens de reset de contraseña — distinto del JWT de acceso
const sResetSecret = new TextEncoder().encode(
  (process.env.JWT_SECRET ?? '') + '_reset'
)

const APP_URL = process.env.APP_URL ?? 'http://localhost:5173'

// ── Helpers de OAuth ──────────────────────────────────────────

/**
 * Generar un nombre de usuario provisional para perfiles creados mediante proveedores externos.
 *
 * Tipo: Funcion utilitaria sincronica.
 * Parametros: Ninguno.
 * Retorno: Cadena de texto con un adjetivo y un numero aleatorio combinados.
 * Efecto: Proveer una identidad por defecto cuando el proveedor de servicios omite 
 * entregar el nombre del cliente, garantizando la consistencia en la base de datos.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable, ejecucion veloz en memoria.
 */
// Genera un username aleatorio estilo Reddit para usuarios de OAuth
// que no tienen nombre configurado en su cuenta social.
function sGenerateRandomUsername(): string {
  const adjectives = ['viajero','explorador','turista','aventurero','nomada','caminante']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const num = Math.floor(Math.random() * 9000 + 1000)
  return `${adj}${num}`
}

/**
 * Validar la credencial externa y emitir las credenciales locales del sistema.
 *
 * Tipo: Funcion asincrona de servicio.
 * Parametros: Cadena de texto correspondiente al testigo de acceso del proveedor externo.
 * Retorno: Promesa que resuelve en un objeto conteniendo los nuevos testigos, el identificador 
 * de usuario, el rol y una bandera indicando si corresponde a un registro reciente.
 * Efecto: Negociar la validez de la credencial con el servicio de identidad de la capa tres, 
 * instanciar un perfil publico si es inexistente y emitir testigos criptograficos firmados localmente.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Dependiente del proveedor de identidad subyacente. La optimizacion de insercion 
 * condicional previene bloqueos transaccionales prolongados.
 */
// Después del callback OAuth, Supabase devuelve una URL con el access_token
// de Supabase en el fragment (#). El cliente (frontend) extrae ese token,
// lo envía aquí, y nosotros lo canjeamos por nuestro propio JWT par.
async function sExchangeSupabaseToken(supabaseAccessToken: string): Promise<{
  accessToken: string
  refreshToken: string
  userId: string
  role: UserRole
  isNewUser: boolean
}> {
  // Verificar el token de Supabase con el cliente admin
  const { data: { user }, error } = await lSupabase.auth.getUser(supabaseAccessToken)

  if (error || !user) throw new Error('Token de Supabase inválido')

  // Verificar si ya existe el perfil (usuario nuevo vs. ya registrado)
  const { data: existingProfile } = await lSupabase
    .from('profiles')
    .select('id, display_name, role')
    .eq('id', user.id)
    .is('deleted_at', null)
    .single()

  let role: UserRole = 'tourist'
  let isNewUser = false

  if (!existingProfile) {
    isNewUser = true
    const meta = user.user_metadata as Record<string, string> | undefined
    const displayName = meta?.full_name?.trim()
      || meta?.name?.trim()
      || sGenerateRandomUsername()

    // Usamos upsert con opciones en lugar de insert().onConflict()
    const { error: insertErr } = await lSupabase
      .from('profiles')
      .upsert(
        { id: user.id, display_name: displayName, role: 'tourist' },
        { onConflict: 'id', ignoreDuplicates: true }
      )

    if (insertErr) throw new Error(`Error al crear perfil: ${insertErr.message}`)
  } else {
    role = existingProfile.role as UserRole
  }

  const [accessToken, refreshToken] = await Promise.all([
    sGenerateAccessToken(user.id, role),
    sGenerateRefreshToken(user.id),
  ])

  return { accessToken, refreshToken, userId: user.id, role, isNewUser }
}

// ── OAuth — Google ────────────────────────────────────────────

/**
 * Iniciar la delegacion de identidad mediante el proveedor de Google.
 *
 * Ruta asociada: Metodo Get apuntando al proveedor.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red.
 * Retorno: Promesa resolviendo en una Url segura de redireccionamiento.
 * Efecto: Solicitar al gestor de identidades la generacion de un vinculo criptografico para 
 * redirigir al cliente hacia la pantalla de consentimiento del proveedor externo.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable, siendo una peticion de generacion de hipervinculos sin retencion de estado.
 */
rProfile.get('/auth/oauth/google', async (ctx) => {
  const { data, error } = await lSupabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.API_URL ?? 'http://localhost:3000'}/api/v1/auth/oauth/callback`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
      skipBrowserRedirect: true,
    },
  })

  if (error || !data.url) {
    return ctx.json<ApiResponse>({ data: null, error: 'Error al iniciar autenticacion externa con Google' }, 500)
  }

  return ctx.json<ApiResponse>({ data: { oauth_url: data.url }, error: null })
})

// ── OAuth — Apple ─────────────────────────────────────────────

/**
 * Iniciar la delegacion de identidad mediante el ecosistema de Apple.
 *
 * Ruta asociada: Metodo Get apuntando al proveedor.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red.
 * Retorno: Promesa resolviendo en una Url de redireccionamiento.
 * Efecto: Componer el entorno de validacion y solicitar el vinculo inicial autorizado.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Sobresaliente.
 */
rProfile.get('/auth/oauth/apple', async (ctx) => {
  const { data, error } = await lSupabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${process.env.API_URL ?? 'http://localhost:3000'}/api/v1/auth/oauth/callback`,
      skipBrowserRedirect: true,
    },
  })

  if (error || !data.url) {
    return ctx.json<ApiResponse>({ data: null, error: 'Error al iniciar autenticacion externa con Apple' }, 500)
  }

  return ctx.json<ApiResponse>({ data: { oauth_url: data.url }, error: null })
})

// ── OAuth — Callback ──────────────────────────────────────────

/**
 * Recibir y asimilar la confirmacion de identidad proveida por el cliente externo.
 *
 * Ruta asociada: Metodo Post designado como retorno de llamada.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto portando un esquema con el testigo de acceso original validado.
 * Retorno: Promesa que entrega un objeto estructurado con las credenciales de sesion definitivas.
 * Efecto: Invocar la logica de intercambio para reemplazar el testigo generico por testigos 
 * firmados bajo las politicas de seguridad propias de la aplicacion.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Eficiente, asegurando la emision paralela de testigos sin obstruir la cola de eventos.
 */
rProfile.post(
  '/auth/oauth/callback',
  zValidator('json', z.object({
    supabase_access_token: z.string().min(1),
  })),
  async (ctx) => {
    const { supabase_access_token } = ctx.req.valid('json')

    try {
      const result = await sExchangeSupabaseToken(supabase_access_token)

      return ctx.json<ApiResponse>({
        data: {
          accessToken:  result.accessToken,
          refreshToken: result.refreshToken,
          userId:       result.userId,
          role:         result.role,
          is_new_user:  result.isNewUser,
        },
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error en retorno de autenticacion'
      return ctx.json<ApiResponse>({ data: null, error: message }, 401)
    }
  }
)

// ── POST /auth/forgot-password ────────────────────────────────

/**
 * Canalizar una peticion para restaurar credenciales de acceso olvidadas.
 *
 * Ruta asociada: Metodo Post en el recurso de olvido de contrasena.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto validando exclusivamente el correo electronico solicitado.
 * Retorno: Promesa resolviendo en un mensaje generico y homogeneo de exito.
 * Efecto: Validar la existencia de la cuenta ignorando cuentas federadas. Generar un testigo 
 * criptografico temporal y encolar el envio de correo electronico. La estandarizacion de la 
 * respuesta mitiga ataques de enumeracion de usuarios.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Funcional. Delega la latencia de transmision del correo electronico al 
 * subsistema secundario sin interrumpir la respuesta inmediata hacia el cliente solicitante.
 */
rProfile.post(
  '/auth/forgot-password',
  zValidator('json', z.object({
    email: z.string().email('Email inválido'),
  })),
  async (ctx) => {
    const { email } = ctx.req.valid('json')

    // Respuesta idéntica sin importar si el correo existe (Anti-enumeración)
    const okResponse = ctx.json<ApiResponse>({
      data: { message: 'Si ese correo está registrado, recibirás un enlace en los próximos minutos.' },
      error: null,
    })

    const { data: { users }, error: listErr } = await lSupabase.auth.admin.listUsers()
    if (listErr) return okResponse

    const authUser = users.find(u => u.email === email.toLowerCase())
    if (!authUser) return okResponse

    // Verificar que no es una cuenta OAuth (no tiene contraseña)
    const provider = authUser.app_metadata?.provider as string | undefined
    if (provider === 'google' || provider === 'apple') {
      return okResponse
    }

    // Obtener el display_name del perfil para personalizar el correo
    const { data: profile } = await lSupabase
      .from('profiles')
      .select('display_name')
      .eq('id', authUser.id)
      .single()

    const displayName = profile?.display_name ?? 'Usuario'

    // Generar token de reset firmado con expiración de 30 minutos
    const resetToken = await new SignJWT({ type: 'password_reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(authUser.id)
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(sResetSecret)

    // Enviar correo con SendGrid
    try {
      const emailOpts = lPasswordResetEmail(displayName, resetToken)
      await lSendEmail({ ...emailOpts, to: email })
    } catch (err) {
      console.error('[forgot-password] Error en servicio de correos:', err)
    }

    return okResponse
  }
)

// ── POST /auth/reset-password ─────────────────────────────────

/**
 * Reemplazar la contrasena utilizando un testigo autorizado previamente emitido.
 *
 * Ruta asociada: Metodo Post en el recurso de restauracion definitiva.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto validado incluyendo el testigo recuperado y la nueva clave secreta.
 * Retorno: Promesa confirmando la alteracion de la credencial en el sistema.
 * Efecto: Decodificar el testigo comprobando la firma secreta y el proposito temporal. Proceder 
 * con la instruccion de alteracion criptografica en el gestor de autenticacion.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable y segura, apoyandose en validaciones algoritmicas asimetricas puras.
 */
rProfile.post(
  '/auth/reset-password',
  zValidator('json', z.object({
    token:        z.string().min(1, 'Token requerido'),
    new_password: z.string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(72),
  })),
  async (ctx) => {
    const { token, new_password } = ctx.req.valid('json')

    let userId: string
    try {
      const { payload } = await jwtVerify(token, sResetSecret)

      if (payload['type'] !== 'password_reset') {
        throw new Error('Tipo de testigo incorrecto')
      }

      userId = payload.sub as string
    } catch {
      return ctx.json<ApiResponse>(
        { data: null, error: 'El enlace es inválido o ya expiró. Solicita uno nuevo.' },
        400
      )
    }

    const { error } = await lSupabase.auth.admin.updateUserById(userId, {
      password: new_password,
    })

    if (error) {
      return ctx.json<ApiResponse>(
        { data: null, error: 'No se pudo actualizar la contraseña. Intenta de nuevo.' },
        500
      )
    }

    return ctx.json<ApiResponse>({
      data: { message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' },
      error: null,
    })
  }
)

// ── GET /profiles/me ──────────────────────────────────────────

/**
 * Recuperar la estructura informativa vinculada a la identidad en sesion.
 *
 * Ruta asociada: Metodo Get enfocado en el identificador local.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto autenticado conteniendo el identificador de usuario.
 * Retorno: Promesa resolviendo en el objeto estructurado del perfil con metadatos de acceso.
 * Efecto: Consultar la tabla de perfiles publica y enriquecer el resultado determinando el 
 * metodo original de inscripcion.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Optima al ejecutar busquedas indexadas sobre la clave primaria absoluta.
 */
rProfile.get('/profiles/me', mAuth, async (ctx) => {
  const userId = ctx.get('userId')

  const { data: profile, error } = await lSupabase
    .from('profiles')
    .select('id, display_name, avatar_url, preferred_lang, role, point_balance, created_at')
    .eq('id', userId)
    .is('deleted_at', null)
    .single()

  if (error || !profile) {
    return ctx.json<ApiResponse>({ data: null, error: 'Perfil no encontrado' }, 404)
  }

  const { data: { user: authUser } } = await lSupabase.auth.admin.getUserById(userId)
  const provider = authUser?.app_metadata?.provider as string | undefined
  const isOAuth = provider === 'google' || provider === 'apple'

  return ctx.json<ApiResponse>({
    data: {
      ...profile,
      auth_provider: provider ?? 'email',
      is_oauth:      isOAuth,
      has_password:  !isOAuth,
    },
    error: null,
  })
})

// ── PATCH /profiles/me ────────────────────────────────────────

/**
 * Modificar selectivamente parametros publicos del cliente en sesion.
 *
 * Ruta asociada: Metodo de alteracion parcial en el recurso personal.
 * Tipo: Controlador asincrono.
 * Parametros: Objeto validado con opciones variables.
 * Retorno: Promesa devolviendo la version modificada del perfil.
 * Efecto: Aplicar una mutacion controlada agregando una marca de auditoria temporal.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Sumamente eficaz y rapida al modificar unicamente columnas predefinidas y simples.
 */
rProfile.patch(
  '/profiles/me',
  mAuth,
  zValidator('json', z.object({
    display_name:   z.string().min(2).max(80).trim().optional(),
    avatar_url:     z.string().url().optional().nullable(),
    preferred_lang: z.enum(['es','en','fr','pt','de','zh']).optional(),
  }).refine(
    data => Object.keys(data).length > 0,
    { message: 'Debes enviar al menos un campo para actualizar' }
  )),
  async (ctx) => {
    const userId  = ctx.get('userId')
    const updates = ctx.req.valid('json')

    const { data, error } = await lSupabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, display_name, avatar_url, preferred_lang, role, point_balance')
      .single()

    if (error || !data) {
      return ctx.json<ApiResponse>({ data: null, error: error?.message ?? 'Error al actualizar' }, 500)
    }

    return ctx.json<ApiResponse>({ data, error: null })
  }
)

// ── PATCH /profiles/me/password ───────────────────────────────

/**
 * Alterar voluntariamente el secreto de acceso confirmando conocimiento del anterior.
 *
 * Ruta asociada: Metodo de modificacion en el segmento de contrasena personal.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto validado incluyendo el secreto antiguo y el reemplazo.
 * Retorno: Promesa reportando la conclusion del mecanismo en formato Json.
 * Efecto: Consultar los metadatos de identidad para rechazar la peticion si proviene de un 
 * modelo federado. En escenarios regulares, someter a prueba la clave vigente y aplicar la permuta.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Alta, protegiendo las capas computacionales asegurando operaciones delegadas.
 */
rProfile.patch(
  '/profiles/me/password',
  mAuth,
  zValidator('json', z.object({
    current_password: z.string().min(1),
    new_password:     z.string().min(8).max(72),
  })),
  async (ctx) => {
    const userId = ctx.get('userId')
    const { current_password, new_password } = ctx.req.valid('json')

    const { data: { user: authUser } } = await lSupabase.auth.admin.getUserById(userId)
    const provider = authUser?.app_metadata?.provider as string | undefined

    if (provider === 'google' || provider === 'apple') {
      return ctx.json<ApiResponse>(
        {
          data: null,
          error: `Tu cuenta está vinculada con ${provider === 'google' ? 'Google' : 'Apple'}. No puedes cambiar la contraseña desde aquí.`,
        },
        422 
      )
    }

    if (!authUser?.email) {
      return ctx.json<ApiResponse>({ data: null, error: 'No se pudo obtener el usuario' }, 500)
    }

    const { error: verifyErr } = await lSupabase.auth.signInWithPassword({
      email:    authUser.email,
      password: current_password,
    })

    if (verifyErr) {
      return ctx.json<ApiResponse>(
        { data: null, error: 'La contraseña actual es incorrecta.' },
        401
      )
    }

    const { error: updateErr } = await lSupabase.auth.admin.updateUserById(userId, {
      password: new_password,
    })

    if (updateErr) {
      return ctx.json<ApiResponse>(
        { data: null, error: 'No se pudo actualizar la contraseña.' },
        500
      )
    }

    return ctx.json<ApiResponse>({
      data: { message: 'Contraseña actualizada correctamente.' },
      error: null,
    })
  }
)


// ── POST /profiles/me/avatar ──────────────────────────────────
//Creado por Demian para permitir a los usuarios subir una foto de perfil personalizada, almacenándola de forma segura en Supabase Storage y actualizando su perfil con la nueva URL de avatar. 
// Esto mejora la experiencia del usuario al personalizar su cuenta y garantiza que las imágenes se gestionen eficientemente sin sobrecargar la base de datos.
// Sube foto de perfil al bucket business_images/avatars/{userId}/
// y actualiza avatar_url en el perfil.
//
// Form data:
//   file — imagen de perfil

/**
 * Transmitir e incorporar un recurso grafico personalizado asociado al usuario activo.
 *
 * Ruta asociada: Metodo Post empleando un formato de datos multiple (Multipart)
 * Tipo: Controlador asincrono.
 * Parametros: Contexto asimilando el flujo binario representativo del archivo grafico.
 * Retorno: Promesa devolviendo el enlace estatico de la ubicacion resuelta en la red de entrega de contenido.
 * Efecto: Validar restricciones de clase sobre la peticion entrante, empaquetar los bytes en memoria, 
 * delegar el alojamiento en el sistema de almacenamiento secundario obligando el reemplazo de versiones previas, 
 * y actualizar finalmente el vinculo de texto en el registro relacional primario.
 *
 * Complejidad temporal: Orden lineal O(m) directamente proporcional a la densidad binaria del elemento 
 * grafico en transito por el protocolo de red.
 * Complejidad espacial: Orden lineal O(m) debido a que la instancia del servidor local retiene un 
 * contenedor temporal de la misma dimension estructural que el archivo subido antes de su delegacion externa.
 * Escalabilidad: Funcional y moderada. En arquitecturas sujetas a trafico masivo se sugeriria 
 * integrar transmisiones divididas en secuencias (streams) o en su defecto redireccionar al cliente 
 * originador a emitir el binario hacia el proveedor de almacenamiento mediante un vinculo preaprobado, 
 * descargando la memoria del servidor de aplicacion de Node.
 */
rProfile.post(
  '/profiles/me/avatar',
  mAuth,
  async (ctx) => {
    const userId = ctx.get('userId')
  
    try {
      const formData = await ctx.req.raw.formData()
      const file     = formData.get('file') as File | null
  
      if (!file) {
        return ctx.json<ApiResponse>({ data: null, error: 'No se recibió ningún archivo' }, 400)
      }
  
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        return ctx.json<ApiResponse>({ data: null, error: 'Solo se permiten imágenes' }, 400)
      }
  
      const ext    = file.name.split('.').pop() ?? 'jpg'
      const path   = `avatars/${userId}/${Date.now()}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())
  
      // Subir al bucket — upsert:true para reemplazar avatar anterior
      const { error: uploadError } = await lSupabase.storage
        .from('business_images')
        .upload(path, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: true,
        })
  
      if (uploadError) {
        return ctx.json<ApiResponse>({ data: null, error: uploadError.message }, 500)
      }
  
      // Obtener Url pública
      const { data: { publicUrl } } = lSupabase.storage
        .from('business_images')
        .getPublicUrl(path)
  
      // Actualizar avatar_url en el perfil
      const { data: profile, error: updateError } = await lSupabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('id, display_name, avatar_url')
        .single()
  
      if (updateError || !profile) {
        return ctx.json<ApiResponse>({ data: null, error: 'Error al actualizar el perfil' }, 500)
      }
  
      return ctx.json<ApiResponse>({
        data: {
          avatar_url: publicUrl,
          path,
        },
        error: null,
      }, 201)
  
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al subir avatar'
      return ctx.json<ApiResponse>({ data: null, error: message }, 500)
    }
  }
)