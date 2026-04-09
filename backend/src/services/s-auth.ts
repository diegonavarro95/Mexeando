/**
 * Archivo: src/services/s-auth.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo opera en la capa dos de la arquitectura (Logica de Negocio), funcionando 
 * como un modulo de servicio puro. Su responsabilidad arquitectonica es abstraer y ejecutar 
 * la logica criptografica y las transacciones relacionadas con la identidad de los usuarios. 
 * Al desacoplar la emision de testigos, la verificacion de firmas y las interacciones con 
 * el proveedor de autenticacion externo de los controladores de red (rutas), se logra una 
 * alta capacidad de prueba unitaria independiente, promoviendo la resiliencia y el 
 * mantenimiento del codigo fuente.
 */

// Logica de negocio de autenticacion.
// Desacoplada de las rutas para poder testearse de forma independiente.

import { SignJWT, jwtVerify } from 'jose'
import { lSupabase } from '../lib/l-supabase.js'
import type { JwtPayload, RefreshPayload, UserRole } from '../types/t-app.js'

// ─── Helpers de JWT ──────────────────────────────────────────────────────────

/**
 * Codificacion de claves secretas compartidas.
 *
 * Efecto: Transformar las cadenas de texto del entorno local en secuencias de bytes 
 * requeridas por la libreria criptografica (jose) para ejecutar operaciones de 
 * firma HMAC seguras. Se generan contextos aislados para tokens de acceso, 
 * de actualizacion y de reinicio de contrasena para prevenir fugas de permisos.
 */
const sAccessSecret  = new TextEncoder().encode(process.env.JWT_SECRET!)
const sRefreshSecret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET!)
const sResetSecret   = new TextEncoder().encode((process.env.JWT_SECRET ?? '') + '_reset')

/**
 * Emitir un testigo criptografico de corta duracion (15 minutos).
 *
 * Tipo: Funcion utilitaria asincrona.
 * Parametros: Identificador de base de datos del usuario y su rol en el sistema.
 * Retorno: Cadena de caracteres del JSON Web Token (JWT) firmado.
 * Efecto: Sellar la carga util con las identificaciones para que los interceptores 
 * de red puedan validar la identidad sin acudir repetidamente a la base de datos.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Extrema. Al delegar la autorizacion al token, el servidor de aplicacion 
 * permanece libre de estado.
 */
export async function sGenerateAccessToken(
  userId: string,
  role: UserRole
): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(sAccessSecret)
}

/**
 * Emitir un testigo de sesion persistente de larga duracion (7 dias).
 *
 * Tipo: Funcion utilitaria asincrona.
 * Parametros: Identificador del usuario.
 * Retorno: Cadena de caracteres del JWT de refresco firmado.
 * Efecto: Otorgar un mecanismo para generar nuevos tokens de acceso sin que el 
 * usuario final requiera proporcionar sus credenciales primarias nuevamente.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 */
export async function sGenerateRefreshToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(sRefreshSecret)
}

/**
 * Comprobar la integridad criptografica y extraer la carga util de un testigo de acceso.
 *
 * Tipo: Funcion utilitaria asincrona.
 * Parametros: Cadena de texto del token de acceso en revision.
 * Retorno: Objeto de carga util estructurada. Arroja una excepcion si la firma no coincide o expiro.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 */
export async function sVerifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, sAccessSecret)
  return payload as unknown as JwtPayload
}

/**
 * Comprobar la integridad criptografica y extraer la carga util de un testigo de actualizacion.
 *
 * Tipo: Funcion utilitaria asincrona.
 * Parametros: Cadena de texto del token de refresco en revision.
 * Retorno: Objeto de carga util.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 */
export async function sVerifyRefreshToken(
  token: string
): Promise<RefreshPayload> {
  const { payload } = await jwtVerify(token, sRefreshSecret)
  return payload as unknown as RefreshPayload
}

// ─── Lógica de Recuperación de Contraseña ─────────────────────────────

/**
 * Emitir un testigo criptografico transitorio para restablecimiento credencial.
 *
 * Tipo: Funcion utilitaria asincrona.
 * Parametros: Identificador unico del usuario.
 * Retorno: Cadena de caracteres firmada expirable en treinta minutos.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 */
export async function sGenerateResetToken(userId: string): Promise<string> {
  return await new SignJWT({ type: 'password_reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(sResetSecret)
}

/**
 * Comprobar la intencion y validez del testigo de recuperacion emitido.
 *
 * Tipo: Funcion utilitaria asincrona.
 * Parametros: Cadena del token correspondiente al reinicio.
 * Retorno: Identificador del usuario. Genera excepcion si el token no tiene el formato o proposito esperado.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 */
export async function sVerifyResetToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, sResetSecret)
  if (payload['type'] !== 'password_reset') throw new Error('Invalid token type')
  return payload.sub as string
}

// ─── Operaciones de usuario ─────────────────────

export interface sRegisterInput {
  email:         string
  password:      string
  displayName:   string
  role:          UserRole
  preferredLang?: string
}

export interface sAuthResult {
  accessToken:  string
  refreshToken: string
  userId:       string
  role:         UserRole
  displayName?: string
}

/**
 * Iniciar el ciclo de incorporacion de un usuario creando entidades aisladas.
 *
 * Tipo: Funcion de dominio asincrona.
 * Parametros: Objeto consolidado conteniendo parametros iniciales y el secreto proveido.
 * Retorno: Objeto que transporta las credenciales criptograficas inmediatas.
 * Efecto: Invocar la interfaz administrativa externa para instanciar el registro maestro de 
 * autenticacion, y subsecuentemente, construir el perfil logico (entidad local publica). 
 * Se implementa una operacion de compensacion en caso de fallo para preservar la higiene de datos.
 *
 * Complejidad temporal: Orden constante O(1) dominado por las latencias de las comunicaciones 
 * de red con el proveedor externo de autenticacion.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente tolerante a fallas y robusta gracias al mecanismo de reversa implicito 
 * (`rollback`), lo que garantiza bases de datos relacionales sin "registros huerfanos".
 */
// Registra un nuevo usuario en Supabase Auth y actualiza su perfil con el rol correcto.
export async function sRegister(input: sRegisterInput): Promise<sAuthResult> {
  // 1. Instanciar registro nativo en el ecosistema de gestion de identidad
  const { data, error } = await lSupabase.auth.admin.createUser({
    email:         input.email,
    password:      input.password,
    user_metadata: { full_name: input.displayName },
    email_confirm: true, // Confirmacion expedita para ambientes de desarrollo
  })

  if (error || !data.user) {
    throw new Error(error?.message ?? 'No se pudo crear el usuario')
  }

  const userId = data.user.id

  // 2. Poblar el esquema logico local de la aplicacion
  const { error: updateError } = await lSupabase
    .from('profiles')
    .update({
      role:           input.role,
      display_name:   input.displayName,
      ...(input.preferredLang && { preferred_lang: input.preferredLang }),
    })
    .eq('id', userId)

  if (updateError) {
    // Operacion de compensacion: Evitar huerfanos si la base de datos principal falla
    await lSupabase.auth.admin.deleteUser(userId)
    throw new Error(`Error al crear el perfil: ${updateError.message}`)
  }

  // 3. Emitir las credenciales criptograficas asimetricas iniciales
  const [accessToken, refreshToken] = await Promise.all([
    sGenerateAccessToken(userId, input.role),
    sGenerateRefreshToken(userId),
  ])

  return {
    accessToken,
    refreshToken,
    userId,
    role:        input.role,
    displayName: input.displayName,
  }
}

/**
 * Validar factores y emitir testigos criptograficos para una sesion regular.
 *
 * Tipo: Funcion de dominio asincrona.
 * Parametros: Elementos primitivos de validacion (Correo y clave secreta).
 * Retorno: Objeto encapsulando el par criptografico de acceso y atributos fundamentales del perfil.
 * Efecto: Delegar la confrontacion segura contra las tablas salteadas hacia el administrador 
 * externo y consultar internamente el rol autorizado del perfil publico.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Excepcional, previene la decodificacion concurrente en la capa del servidor 
 * Node, apoyandose en los motores nativos C/Rust del proveedor externo.
 */
// Autentica con email/password usando Supabase Auth.
export async function sLogin(
  email: string,
  password: string
): Promise<sAuthResult> {
  const { data, error } = await lSupabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    throw new Error('Credenciales incorrectas')
  }

  const { data: profile, error: profileError } = await lSupabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', data.user.id)
    .is('deleted_at', null)
    .single()

  if (profileError || !profile) {
    throw new Error('Perfil no encontrado')
  }

  const userId = data.user.id
  const role   = profile.role as UserRole

  const [accessToken, refreshToken] = await Promise.all([
    sGenerateAccessToken(userId, role),
    sGenerateRefreshToken(userId),
  ])

  return {
    accessToken,
    refreshToken,
    userId,
    role,
    displayName: profile.display_name,
  }
}

/**
 * Intercambiar un testigo persistente por un nuevo conjunto fresco de claves.
 *
 * Tipo: Funcion de dominio asincrona.
 * Parametros: Cadena de texto correspondiente al token en formato de larga duracion.
 * Retorno: Objeto actualizado de credenciales y parametros.
 * Efecto: Interpretar y confirmar localmente el testigo provisto para mitigar latencia 
 * de red. Realizar una unica lectura remota obligatoria para validar que el usuario no ha 
 * sido suspendido de forma logica y regenerar las firmas temporales correspondientes.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente funcional, asegurando la continuidad organica del usuario sin 
 * interrupciones ni recargas visuales para reautenticacion manual.
 */
// Emite un nuevo par de tokens a partir de un refresh token válido.
export async function sRefreshTokens(
  refreshToken: string
): Promise<sAuthResult> {
  const payload = await sVerifyRefreshToken(refreshToken)

  const { data: profile, error } = await lSupabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', payload.sub)
    .is('deleted_at', null)
    .single()

  if (error || !profile) {
    throw new Error('Usuario no encontrado o desactivado')
  }

  const role = profile.role as UserRole

  const [newAccessToken, newRefreshToken] = await Promise.all([
    sGenerateAccessToken(payload.sub, role),
    sGenerateRefreshToken(payload.sub),
  ])

  return {
    accessToken:  newAccessToken,
    refreshToken: newRefreshToken,
    userId:       payload.sub,
    role,
    displayName:  profile.display_name,
  }
}