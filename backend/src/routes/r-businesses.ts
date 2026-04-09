/**
 * Archivo: src/routes/r-businesses.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se ubica en la capa dos de la arquitectura, que comprende la interfaz de 
 * programacion de aplicaciones y la logica de negocio. Su funcion arquitectonica es 
 * agrupar y exponer todos los controladores de red relacionados con la entidad comercial 
 * (negocios). Actua como el intermediario principal entre las peticiones de los clientes 
 * en la capa uno (turistas y duenos) y los repositorios de datos en la capa tres.
 * Integra interceptores de seguridad para autenticacion y control de acceso, validacion 
 * estricta de esquemas y comunicacion con servicios externos como el almacenamiento de 
 * objetos y los modelos de inteligencia de la capa cuatro.
 */

// src/routes/r-businesses.ts
// Endpoints de negocios.
//
// v2 — Nuevos endpoints:
//   PATCH  /businesses/:id                    — editar datos del negocio (owner)
//   DELETE /businesses/:id/images/:imageId    — eliminar foto del negocio (owner)
//   GET    /businesses/owner/mine             — ahora incluye lat, lng, images

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { mAuth } from '../middleware/m-auth.js'
import { mRequireRole } from '../middleware/m-rbac.js'
import {
  qGetNearbyBusinesses,
  qGetBusinessById,
  qCreateBusiness,
  qAddMenuItem,
  qVerifyBusinessOwner,
} from '../db/queries/q-businesses.js'
import type { ApiResponse, AppContext } from '../types/t-app.js'
import { lSupabase } from '../lib/l-supabase.js'
import { sGenerateQrToken } from '../services/s-qr.js'

export const rBusinesses = new Hono<AppContext>()

/**
 * Extraer y formatear coordenadas geograficas a partir de datos espaciales crudos.
 *
 * Tipo: Funcion utilitaria sincronica.
 * Parametros: Objeto o cadena de texto representando un punto geometrico.
 * Retorno: Objeto estructurado con latitud y longitud numericas.
 * Efecto: Analizar expresiones regulares o propiedades anidadas para convertir 
 * la representacion del motor relacional en un formato digerible por el cliente.
 *
 * Complejidad temporal: Orden constante O(1). La evaluacion de la cadena es limitada.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Completamente escalable al no depender de recursos externos.
 */
function sExtractLatLngFromLocation(location: unknown): {
  lat: number | null
  lng: number | null
} {
  if (typeof location === 'string') {
    const match = location.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i)
    if (match) {
      return {
        lng: Number(match[1]),
        lat: Number(match[2]),
      }
    }
  }

  if (
    location &&
    typeof location === 'object' &&
    'coordinates' in location &&
    Array.isArray((location as { coordinates?: unknown[] }).coordinates)
  ) {
    const coords = (location as { coordinates: unknown[] }).coordinates
    return {
      lng: Number(coords[0]),
      lat: Number(coords[1]),
    }
  }

  return { lat: null, lng: null }
}

/**
 * Marcar un negocio para su revision administrativa tras una modificacion sensible.
 *
 * Tipo: Funcion asincrona auxiliar.
 * Parametros: Cadena de texto correspondiente al identificador del negocio.
 * Retorno: Promesa vacia que confirma la actualizacion.
 * Efecto: Actualizar la marca de tiempo de modificacion en el registro, lo cual 
 * puede ser detectado por rutinas de auditoria o paneles administrativos.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 */
async function sQueueBusinessForReview(businessId: string) {
  const { error } = await lSupabase
    .from('businesses')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', businessId)

  if (error) {
    throw new Error(`No se pudo enviar el negocio a revisión: ${error.message}`)
  }
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

/**
 * Esquemas de validacion estructural para las rutas de negocios.
 * Centralizan las reglas de negocio, formatos de red y tipados requeridos 
 * para garantizar la integridad de los datos entrantes antes del procesamiento.
 */
const rNearbyQuerySchema = z.object({
  lat:    z.coerce.number().min(-90).max(90),
  lng:    z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(100).max(10000).default(2000).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  limit:  z.coerce.number().int().min(1).max(50).default(20).optional(),
  q:      z.string().trim().optional(),
})

const rScheduleDaySchema = z.tuple([
  z.string().regex(/^\d{2}:\d{2}$/),
  z.string().regex(/^\d{2}:\d{2}$/),
]).nullable()

const rScheduleSchema = z.object({
  mon: rScheduleDaySchema, tue: rScheduleDaySchema,
  wed: rScheduleDaySchema, thu: rScheduleDaySchema,
  fri: rScheduleDaySchema, sat: rScheduleDaySchema,
  sun: rScheduleDaySchema,
}).optional()

const rCreateBusinessSchema = z.object({
  name:        z.string().min(2).max(120).trim(),
  category_id: z.number().int().positive(),
  description: z.string().min(10).max(1000).trim(),
  lat:         z.number().min(-90).max(90),
  lng:         z.number().min(-180).max(180),
  address:     z.string().min(5).max(300).trim(),
  city:        z.enum(['cdmx', 'guadalajara', 'monterrey']),
  phone:       z.string().regex(/^\+?[\d\s\-()]{7,20}$/).optional(),
  website:     z.string().url().optional(),
  accepts_card: z.boolean().default(false),
  schedule:    rScheduleSchema,
})

// Schema para actualizar negocio — todos los campos opcionales
const rUpdateBusinessSchema = z.object({
  name:        z.string().min(2).max(120).trim().optional(),
  description: z.string().min(10).max(1000).trim().optional(),
  address:     z.string().min(5).max(300).trim().optional(),
  city:        z.enum(['cdmx', 'guadalajara', 'monterrey']).optional(),
  phone:       z.string().regex(/^\+?[\d\s\-()]{7,20}$/).optional().nullable(),
  website:     z.string().url().optional().nullable(),
  accepts_card: z.boolean().optional(),
  category_id: z.number().int().positive().optional(),
  schedule:    rScheduleSchema,
  lat:         z.number().min(-90).max(90).optional(),
  lng:         z.number().min(-180).max(180).optional(),
}).refine(
  data => Object.keys(data).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar' }
)

const rAddMenuItemSchema = z.object({
  name:  z.string().min(1).max(100).trim(),
  price: z.coerce.number().finite().min(0).max(99999.99).optional(),
  icon:  z.string().max(10).optional(),
})

const rChatOnboardingSchema = z.object({
  message: z.string().min(1),
  history: z.string().optional(),
})

// ─── GET /businesses ──────────────────────────────────────────────────────────

/**
 * Localizar y retornar un listado de negocios basandose en proximidad geografica.
 *
 * Ruta asociada: Peticion tipo Get a la raiz del recurso.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red con variables de consulta para coordenadas y radio.
 * Retorno: Promesa que entrega un objeto Json con los comercios detectados.
 * Efecto: Ejecutar una busqueda geoespacial. Extraer credenciales de forma pasiva 
 * para personalizar la respuesta si el usuario se encuentra autenticado, sin 
 * bloquear el acceso a usuarios anonimos.
 *
 * Complejidad temporal: Orden logaritmico O(log n) en la base de datos gracias a los 
 * indices espaciales, mas un filtrado lineal O(r) en la memoria del servidor donde 
 * r es el numero de resultados parciales si se utiliza termino de busqueda.
 * Complejidad espacial: Orden lineal O(r) para contener los resultados mapeados.
 * Escalabilidad: Altamente escalable. La operacion mas pesada se delega al motor 
 * especializado en coordenadas espaciales.
 */
rBusinesses.get('/', zValidator('query', rNearbyQuerySchema), async (ctx) => {
  const query = ctx.req.valid('query')
  let userId: string | null = null

  const authHeader = ctx.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { sVerifyAccessToken } = await import('../services/s-auth.js')
      const payload = await sVerifyAccessToken(authHeader.slice(7))
      userId = payload.sub
    } catch { /* anónimo */ }
  }

  try {
    const businesses = await qGetNearbyBusinesses({
      lat:        query.lat,
      lng:        query.lng,
      radiusM:    query.radius ?? 2000,
      userId,
      categoryId: query.category_id ?? null,
      limit:      query.limit ?? 20,
      q:          query.q,
    })

    return ctx.json<ApiResponse>({
      data: {
        businesses,
        total: businesses.length,
        query: {
          lat:         query.lat,
          lng:         query.lng,
          radius_m:    query.radius ?? 2000,
          category_id: query.category_id ?? null,
          q:           query.q,
        },
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener negocios'
    return ctx.json<ApiResponse>({ data: null, error: message }, 500)
  }
})

// ─── GET /businesses/owner/mine ───────────────────────────────────────────────
// Ahora incluye lat, lng e imágenes

/**
 * Obtener la informacion completa del negocio perteneciente al usuario solicitante.
 *
 * Ruta asociada: Peticion tipo Get exclusiva para propietarios.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red autenticado.
 * Retorno: Promesa con el perfil estructurado del comercio asociado.
 * Efecto: Consultar el repositorio filtrando por la identidad del emisor, normalizar 
 * el formato de las coordenadas y organizar el arreglo de imagenes segun su posicion.
 *
 * Complejidad temporal: Orden constante O(1). Lectura directa por clave foranea.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Optima, asegurando carga instantanea para los paneles de control.
 */
rBusinesses.get('/owner/mine', mAuth, mRequireRole('owner', 'admin'), async (ctx) => {
  const userId = ctx.get('userId')

  try {
    const { data: business, error } = await lSupabase
      .from('businesses')
      .select(`
        id, name, description, address, city, phone, website,
        category_id, accepts_card, schedule, status, location,
        menu_items ( id, name, price, icon, is_available ),
        business_images ( id, storage_path, sort_order )
      `)
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .single()

    if (error || !business) {
      return ctx.json<ApiResponse>(
        { data: null, error: 'No tienes ningún negocio registrado' },
        404
      )
    }

    const { lat, lng } = sExtractLatLngFromLocation((business as { location?: unknown }).location)

    // Normalizar imágenes para que el frontend reciba el mismo formato
    const images = ((business as any).business_images || [])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((img: any) => ({
        id:           img.id,
        storage_path: img.storage_path,
        position:     img.sort_order ?? 0,
      }))

    return ctx.json<ApiResponse>({
      data: {
        ...business,
        location: undefined,
        lat,
        lng,
        business_images: undefined, // quitamos el campo raw
        images,
      },
      error: null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener negocio'
    return ctx.json<ApiResponse>({ data: null, error: message }, 500)
  }
})

// ─── GET /businesses/:id ──────────────────────────────────────────────────────

/**
 * Solicitar el perfil detallado y publico de un comercio especifico.
 *
 * Ruta asociada: Peticion tipo Get apuntando a un identificador concreto.
 * Tipo: Controlador asincrono.
 * Parametros: Identificador extraido de la ruta y parametro opcional de idioma.
 * Retorno: Promesa que entrega los datos cruzados del negocio.
 * Efecto: Validar el formato del identificador y delegar la consulta compleja 
 * a la capa de abstraccion de base de datos, solicitando traducciones dinamicas 
 * si es pertinente.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Alta. Disenado para responder a multiples turistas simultaneamente.
 */
rBusinesses.get('/:id', async (ctx) => {
  const { id } = ctx.req.param()
  const lang   = ctx.req.query('lang') ?? 'es'

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return ctx.json<ApiResponse>({ data: null, error: 'ID de negocio inválido' }, 400)
  }

  const validLangs = ['es', 'en', 'fr', 'pt', 'de', 'zh']
  const safeLang = validLangs.includes(lang) ? lang : 'es'

  try {
    const business = await qGetBusinessById(id, safeLang)
    if (!business) {
      return ctx.json<ApiResponse>({ data: null, error: 'Negocio no encontrado o no disponible' }, 404)
    }
    return ctx.json<ApiResponse>({ data: business, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener negocio'
    return ctx.json<ApiResponse>({ data: null, error: message }, 500)
  }
})

// ─── PATCH /businesses/:id ────────────────────────────────────────────────────
// Editar datos del negocio. Solo el dueño puede editar el suyo.

/**
 * Actualizar atributos particulares del perfil de un comercio.
 *
 * Ruta asociada: Peticion de modificacion parcial protegida.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto con identificador de ruta y cuerpo validado de actualizaciones.
 * Retorno: Promesa confirmando el cambio y devolviendo el estado actual.
 * Efecto: Validar autorizacion de pertenencia si el usuario no es administrador, 
 * componer el campo espacial si existen nuevas coordenadas y ejecutar la transaccion.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Robusta, implementando validaciones exhaustivas de seguridad para 
 * mantener la integridad referencial sin sacrificar la velocidad de modificacion.
 */
rBusinesses.patch(
  '/:id',
  mAuth,
  mRequireRole('owner', 'admin'),
  zValidator('json', rUpdateBusinessSchema),
  async (ctx) => {
    const { id }   = ctx.req.param()
    const userId   = ctx.get('userId')
    const role     = ctx.get('userRole')
    const updates  = ctx.req.valid('json')

    // Verificar ownership (admin puede editar cualquiera)
    if (role !== 'admin') {
      const isOwner = await qVerifyBusinessOwner(id, userId)
      if (!isOwner) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'No tienes permiso para modificar este negocio' },
          403
        )
      }
    }

    try {
      const {
        lat,
        lng,
        ...restUpdates
      } = updates

      const updatePayload: Record<string, unknown> = {
        ...restUpdates,
        updated_at: new Date().toISOString(),
      }

      if (lat !== undefined || lng !== undefined) {
        const { data: existingBusiness, error: existingError } = await lSupabase
          .from('businesses')
          .select('location')
          .eq('id', id)
          .single()

        if (existingError || !existingBusiness) {
          return ctx.json<ApiResponse>(
            { data: null, error: existingError?.message ?? 'No se pudo leer la ubicación actual del negocio' },
            500
          )
        }

        const currentCoords = sExtractLatLngFromLocation((existingBusiness as { location?: unknown }).location)
        const nextLat = lat ?? currentCoords.lat
        const nextLng = lng ?? currentCoords.lng

        if (nextLat == null || nextLng == null) {
          return ctx.json<ApiResponse>(
            { data: null, error: 'No se pudo determinar la ubicación final del negocio' },
            400
          )
        }

        updatePayload.location = `POINT(${nextLng} ${nextLat})`
      }

      const { data, error } = await lSupabase
        .from('businesses')
        .update(updatePayload)
        .eq('id', id)
        .select(`
          id, name, description, address, city, phone, website,
          category_id, accepts_card, schedule, status, location
        `)
        .single()

      if (error || !data) {
        return ctx.json<ApiResponse>(
          { data: null, error: error?.message ?? 'Error al actualizar' },
          500
        )
      }

      const coords = sExtractLatLngFromLocation((data as { location?: unknown }).location)

      return ctx.json<ApiResponse>({
        data: {
          ...data,
          location: undefined,
          lat: coords.lat,
          lng: coords.lng,
        },
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar negocio'
      return ctx.json<ApiResponse>({ data: null, error: message }, 500)
    }
  }
)

// ─── DELETE /businesses/:id/images/:imageId ───────────────────────────────────
// Eliminar una foto del negocio. Borra de Supabase Storage y de la tabla.

/**
 * Eliminar permanentemente un recurso visual asociado al negocio.
 *
 * Ruta asociada: Peticion de eliminacion apuntando a la galeria.
 * Tipo: Controlador asincrono.
 * Parametros: Identificadores anidados tanto del negocio como del archivo.
 * Retorno: Promesa confirmando la liberacion del recurso.
 * Efecto: Validar pertinencia, invocar la interfaz del proveedor de almacenamiento 
 * para purgar el objeto fisico y finalmente remover el vinculo logico en la tabla, 
 * marcando el negocio para una reevaluacion si es modificado por un civil.
 *
 * Complejidad temporal: Orden constante O(1). Restringido por la comunicacion 
 * de red hacia el cubo de almacenamiento y la base de datos de manera secuencial.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente tolerante a fallos. Si el recurso fisico ya fue removido, 
 * la ejecucion continua para sanear la tabla, asegurando la consistencia de los datos.
 */
rBusinesses.delete(
  '/:id/images/:imageId',
  mAuth,
  mRequireRole('owner', 'admin'),
  async (ctx) => {
    const { id, imageId } = ctx.req.param()
    const userId = ctx.get('userId')
    const role   = ctx.get('userRole')

    // Verificar ownership
    if (role !== 'admin') {
      const isOwner = await qVerifyBusinessOwner(id, userId)
      if (!isOwner) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'No tienes permiso para eliminar imágenes de este negocio' },
          403
        )
      }
    }

    try {
      // 1. Obtener el storage_path antes de borrar
      const { data: imgRecord, error: fetchErr } = await lSupabase
        .from('business_images')
        .select('id, storage_path')
        .eq('id', imageId)
        .eq('business_id', id)
        .single()

      if (fetchErr || !imgRecord) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'Imagen no encontrada' },
          404
        )
      }

      // 2. Borrar del Storage de Supabase
      const { error: storageErr } = await lSupabase.storage
        .from('business_images')
        .remove([imgRecord.storage_path])

      if (storageErr) {
        console.warn('[delete-image] Storage error (continuando):', storageErr.message)
        // No bloqueamos — si el archivo ya no existe en storage, seguimos
      }

      // 3. Borrar el registro de la BD
      const { error: dbErr } = await lSupabase
        .from('business_images')
        .delete()
        .eq('id', imageId)

      if (dbErr) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'Error al eliminar la imagen de la base de datos' },
          500
        )
      }

      if (role !== 'admin') {
        await sQueueBusinessForReview(id)
      }

      return ctx.json<ApiResponse>({ data: { deleted: true }, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar imagen'
      return ctx.json<ApiResponse>({ data: null, error: message }, 500)
    }
  }
)

// ─── GET /businesses/:id/qr-token ─────────────────────────────────────────────

/**
 * Generar un testigo criptografico desechable para la emision de codigos fisicos.
 *
 * Ruta asociada: Peticion tipo Get protegida para visualizacion del propietario.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto con identificador de ruta.
 * Retorno: Promesa resolviendo en un token seguro y una Url para renderizado.
 * Efecto: Validar identidad y delegar la firma de un secreto criptografico asimetrico 
 * que sera consumido posteriormente por la capa cliente para la asignacion de estampas.
 *
 * Complejidad temporal: Orden constante O(1). Calculo criptografico en memoria.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Extrema. Al no almacenar fisicamente los codigos emitidos y depender 
 * de validaciones libres de estado, la generacion no satura los repositorios.
 */
rBusinesses.get('/:id/qr-token', mAuth, mRequireRole('owner', 'admin'), async (ctx) => {
  const { id }  = ctx.req.param()
  const userId  = ctx.get('userId')
  const role    = ctx.get('userRole')

  if (role !== 'admin') {
    const isOwner = await qVerifyBusinessOwner(id, userId)
    if (!isOwner) {
      return ctx.json<ApiResponse>({ data: null, error: 'No tienes permiso para acceder a este QR' }, 403)
    }
  }

  const { data: business } = await lSupabase
    .from('businesses')
    .select('id, name')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!business) {
    return ctx.json<ApiResponse>({ data: null, error: 'Negocio no encontrado' }, 404)
  }

  const token = await sGenerateQrToken(id)

  return ctx.json<ApiResponse>({
    data: {
      qr_token:      token,
      business_id:   id,
      business_name: business.name,
      qr_content:    `https://tuapp.com/checkin?token=${token}`,
    },
    error: null,
  })
})

// ─── POST /businesses/onboarding/chat ─────────────────────────────────────────

/**
 * Gestionar la iteracion conversacional para el registro interactivo de nuevos comercios.
 *
 * Ruta asociada: Peticion de mensajeria interactiva para propietarios.
 * Tipo: Controlador asincrono.
 * Parametros: Historial concatenado y mensaje actual del usuario.
 * Retorno: Promesa con la respuesta generativa o los campos estructurados finales.
 * Efecto: Canalizar el contexto hacia el proveedor de inteligencia artificial en la capa cuatro.
 * Si se detecta el fin de la conversacion, instruir al modelo para extraer los parametros del negocio.
 *
 * Complejidad temporal: Orden constante O(1) localmente; latencia dominada por el servicio externo.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Alta, disenada para ser no bloqueante y gestionar flujos interactivos de 
 * forma progresiva.
 */
rBusinesses.post(
  '/onboarding/chat',
  mAuth,
  mRequireRole('owner'),
  zValidator('json', rChatOnboardingSchema),
  async (ctx) => {
    const { message, history } = ctx.req.valid('json')
    const fullHistory = history ? `${history}\nDueño: ${message}` : `Dueño: ${message}`

    try {
      const { sGenerarSiguientePregunta, extraerDatosNegocio } = await import('../services/s-gemini.js')
      const respuestaIA = await sGenerarSiguientePregunta(fullHistory)

      if (respuestaIA.includes('REGISTRO_COMPLETO')) {
        const datosExtraidos = await extraerDatosNegocio(fullHistory)
        return ctx.json<ApiResponse>({
          data: {
            isComplete:    true,
            extractedData: datosExtraidos,
            reply:         '¡Perfecto! Tengo todo lo necesario. Revisa que los datos sean correctos antes de guardar.',
          },
          error: null,
        })
      }

      return ctx.json<ApiResponse>({
        data: {
          isComplete:      false,
          reply:           respuestaIA,
          updatedHistory:  `${fullHistory}\nAsistente: ${respuestaIA}`,
        },
        error: null,
      })
    } catch (err) {
      console.error('[onboarding/chat]', err)
      return ctx.json<ApiResponse>({ data: null, error: 'Error al comunicarse con la IA' }, 500)
    }
  }
)

// ─── POST /businesses/upload-image ────────────────────────────────────────────

/**
 * Transferir un archivo multimedia binario hacia el proveedor de almacenamiento en la nube.
 *
 * Ruta asociada: Peticion de carga de archivos (Multipart/form-data).
 * Tipo: Controlador asincrono.
 * Parametros: Datos de formulario nativos conteniendo el flujo de bytes del archivo e indices.
 * Retorno: Promesa devolviendo el localizador fisico asignado al archivo.
 * Efecto: Ensamblar una ruta organizativa unica utilizando la estampa de tiempo y transmitir 
 * los bytes a la capa de infraestructura.
 *
 * Complejidad temporal: O(m) proporcional al tamano de los bytes en transito.
 * Complejidad espacial: O(m) debido a la memoria temporal requerida para procesar el flujo.
 * Escalabilidad: Limitada en casos de cargas masivas sin transmision segmentada (streams), 
 * aunque tolerable para volumenes controlados de imagenes web.
 */
rBusinesses.post('/upload-image', mAuth, mRequireRole('owner'), async (ctx) => {
  const userId = ctx.get('userId')

  try {
    const formData = await ctx.req.raw.formData()
    const file     = formData.get('file') as File | null
    const index    = (formData.get('index') as string) ?? '0'

    if (!file) {
      return ctx.json<ApiResponse>({ data: null, error: 'No se recibió ningún archivo' }, 400)
    }

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/${Date.now()}_${index}.${ext}`

    const { error: uploadError } = await lSupabase.storage
      .from('business_images')
      .upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })

    if (uploadError) {
      console.error('[upload-image] Supabase error:', uploadError)
      return ctx.json<ApiResponse>({ data: null, error: uploadError.message }, 500)
    }

    return ctx.json<ApiResponse>({ data: { path }, error: null }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno al subir imagen'
    console.error('[upload-image] crash:', err)
    return ctx.json<ApiResponse>({ data: null, error: message }, 500)
  }
})

// ─── POST /businesses/save-images ─────────────────────────────────────────────

/**
 * Vincular rutas fisicas de imagenes recien cargadas a un registro de entidad comercial.
 *
 * Ruta asociada: Peticion de consolidacion post-carga.
 * Tipo: Controlador asincrono.
 * Parametros: Identificador del negocio y un arreglo con los localizadores fisicos.
 * Retorno: Promesa confirmando las inserciones relacionales.
 * Efecto: Consultar la ultima posicion de ordenamiento disponible, componer multiples filas 
 * garantizando la consistencia del marcado principal y ejecutarlas en bloque.
 *
 * Complejidad temporal: Orden lineal O(p) donde p es el numero de imagenes a registrar.
 * Complejidad espacial: Orden lineal O(p) para construir las filas en memoria.
 * Escalabilidad: Altamente escalable al utilizar mecanismos de insercion multiple nativa.
 */
rBusinesses.post('/save-images', mAuth, mRequireRole('owner'), async (ctx) => {
  try {
    const { business_id, storage_paths } = await ctx.req.json<{
      business_id:   string
      storage_paths: string[]
    }>()

    // Obtener el sort_order más alto actual para no pisar posiciones existentes
    const { data: existing } = await lSupabase
      .from('business_images')
      .select('sort_order')
      .eq('business_id', business_id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const baseOrder = (existing?.[0]?.sort_order ?? -1) + 1

    const imageRows = storage_paths.map((storage_path, idx) => ({
      business_id,
      storage_path,
      is_primary: baseOrder === 0 && idx === 0, // solo la primera es portada si no había fotos
      sort_order: baseOrder + idx,
    }))

    const { data: inserted, error } = await lSupabase
      .from('business_images')
      .insert(imageRows)
      .select('id, storage_path, sort_order')

    if (error) {
      return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
    }

    await sQueueBusinessForReview(business_id)

    return ctx.json<ApiResponse>({ data: inserted, error: null }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al guardar imágenes'
    return ctx.json<ApiResponse>({ data: null, error: message }, 500)
  }
})

// ─── POST /businesses/:id/videos ──────────────────────────────────────────────
// Registra la ruta de un video (pre o post mundial) en la base de datos

/**
 * Suscribir una ruta fisica de video a la entidad de negocio como presentacion.
 *
 * Ruta asociada: Insercion de relaciones de contenido audiovisual.
 * Tipo: Controlador asincrono.
 * Parametros: Localizador de archivo e indicador de clasificacion pre o post celebracion.
 * Retorno: Promesa devolviendo informacion relacional del registro.
 * Efecto: Autenticar propiedad e insertar un nuevo apuntador con proteccion nativa contra duplicados.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Alta, el control de indices unicos delega el esfuerzo al motor relacional 
 * evitando revisiones repetitivas en memoria.
 */
rBusinesses.post(
  '/:id/videos',
  mAuth,
  mRequireRole('owner', 'admin'),
  zValidator('json', z.object({
    storage_path: z.string().min(1, 'La ruta del video es requerida'),
    video_type: z.enum(['pre_worldcup', 'post_worldcup'])
  })),
  async (ctx) => {
    const { id } = ctx.req.param()
    const userId = ctx.get('userId')
    const role   = ctx.get('userRole')
    const { storage_path, video_type } = ctx.req.valid('json')

    // Verificar ownership (admin puede editar cualquiera)
    if (role !== 'admin') {
      const isOwner = await qVerifyBusinessOwner(id, userId)
      if (!isOwner) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'No tienes permiso para modificar este negocio' },
          403
        )
      }
    }

    const { data, error } = await lSupabase
      .from('business_videos')
      .insert({
        business_id: id,
        storage_path,
        video_type
      })
      .select('id, storage_path, video_type, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return ctx.json<ApiResponse>({ 
          data: null, 
          error: `Ya existe un video de tipo '${video_type}'. Bórralo antes de subir otro.` 
        }, 400)
      }
      return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
    }

    return ctx.json<ApiResponse>({ data, error: null }, 201)
  }
)

// ─── DELETE /businesses/:id/videos/:videoId ───────────────────────────────────
// Elimina un video específico del negocio

/**
 * Disolver el enlace entre un negocio y un recurso multimedia.
 *
 * Ruta asociada: Eliminacion fisica especifica en arreglo audiovisual.
 * Tipo: Controlador asincrono.
 * Parametros: Identificadores referenciales de ambas entidades.
 * Retorno: Promesa confirmando estado booleano de desvinculacion.
 * Efecto: Validar con la base de datos y forzar la coincidencia exacta de negocio-video 
 * para purgar el elemento indeseado de manera segura.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Excelente, protegiendo operaciones transversales criticas con coincidencia doble.
 */
rBusinesses.delete(
  '/:id/videos/:videoId',
  mAuth,
  mRequireRole('owner', 'admin'),
  async (ctx) => {
    const { id, videoId } = ctx.req.param()
    const userId = ctx.get('userId')
    const role   = ctx.get('userRole')

    // Verificar ownership
    if (role !== 'admin') {
      const isOwner = await qVerifyBusinessOwner(id, userId)
      if (!isOwner) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'No tienes permiso para modificar este negocio' },
          403
        )
      }
    }

    const { error } = await lSupabase
      .from('business_videos')
      .delete()
      .match({ id: videoId, business_id: id }) // Doble validación por seguridad

    if (error) {
      return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
    }
    
    return ctx.json<ApiResponse>({ data: { deleted: true, video_id: videoId }, error: null })
  }
)

// ─── POST /businesses ─────────────────────────────────────────────────────────

/**
 * Procesar la creacion formal de una nueva entidad comercial por parte de un propietario.
 *
 * Ruta asociada: Metodo Post a la raiz del recurso.
 * Tipo: Controlador asincrono.
 * Parametros: Objeto estructurado con todos los parametros operativos.
 * Retorno: Promesa devolviendo una previsualizacion del perfil basico y un mensaje informativo.
 * Efecto: Enlazar con la capa de datos delegando la insercion al modulo de consultas especifico.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Optimizada para mantener controladores delgados, centralizando 
 * la transaccion real en abstracciones de persistencia reutilizables.
 */
rBusinesses.post(
  '/',
  mAuth,
  mRequireRole('owner'),
  zValidator('json', rCreateBusinessSchema),
  async (ctx) => {
    const body   = ctx.req.valid('json')
    const userId = ctx.get('userId')

    try {
      const created = await qCreateBusiness({
        ownerId:     userId,
        name:        body.name,
        categoryId:  body.category_id,
        description: body.description,
        lat:         body.lat,
        lng:         body.lng,
        address:     body.address,
        city:        body.city,
        phone:       body.phone,
        website:     body.website,
        acceptsCard: body.accepts_card,
        schedule:    body.schedule,
      })

      return ctx.json<ApiResponse>({
        data: {
          ...created,
          status:  'pending',
          message: 'Negocio creado correctamente. Quedará visible tras la aprobación del administrador.',
        },
        error: null,
      }, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear negocio'
      const status  = message.includes('unique') ? 409 : 400
      return ctx.json<ApiResponse>({ data: null, error: message }, status)
    }
  }
)

// ─── POST /businesses/:id/menu ────────────────────────────────────────────────

/**
 * Anadir un producto al listado gastronomico de un negocio determinado.
 *
 * Ruta asociada: Endpoint anidado de insercion al menu.
 * Tipo: Controlador asincrono.
 * Parametros: Parametros de red detallando la informacion comercial del platillo.
 * Retorno: Promesa entregando la representacion del elemento ya registrado.
 * Efecto: Comprobar el dominio sobre el recurso y ejecutar la insercion logica.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Excelente, manteniendo la integridad transaccional nativa de la tabla de elementos.
 */
rBusinesses.post(
  '/:id/menu',
  mAuth,
  mRequireRole('owner', 'admin'),
  zValidator('json', rAddMenuItemSchema),
  async (ctx) => {
    const { id }  = ctx.req.param()
    const body    = ctx.req.valid('json')
    const userId  = ctx.get('userId')
    const role    = ctx.get('userRole')

    if (role !== 'admin') {
      const isOwner = await qVerifyBusinessOwner(id, userId)
      if (!isOwner) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'No tienes permiso para modificar este negocio' },
          403
        )
      }
    }

    try {
      const item = await qAddMenuItem({
        businessId: id,
        name:       body.name,
        price:      body.price,
        icon:       body.icon,
      })

      if (role !== 'admin') {
        await sQueueBusinessForReview(id)
      }

      return ctx.json<ApiResponse>({ data: item, error: null }, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al agregar ítem'
      return ctx.json<ApiResponse>({ data: null, error: message }, 400)
    }
  }
)

// ─── DELETE /businesses/:id/menu/:itemId ─────────────────────────────────────

/**
 * Remover un elemento especifico del menu de opciones operativas.
 *
 * Ruta asociada: Endpoint anidado de eliminacion de productos.
 * Tipo: Controlador asincrono.
 * Parametros: Identificador del plato a excluir e identificador de establecimiento.
 * Retorno: Promesa reportando estado de operacion booleana.
 * Efecto: Ejecutar verificaciones cruzadas y realizar borrado definitivo en la persistencia.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable, con comprobaciones primarias pre-eliminacion seguras.
 */
rBusinesses.delete(
  '/:id/menu/:itemId',
  mAuth,
  mRequireRole('owner', 'admin'),
  async (ctx) => {
    const { id, itemId } = ctx.req.param()
    const userId = ctx.get('userId')
    const role = ctx.get('userRole')

    if (role !== 'admin') {
      const isOwner = await qVerifyBusinessOwner(id, userId)
      if (!isOwner) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'No tienes permiso para modificar este negocio' },
          403
        )
      }
    }

    try {
      const { data: existingItem, error: existingError } = await lSupabase
        .from('menu_items')
        .select('id')
        .eq('id', itemId)
        .eq('business_id', id)
        .single()

      if (existingError || !existingItem) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'El producto no existe o ya fue eliminado' },
          404
        )
      }

      const { error } = await lSupabase
        .from('menu_items')
        .delete()
        .eq('id', itemId)
        .eq('business_id', id)

      if (error) {
        return ctx.json<ApiResponse>(
          { data: null, error: error.message || 'No se pudo eliminar el producto' },
          500
        )
      }

      if (role !== 'admin') {
        await sQueueBusinessForReview(id)
      }

      return ctx.json<ApiResponse>({
        data: { deleted: true, item_id: itemId },
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar el producto'
      return ctx.json<ApiResponse>({ data: null, error: message }, 500)
    }
  }
)



// ─── PATCH /businesses/:id/worldcup-status ────────────────────────────────────
// Cambia el estado del mundial (activa el video de despedida)

/**
 * Modificar la bandera de estado global representativa del cierre del evento magno.
 *
 * Ruta asociada: Operacion de actualizacion rapida de contexto cronologico.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto provisto con una carga de datos logica booleana.
 * Retorno: Promesa que confirma la mutacion reflejando el id afectado.
 * Efecto: Sobreescribir el estado para habilitar comportamientos graficos especiales 
 * dependientes de esta bandera directamente en la capa de la base de datos relacional.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Completamente escalable mediante escrituras atomicas de campos primitivos.
 */
rBusinesses.patch(
  '/:id/worldcup-status',
  mAuth,
  mRequireRole('owner', 'admin'),
  zValidator('json', z.object({
    worldcup_finished: z.boolean()
  })),
  async (ctx) => {
    const { id } = ctx.req.param()
    const userId = ctx.get('userId')
    const role   = ctx.get('userRole')
    const { worldcup_finished } = ctx.req.valid('json')

    // Verificar ownership
    if (role !== 'admin') {
      const isOwner = await qVerifyBusinessOwner(id, userId)
      if (!isOwner) {
        return ctx.json<ApiResponse>(
          { data: null, error: 'No tienes permiso para modificar este negocio' },
          403
        )
      }
    }

    const { data, error } = await lSupabase
      .from('businesses')
      .update({ worldcup_finished })
      .eq('id', id)
      .select('id, worldcup_finished')
      .single()

    if (error) {
      return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
    }
    
    return ctx.json<ApiResponse>({ data, error: null })
  }
)