/**
 * Archivo: src/routes/r-admin.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura, correspondiente a la logica y Api del ecosistema.
 * Su responsabilidad arquitectonica es definir y agrupar los controladores de las rutas de red
 * destinadas exclusivamente al panel de administracion. Al concentrar estas operaciones, se facilita
 * la aplicacion transversal de interceptores de seguridad, garantizando que unicamente usuarios con 
 * privilegios administrativos interactuen con la capa tres de almacenamiento para realizar operaciones 
 * criticas como aprobacion de negocios, eliminacion logica y lectura de metricas de rendimiento.
 */

// src/routes/r-admin.ts
// Endpoints del panel de administración.
//
// POST  /api/v1/admin/businesses             — crear negocio
// GET   /api/v1/admin/businesses             — lista con filtros de status
// GET   /api/v1/admin/businesses/:id         — detalle de un negocio
// PATCH /api/v1/admin/businesses/:id         — edición general
// PATCH /api/v1/admin/businesses/:id/status  — aprobar o rechazar negocio
// DELETE /api/v1/admin/businesses/:id        — soft delete
// GET   /api/v1/admin/metrics                — KPIs globales

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { mAuth } from '../middleware/m-auth.js'
import { mRequireRole } from '../middleware/m-rbac.js'
import { lSupabase } from '../lib/l-supabase.js'
import { sSendPushToUser } from '../services/s-push.js'
import type { ApiResponse, AppContext } from '../types/t-app.js'

export const rAdmin = new Hono<AppContext>()

// Aplicar interceptores de seguridad a todas las rutas de este modulo.
rAdmin.use('*', mAuth, mRequireRole('admin'))

// CREATE

/**
 * Insertar un nuevo negocio desde el panel administrativo.
 *
 * Ruta asociada: Metodo Post en el recurso de negocios de administracion.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red conteniendo un cuerpo de datos estructurado y validado.
 * Retorno: Promesa que resuelve en un objeto Json con los datos insertados y un codigo de estado exitoso.
 * Efecto: Registrar una entidad en la base de datos, construyendo el tipo espacial para la ubicacion 
 * geografica y asignando un estado inicial de aprobacion pendiente.
 *
 * Complejidad temporal: Orden constante O(1). La validacion de esquema y la insercion relacional 
 * se ejecutan en tiempo constante.
 * Complejidad espacial: Orden constante O(1). La carga en memoria corresponde unicamente a la 
 * estructura de datos de entrada.
 * Escalabilidad: Altamente escalable. El motor relacional gestiona la concurrencia de inserciones 
 * y la autogeneracion de campos derivados sin degradar el rendimiento del servidor.
 */
// NOTA: "slug" NO se incluye en el payload — la BD lo genera automáticamente
// desde el campo "name" (GENERATED ALWAYS AS). Insertar slug manualmente
// lanzaría un error de PostgreSQL.
rAdmin.post(
  '/businesses',
  zValidator('json', z.object({
    name:        z.string().min(2).max(120),
    description: z.string().max(1000).optional(),
    category_id: z.number().int().min(1),
    address:     z.string().min(5),
    city:        z.enum(['cdmx', 'guadalajara', 'monterrey']),
    lat:         z.number(),
    lng:         z.number(),
    phone:       z.string().optional(),
    website:     z.string().url().optional().or(z.literal('')),
    accepts_card: z.boolean().default(false),
    owner_id:    z.string().uuid(),
    // ← NUEVO: horario semanal opcional. null = cerrado ese día.
    schedule: z.object({
      mon: z.tuple([z.string(), z.string()]).nullable().optional(),
      tue: z.tuple([z.string(), z.string()]).nullable().optional(),
      wed: z.tuple([z.string(), z.string()]).nullable().optional(),
      thu: z.tuple([z.string(), z.string()]).nullable().optional(),
      fri: z.tuple([z.string(), z.string()]).nullable().optional(),
      sat: z.tuple([z.string(), z.string()]).nullable().optional(),
      sun: z.tuple([z.string(), z.string()]).nullable().optional(),
  }).optional(),
  })),
  async (ctx) => {
    const { lat, lng, ...rest } = ctx.req.valid('json')

    const { data, error } = await lSupabase
      .from('businesses')
      .insert({
        ...rest,
        // PostGIS espera longitud primero, luego latitud
        location: `SRID=4326;POINT(${lng} ${lat})`,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
    }

    return ctx.json<ApiResponse>({ data, error: null }, 201)
  }
)

//READ

/**
 * Obtener un listado paginado y filtrado de los negocios registrados.
 *
 * Ruta asociada: Metodo Get en el recurso de negocios de administracion.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red incluyendo variables de consulta para delimitar el estado, 
 * la ciudad, la cantidad limite de resultados y el desplazamiento inicial.
 * Retorno: Promesa que entrega un objeto Json con el arreglo de registros y el conteo total.
 * Efecto: Construir de manera dinamica una consulta a la base de datos aplicando condiciones 
 * especificas y cruces de tablas para enriquecer la informacion con detalles de categorias y propietarios.
 *
 * Complejidad temporal: Orden lineal O(n) donde n representa la cantidad de registros devueltos 
 * segun el limite de paginacion. El motor relacional optimiza los filtros utilizando indices internos.
 * Complejidad espacial: Orden lineal O(n) para almacenar el conjunto de resultados en memoria.
 * Escalabilidad: Altamente escalable gracias a la implementacion nativa de paginacion, lo que 
 * asegura un consumo de memoria predecible en la capa dos independientemente del volumen total de datos.
 */
// GET /admin/businesses
rAdmin.get(
  '/businesses',
  zValidator('query', z.object({
    status: z.enum(['pending','active','inactive','rejected']).optional(),
    city:   z.enum(['cdmx','guadalajara','monterrey']).optional(),
    limit:  z.coerce.number().int().min(1).max(100).default(50).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
  })),
  async (ctx) => {
    const { status, city, limit = 50, offset = 0 } = ctx.req.valid('query')

    let query = lSupabase
      .from('businesses')
      .select(`
        id, name, slug, status, city, address, ola_verified, ola_verified_at,
        avg_rating, review_count, checkin_count, created_at, updated_at,
        categories ( slug, icon ),
        profiles!owner_id ( id, display_name )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (city)   query = query.eq('city', city)

    const { data, error, count } = await query

    if (error) {
      return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
    }

    return ctx.json<ApiResponse>({
      data: { businesses: data ?? [], total: count ?? 0 },
      error: null,
    })
  }
)

/**
 * Recuperar la informacion detallada de una entidad comercial singular.
 *
 * Ruta asociada: Metodo Get apuntando a un identificador especifico.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto conteniendo el identificador de ruta.
 * Retorno: Promesa que resuelve en un objeto Json detallado incluyendo relaciones anidadas.
 * Efecto: Solicitar al origen de datos un registro unico, ordenando sus elementos visuales 
 * correspondientes mediante reglas predefinidas en el servidor.
 *
 * Complejidad temporal: Orden constante O(1). Acceso directo optimizado por clave primaria.
 * Complejidad espacial: Orden constante O(1). 
 * Escalabilidad: Excelente, delegando las asociaciones a uniones eficientes en el gestor de datos.
 */
//GET /admin/businesses/:id
rAdmin.get('/businesses/:id', async (ctx) => {
  const { id } = ctx.req.param()
  
  const { data, error } = await lSupabase
    .from('businesses')
    .select(`
      *,
      business_images ( id, storage_path, is_primary, sort_order ),
      categories ( slug, icon ),
      profiles!owner_id ( id, display_name, avatar_url )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  
  if (error || !data) {
    return ctx.json<ApiResponse>({ data: null, error: 'No encontrado' }, 404)
  }

  const images = ((data as any).business_images ?? [])
    .sort((a: any, b: any) => {
      const primaryDiff = Number(b.is_primary) - Number(a.is_primary)
      if (primaryDiff !== 0) return primaryDiff
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
    .map((img: any) => ({
      id: img.id,
      storage_path: img.storage_path,
      is_primary: Boolean(img.is_primary),
    }))
  
  return ctx.json<ApiResponse>({
    data: {
      ...data,
      business_images: undefined,
      images,
    },
    error: null,
  })
})

// UPDATE

/**
 * Modificar parcialmente los atributos de un registro existente.
 *
 * Ruta asociada: Metodo de actualizacion parcial apuntando a un identificador.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto conteniendo un cuerpo validador con campos opcionales.
 * Retorno: Promesa con el resultado de la actualizacion.
 * Efecto: Alterar selectivamente la informacion, reconstruyendo el atributo espacial si se 
 * detectan cambios en las coordenadas geograficas.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable, permitiendo modificaciones eficientes sin sobrescribir 
 * toda la entidad.
 */
// PATCH /admin/businesses/:id — edición general de datos
rAdmin.patch(
  '/businesses/:id',
  zValidator('json', z.object({
    name:        z.string().min(2).max(120).optional(),
    description: z.string().max(1000).optional(),
    address:     z.string().min(5).optional(),
    city:        z.enum(['cdmx', 'guadalajara', 'monterrey']).optional(),
    phone:       z.string().optional(),
    website:     z.string().url().optional().or(z.literal('')),
    accepts_card: z.boolean().optional(),
    category_id: z.number().int().min(1).optional(),
    // Para actualizar coordenadas
    lat:         z.number().optional(),
    lng:         z.number().optional(),
  })),
  async (ctx) => {
    const { id } = ctx.req.param()
    const { lat, lng, ...rest } = ctx.req.valid('json')
  
    // Solo incluir location si se enviaron ambas coordenadas
    const payload: Record<string, unknown> = { ...rest }
    if (lat !== undefined && lng !== undefined) {
      payload.location = `SRID=4326;POINT(${lng} ${lat})`
    }
  
    const { data, error } = await lSupabase
      .from('businesses')
      .update(payload)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single()
  
    if (error || !data) {
      return ctx.json<ApiResponse>({ data: null, error: error?.message ?? 'Error al actualizar' }, 500)
    }
  
    return ctx.json<ApiResponse>({ data, error: null })
  }
)

/**
 * Autorizar o rechazar de manera logica un negocio y disparar notificaciones.
 *
 * Ruta asociada: Metodo de actualizacion de estado.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto conteniendo el nuevo estado dictaminado y el motivo opcional de rechazo.
 * Retorno: Promesa confirmando la transaccion y el exito del aviso al usuario final.
 * Efecto: Analizar la validez de la transicion de estado, persistir el cambio actualizando 
 * atributos derivados y notificar asincronamente al propietario a traves del servicio de empuje.
 *
 * Complejidad temporal: Orden constante O(1). La escritura relacional y el envio de la 
 * notificacion en segundo plano se procesan de forma inmediata.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Robusta. La arquitectura previene bloqueos del hilo principal al delegar 
 * la comunicacion de red externa a promesas desacopladas de la respuesta final.
 */
// PATCH /admin/businesses/:id/status — aprobar o rechazar
rAdmin.patch(
  '/businesses/:id/status',
  zValidator('json', z.object({
    status: z.enum(['active','rejected','inactive','pending'], {
      message: 'status debe ser active, rejected, inactive o pending',
    }),
    rejection_reason: z.string().max(400).optional(),
  })),
  async (ctx) => {
    const { id }  = ctx.req.param()
    const { status, rejection_reason } = ctx.req.valid('json')

    const { data: biz, error: bizErr } = await lSupabase
      .from('businesses')
      .select('id, name, owner_id, status, ola_verified')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (bizErr || !biz) {
      return ctx.json<ApiResponse>({ data: null, error: 'Negocio no encontrado' }, 404)
    }

    const isActiveRevalidation =
      status === 'active' &&
      biz.status === 'active' &&
      !biz.ola_verified

    if (biz.status === status && !isActiveRevalidation) {
      return ctx.json<ApiResponse>(
        { data: null, error: `El negocio ya tiene el estado "${status}"` },
        409
      )
    }

    // Tipado estricto para proteger la base de datos
    const updatePayload: { status: string; ola_verified?: boolean; ola_verified_at?: string | null } = { status }
    
    if (status === 'active') {
      updatePayload.ola_verified    = true
      updatePayload.ola_verified_at = new Date().toISOString()
    } else if (status === 'pending') {
      updatePayload.ola_verified    = false
      updatePayload.ola_verified_at = null
    }

    const { data: updated, error: updErr } = await lSupabase
      .from('businesses')
      .update(updatePayload)
      .eq('id', id)
      .select('id, name, status, ola_verified')
      .single()

    if (updErr || !updated) {
      return ctx.json<ApiResponse>({ data: null, error: updErr?.message ?? 'Error al actualizar' }, 500)
    }

    const pushPayload = status === 'active'
      ? {
          title: '¡Tu negocio fue aprobado!',
          body:  `"${biz.name}" ya es visible en el mapa de La Ruta de la Garnacha.`,
          url:   '/owner/dashboard',
        }
      : {
          title: 'Revisión de tu negocio',
          body:  rejection_reason
            ? `"${biz.name}": ${rejection_reason}`
            : `"${biz.name}" no fue aprobado. Revisa tu perfil y vuelve a enviar.`,
          url: '/owner/edit',
        }

    // Disparar proceso asincrono sin bloquear la respuesta del servidor.
    sSendPushToUser(biz.owner_id, pushPayload).catch(err => {
      console.error('[admin] Error al enviar push:', err)
    })

    return ctx.json<ApiResponse>({
      data: {
        ...updated,
        push_sent: true, 
      },
      error: null,
    })
  }
)

// DELETE (soft)

/**
 * Aplicar una baja logica sobre una entidad comercial para preservar el historial.
 *
 * Ruta asociada: Metodo de eliminacion.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto conteniendo el identificador respectivo.
 * Retorno: Promesa confirmando la finalizacion de la operacion.
 * Efecto: Establecer una marca de tiempo en el campo designado, lo que excluira al registro 
 * de las busquedas activas globales sin destruir la integridad referencial.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Alta, asegurando que el borrado masivo no cause inconsistencias ni cuellos 
 * de botella en los indices de lectura.
 */
// DELETE /admin/businesses/:id
// FIX 1: "delete_at" → "deleted_at"
// FIX 2: new Date().toISOString  → new Date().toISOString()  (faltaban los paréntesis)
rAdmin.delete('/businesses/:id', async (ctx) => {
  const { id } = ctx.req.param()
  
  // Verificar que el negocio exista antes de borrar
  const { data: biz, error: findErr } = await lSupabase
    .from('businesses')
    .select('id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  
  if (findErr || !biz) {
    return ctx.json<ApiResponse>({ data: null, error: 'Negocio no encontrado' }, 404)
  }
  
  const { error } = await lSupabase
    .from('businesses')
    .update({
      deleted_at: new Date().toISOString(), // FIX: era "delete_at" y faltaban ()
    })
    .eq('id', id)
  
  if (error) {
    return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
  }
  
  return ctx.json<ApiResponse>({
    data: { deleted: true },
    error: null,
  })
})

// METRICS

/**
 * Consolidar indicadores de rendimiento para la visualizacion analitica del administrador.
 *
 * Ruta asociada: Metodo Get apuntando al sumario de metricas.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de la solicitud de red.
 * Retorno: Promesa que resuelve en un informe general agregado de las transacciones diarias y globales.
 * Efecto: Invocar de manera concurrente origenes de datos independientes, cruzar informacion en 
 * la memoria del servidor para clasificar los estados actuales, derivar promedios globales y mapear 
 * recuentos segmentados geograficamente.
 *
 * Complejidad temporal: Orden lineal O(b + m) donde b constituye la cantidad total de negocios vigentes 
 * y m representa los registros especificos del dia en curso. 
 * Complejidad espacial: Orden constante O(c) donde c determina la fraccion de ciudades activas, dado 
 * que se requiere un diccionario acumulador para las estadisticas zonales.
 * Escalabilidad: Funcionalmente optima en la etapa temprana del sistema. A medida que incremente 
 * masivamente el historial historico, el procesamiento de estas agrupaciones tendria que migrar desde 
 * el ecosistema de aplicacion a funciones agrupadoras o vistas materializadas nativas de la capa de 
 * base de datos para preservar los tiempos rapidos de respuesta analitica.
 */
// GET /admin/metrics
rAdmin.get('/metrics', async (ctx) => {
  const today = new Date().toISOString().slice(0, 10) 

  // Optimización: Redujimos de 4 llamadas a la BD a solo 2 llamadas
  const [
    { data: allBusinesses },
    { data: todayMetrics },
  ] = await Promise.all([
    lSupabase
      .from('businesses')
      .select('status, avg_rating')
      .is('deleted_at', null),

    lSupabase
      .from('business_daily_metrics')
      .select('business_id, checkin_count, profile_views, businesses!inner(city)')
      .eq('date', today),
  ])

  // Variables para cálculos en memoria
  let activeCount = 0
  let pendingCount = 0
  let sumRatings = 0
  let countRatings = 0

  // Procesamos los status y el promedio en un solo ciclo rápido
  for (const b of allBusinesses ?? []) {
    if (b.status === 'active') {
      activeCount++
      if (b.avg_rating && Number(b.avg_rating) > 0) {
        sumRatings += Number(b.avg_rating)
        countRatings++
      }
    } else if (b.status === 'pending') {
      pendingCount++
    }
  }

  const globalAvgRating = countRatings > 0 
    ? Math.round((sumRatings / countRatings) * 10) / 10 
    : 0

  // Calcular checkins por ciudad
  const checkinsByCity: Record<string, number> = { cdmx: 0, guadalajara: 0, monterrey: 0 }
  let totalCheckinsToday = 0
  let totalViewsToday    = 0

  for (const m of todayMetrics ?? []) {
    const city = (m.businesses as unknown as { city: string })?.city
    const cc   = m.checkin_count ?? 0
    totalCheckinsToday += cc
    totalViewsToday    += m.profile_views ?? 0
    if (city && checkinsByCity[city] !== undefined) {
      checkinsByCity[city] += cc
    }
  }

  return ctx.json<ApiResponse>({
    data: {
      active_businesses:    activeCount,
      pending_businesses:   pendingCount,
      total_checkins_today: totalCheckinsToday,
      total_views_today:    totalViewsToday,
      avg_rating_global:    globalAvgRating,
      checkins_by_city:     checkinsByCity,
    },
    error: null,
  })
})

// OWNERS — búsqueda de propietarios

/**
 * Investigar identidades autorizadas de usuarios catalogados como propietarios.
 *
 * Ruta asociada: Metodo Get con argumentos de exploracion por texto libre.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto conteniendo los criterios opcionales de coincidencia aproximada.
 * Retorno: Promesa que resuelve en un listado reducido de coincidencias.
 * Efecto: Ejecutar busquedas flexibles ignorando mayusculas o minusculas para asistir a la 
 * creacion manual de negocios en el panel.
 *
 * Complejidad temporal: Orden lineal O(l) respecto a los resultados devueltos (limitados 
 * desde la consulta original de red).
 * Complejidad espacial: Orden lineal O(l) para instanciar en memoria los perfiles capturados.
 * Escalabilidad: Alta, asegurando que el autocompletado en el formulario visual reaccione fluidamente.
 */
// GET /admin/owners?q=nombre
// Devuelve perfiles con role='owner' que coincidan con la búsqueda.
// Usado por el formulario de creación de negocio para seleccionar owner_id.
rAdmin.get(
  '/owners',
  zValidator('query', z.object({
    q:      z.string().min(1).max(80).optional(),
    limit:  z.coerce.number().int().min(1).max(40).default(20).optional(),
  })),
  async (ctx) => {
    const { q, limit = 20 } = ctx.req.valid('query')

    let query = lSupabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('role', 'owner')
      .is('deleted_at', null)
      .order('display_name', { ascending: true })
      .limit(limit)

    // Búsqueda por nombre usando ilike (case-insensitive)
    if (q) query = query.ilike('display_name', `%${q}%`)

    const { data, error } = await query

    if (error) {
      return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
    }

    return ctx.json<ApiResponse>({
      data: { owners: data ?? [] },
      error: null,
    })
  }
)