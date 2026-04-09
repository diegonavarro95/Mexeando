/**
 * Archivo: src/services/s-push.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se ubica en la capa dos de la arquitectura (Logica de Negocio), funcionando como un servicio 
 * de integracion auxiliar. Su proposito arquitectonico es gobernar el canal de comunicaciones 
 * asincronas del servidor hacia el cliente (Server-to-Client) empleando el estandar Web Push 
 * y la criptografia VAPID (Voluntary Application Server Identification). 
 * Se utiliza principalmente para orquestar alertas proactivas fuera del ciclo de vida de la peticion 
 * HTTP tradicional, notificando a los propietarios cuando sus comercios superan o reprueban los 
 * filtros de validacion administrativa en la capa tres.
 */

// src/services/s-push.ts
// Servicio de notificaciones Web Push con VAPID.
// Se usa para notificar al dueño cuando su negocio es aprobado o rechazado.

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { lSupabase } from '../lib/l-supabase.js'

// Extraer llaves criptograficas de identificacion del servidor desde el entorno.
const vapidPublicKey  = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject    = process.env.VAPID_SUBJECT ?? 'mailto:team@garnacha.dev'

// Inicializar el modulo de envio si las credenciales asimetricas estan presentes.
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

// Instanciar un cliente secundario de base de datos con privilegios absolutos para asegurar 
// que los procesos ejecutados en segundo plano (workers) puedan leer y limpiar las suscripciones 
// sin estar sometidos a las politicas de seguridad a nivel de fila (RLS).
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : lSupabase; // Fallback al normal si olvidan la variable (no recomendado)

export interface sPushPayload {
  title: string
  body: string
  icon?: string   // Url referenciando el activo grafico de la alerta
  url?: string    // Enlace de resolucion al hacer clic en la alerta nativa
}

/**
 * Orquestar el despacho de una notificacion nativa hacia el o los dispositivos del cliente.
 *
 * Tipo: Funcion de integracion asincrona (Side Effect).
 * Parametros: Identificador unico del destinatario y la estructura de datos visible de la alerta.
 * Retorno: Promesa vacia resolviendo la conclusion del encolamiento y purga de terminales invalidas.
 * Efecto: Leer el registro de terminales suscritas, despachar solicitudes concurrentes al proveedor 
 * de red del navegador (FCM, Mozilla Push Service, etc.), y evaluar los codigos de respuesta para 
 * sanear la base de datos eliminando registros de dispositivos que hayan revocado permisos o caducado.
 *
 * Complejidad temporal: Orden lineal O(s) donde s representa el numero de suscripciones activas 
 * asociadas a un mismo usuario. La ejecucion se realiza en paralelo utilizando Promise.allSettled 
 * para prevenir que una falla de red individual interrumpa el ciclo completo.
 * Complejidad espacial: Orden lineal O(s) para mantener en memoria las referencias y los resultados temporales.
 * Escalabilidad: Altamente funcional, ya que purgar suscripciones muertas (codigos 404 y 410) 
 * mantiene la tabla de la base de datos compacta y previene ciclos de red infructuosos en el futuro.
 */
// Envía una notificación push a todos los dispositivos registrados del usuario.
export async function sSendPushToUser(
  userId: string,
  payload: sPushPayload
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[alerta-push] Llaves VAPID no configuradas — notificacion omitida de manera segura.')
    return
  }

  // Utilizar el cliente de roles de servicio para garantizar la recuperacion de todos los endpoints.
  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', userId)

  if (error || !subs?.length) return

  const notifPayload = JSON.stringify(payload)

  // Disparar las llamadas de red externas simultaneamente para mitigar latencia acumulativa.
  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        notifPayload
      )
    )
  )

  // Auditar respuestas para recolectar los identificadores de terminales permanentemente desconectadas.
  const expiredIds: string[] = []
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number }
      // Detectar suscripciones invalidadas (404) o revocadas/desaparecidas (410)
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        expiredIds.push(subs[i].id)
      }
    }
  })

  if (expiredIds.length > 0) {
    // Purga masiva de identificadores caducos optimizada en una sola transaccion de borrado.
    await supabaseAdmin.from('push_subscriptions').delete().in('id', expiredIds)
  }
}