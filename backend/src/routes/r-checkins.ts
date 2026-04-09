/**
 * Archivo: src/routes/r-checkins.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se localiza en la capa dos de la arquitectura, que engloba la interfaz 
 * de programacion de aplicaciones y la logica de negocio. Su funcion arquitectonica es 
 * gestionar las transacciones de interaccion fisica entre los turistas y los comercios, 
 * actuando como el motor de validacion criptografica de los testigos de visita (codigos Qr) 
 * y el orquestador del sistema de lealtad, incluyendo puntos y recompensas.
 * Al aislar la logica de escaneo y la distribucion de puntos en este modulo, se protege 
 * la capa tres de manipulaciones directas y se garantiza la consistencia del saldo.
 */

// Endpoints de check-in y generación de Qr.
//
// Post /api/v1/checkins                      — registrar visita física (turista)
// Get  /api/v1/businesses/:id/qr-token       — obtener token Qr del negocio (owner)

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { mAuth } from '../middleware/m-auth.js'
import { mRequireRole } from '../middleware/m-rbac.js'
import { sVerifyQrToken, sGenerateQrToken } from '../services/s-qr.js'
import { lSupabase } from '../lib/l-supabase.js'
import { qVerifyBusinessOwner } from '../db/queries/q-businesses.js'
import type { ApiResponse, AppContext } from '../types/t-app.js'

export const rCheckins = new Hono<AppContext>()

/**
 * Esquemas de validacion estructural.
 *
 * Efecto: Definir las reglas estrictas de formato para el testigo criptografico y las 
 * coordenadas espaciales opcionales, previniendo inyecciones maliciosas y garantizando 
 * la integridad de la telemetria geografica.
 */
const rCheckinSchema = z.object({
  // Token temporal que viene del escaneo
  qr_token: z.string().min(1, 'El token del Qr es requerido'),
  // Ubicación aproximada del dispositivo en el momento del registro (opcional)
  // Se usa para análisis de movimiento — no se transmite al servidor en modo privacidad
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

/**
 * Registrar una visita fisica al establecimiento y asignar recompensas.
 *
 * Ruta asociada: Metodo Post en la raiz del recurso de visitas.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red transportando el testigo criptografico y las coordenadas de red.
 * Retorno: Promesa con el identificador de la transaccion y el saldo de puntos actualizado.
 * Efecto: Verificar la firma del testigo mediante el servicio criptografico, confirmar 
 * la vigencia del establecimiento, registrar la interaccion espacial, calcular bonificaciones 
 * por descubrimiento de categorias nuevas y delegar la transaccion numerica al motor relacional.
 *
 * Complejidad temporal: Orden lineal O(c) donde c es la cantidad de comercios bajo la 
 * misma categoria. Esta complejidad se deriva de la subconsulta requerida para deducir la 
 * bonificacion de primera visita, la cual escanea elementos similares.
 * Complejidad espacial: Orden constante O(1). Las estructuras en memoria son primitivas.
 * Escalabilidad: Moderada a alta. Aunque la subconsulta agrega tiempo de procesamiento, 
 * delegar las sumatorias al gestor relacional previene condiciones de carrera al actualizar 
 * el balance total del perfil, garantizando consistencia en eventos de alta concurrencia.
 */
rCheckins.post(
  '/',
  mAuth,
  mRequireRole('tourist'),
  zValidator('json', rCheckinSchema),
  async (ctx) => {
    const { qr_token, lat, lng } = ctx.req.valid('json')
    const userId = ctx.get('userId')

    // 1. Verificar la firma del testigo criptografico
    let businessId: string
    try {
      const qrPayload = await sVerifyQrToken(qr_token)
      businessId = qrPayload.sub
    } catch {
      return ctx.json<ApiResponse>(
        { data: null, error: 'Codigo invalido o no pertenece a esta plataforma' },
        400
      )
    }

    // 2. Verificar que el comercio destino existe y mantiene un estatus operativo
    const { data: business, error: bizError } = await lSupabase
      .from('businesses')
      .select('id, name, category_id')
      .eq('id', businessId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single()

    if (bizError || !business) {
      return ctx.json<ApiResponse>(
        { data: null, error: 'Negocio no encontrado o no disponible' },
        404
      )
    }

    // 3. Crear el registro cronologico
    // Construir el punto geografico unicamente si el cliente provee coordenadas validas
    const locationValue = (lat != null && lng != null)
      ? `POINT(${lng} ${lat})`
      : null

    const { data: checkin, error: checkinError } = await lSupabase
      .from('checkins')
      .insert({
        user_id:     userId,
        business_id: businessId,
        location:    locationValue,
      })
      .select('id, created_at')
      .single()

    if (checkinError || !checkin) {
      return ctx.json<ApiResponse>(
        { data: null, error: `Error al registrar visita: ${checkinError?.message}` },
        500
      )
    }

    // 4. Sumar el valor base de lealtad
    // La logica interna de la base de datos actualiza el total del perfil
    const { error: pointsError } = await lSupabase
      .from('point_transactions')
      .insert({
        user_id:  userId,
        amount:   50,
        action:   'checkin',
        ref_type: 'checkin',
        ref_id:   checkin.id,
      })

    if (pointsError) {
      // Registrar el fallo de incentivos de forma silenciosa para mantener la integridad de la visita
      console.error('[checkin] Error al sumar puntos:', pointsError.message)
    }

    // 5. Bonificacion condicional de categoria
    // Determinar la existencia de visitas previas a la misma denominacion comercial
    let bonusPoints = 0

    const { count: categoryVisits } = await lSupabase
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('id', checkin.id)  // Excluir el registro recientemente insertado
      .in(
        'business_id',
        // Obtener el universo de locales con la misma clasificacion
        (await lSupabase
          .from('businesses')
          .select('id')
          .eq('category_id', business.category_id)
          .then(r => r.data?.map(b => b.id) ?? [])
        )
      )

    if ((categoryVisits ?? 0) === 0) {
      // Otorgar puntos adicionales al validar el criterio de exploracion nueva
      bonusPoints = 30
      await lSupabase.from('point_transactions').insert({
        user_id:  userId,
        amount:   bonusPoints,
        action:   'new_category',
        ref_type: 'checkin',
        ref_id:   checkin.id,
      })
    }

    // 6. Extraer el saldo general consolidado
    const { data: profile } = await lSupabase
      .from('profiles')
      .select('point_balance')
      .eq('id', userId)
      .single()

    const totalPoints = profile?.point_balance ?? 0
    const earnedPoints = 50 + bonusPoints

    return ctx.json<ApiResponse>({
      data: {
        checkin_id:    checkin.id,
        business_id:   businessId,
        business_name: business.name,
        created_at:    checkin.created_at,
        points_earned: earnedPoints,
        bonus_reason:  bonusPoints > 0 ? 'Primera visita a esta categoria' : null,
        total_balance: totalPoints,
      },
      error: null,
    }, 201)
  }
)

/**
 * Obtener el historial cronologico de visitas efectuadas por el turista autenticado.
 *
 * Ruta asociada: Metodo Get apuntando al segmento de historial.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red derivado de la sesion del usuario.
 * Retorno: Promesa que entrega un arreglo estructurado de interacciones pasadas.
 * Efecto: Consultar los registros temporales, ejecutar una peticion colateral para 
 * recuperar el valor numerico asignado a cada evento y correlacionar ambos conjuntos 
 * de datos en la memoria transaccional de la aplicacion.
 *
 * Complejidad temporal: Orden lineal O(v) donde v representa la cantidad total de 
 * registros historicos acumulados por el usuario.
 * Complejidad espacial: Orden lineal O(v) necesario para alojar los resultados y 
 * realizar el mapeo en la memoria del servidor local.
 * Escalabilidad: Altamente escalable. La eleccion de realizar consultas en paralelo 
 * y cruzar la informacion mediante operaciones de filtrado funcional en la capa dos 
 * previene el costo computacional de cruces masivos (joins) en la capa de datos.
 */
rCheckins.get(
  '/history',
  mAuth,
  mRequireRole('tourist'),
  async (ctx) => {
    const userId = ctx.get('userId')

    // 1. Extraer los registros base sin invocar la tabla de recompensas
    const { data: checkins, error } = await lSupabase
      .from('checkins')
      .select(`
        id, created_at, business_id,
        businesses ( name, categories ( icon ) )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[checkins/history] Error en base de datos:', error.message)
      return ctx.json<ApiResponse>({ data: null, error: 'Error al obtener historial' }, 500)
    }

    if (!checkins || checkins.length === 0) {
      return ctx.json<ApiResponse>({ data: { history: [] }, error: null })
    }

    // 2. Ejecutar busqueda paralela para asociar los incentivos generados
    const checkinIds = checkins.map(c => c.id)
    
    const { data: points } = await lSupabase
      .from('point_transactions')
      .select('ref_id, amount')
      .eq('ref_type', 'checkin')
      .in('ref_id', checkinIds)

    // 3. Ensamblar la respuesta procesando las iteraciones localmente
    const history = checkins.map((item: any) => {
      // Estandarizar la recepcion del formato relacional anidado
      const category = Array.isArray(item.businesses?.categories) 
        ? item.businesses?.categories[0] 
        : item.businesses?.categories;

      // Consolidar incentivos fraccionados por evento especifico
      const earnedPoints = (points || [])
        .filter((pt: any) => pt.ref_id === item.id)
        .reduce((sum: number, pt: any) => sum + pt.amount, 0)

      return {
        id: item.id,
        business_id: item.business_id,
        business_name: item.businesses?.name || 'Negocio Desconocido',
        business_category_icon: category?.icon || '📍',
        checkin_date: item.created_at,
        points_earned: earnedPoints
      }
    })

    return ctx.json<ApiResponse>({
      data: { history },
      error: null
    })
  }
)