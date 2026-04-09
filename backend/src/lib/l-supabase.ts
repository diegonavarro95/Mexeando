/**
 * Archivo: src/lib/l-supabase.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se ubica en la capa dos de la arquitectura (Logica y Api). Actua como el conector 
 * principal y exclusivo entre el servidor de aplicacion (Node.js con Hono) y la capa tres de 
 * datos y almacenamiento (Supabase y PostgreSQL). 
 * Su responsabilidad arquitectonica es instanciar un cliente de acceso a datos empleando una 
 * credencial de servicio (service role key). Esta configuracion omite intencionalmente las politicas 
 * de seguridad a nivel de fila (Row Level Security) de la base de datos, debido a que la 
 * validacion de identidad (JWT) y el control de acceso basado en roles (RBAC) se resuelven 
 * de manera estricta y perimetral en los interceptores (middlewares) de la capa dos.
 * Este modulo es de uso interno exclusivo del servidor y jamas debe ser expuesto a la capa uno (Cliente).
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Cargar identificadores de red y credenciales de acceso privilegiado desde el entorno.
 *
 * Efecto: Extraer variables criticas y validar su existencia para evitar un arranque del servidor 
 * en un estado inconsistente. Si las credenciales estan ausentes, el proceso termina de inmediato.
 * Complejidad temporal: Orden constante O(1). La lectura de variables de entorno y la evaluacion 
 * condicional son operaciones triviales e instantaneas.
 * Complejidad espacial: Orden constante O(1).
 */
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan variables de entorno para establecer conexion con el repositorio de datos principal.'
  )
}

/**
 * Cliente unico de conexion al repositorio de datos.
 *
 * Rutas asociadas: Utilizado transversalmente por todas las rutas y consultas del sistema.
 * Tipo: Instancia de objeto (SupabaseClient).
 * Parametros: Localizador de recursos de Supabase, clave de servicio y objeto de configuracion.
 * Efecto: Crear una instancia sin estado (stateless) para interactuar con la interfaz de programacion 
 * representacional (REST) de PostgREST proporcionada por Supabase. Se desactiva el manejo de 
 * sesiones persistentes, ya que la arquitectura delega el manejo del ciclo de vida del token 
 * a la logica propia del servidor.
 *
 * Complejidad temporal: Orden constante O(1). La instanciacion del cliente no ejecuta conexiones 
 * de red en frio; unicamente prepara el cliente HTTP subyacente para emitir peticiones futuras.
 * Complejidad espacial: Orden constante O(1). Ocupa una huella de memoria minima para almacenar 
 * las credenciales y las cabeceras base de red.
 * Escalabilidad: Altamente escalable. Al desactivar la persistencia de sesion local y el refresco 
 * de tokens (`persistSession: false`, `autoRefreshToken: false`), la instancia se vuelve completamente 
 * libre de estado. Esto significa que un solo cliente instanciado puede procesar de forma concurrente 
 * miles de peticiones hacia la capa tres sin sufrir fugas de memoria o bloqueos (bottlenecks) por 
 * sincronizacion de estado. La escalabilidad real de las consultas de este cliente descansara 
 * sobre la configuracion de reserva de conexiones (connection pooler) en el propio PostgreSQL.
 */
export const lSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // El servidor maneja su propio ecosistema de autenticacion, eliminando la necesidad 
    // de utilizar los mecanismos de sesion nativos del cliente.
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})