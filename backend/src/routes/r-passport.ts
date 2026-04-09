/**
 * Archivo: src/routes/r-passport.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se situa en la capa dos de la arquitectura, conformando la interfaz 
 * de programacion de aplicaciones y la logica de dominio. Su proposito es exponer 
 * los controladores de red para el subsistema de gamificacion, especificamente el 
 * pasaporte virtual y el coleccionable de estampas. Al delegar la logica de negocio 
 * profunda a los servicios dedicados y aislar las consultas ligeras, se mantiene un 
 * enrutador limpio, veloz y protegido estrictamente mediante interceptores de identidad 
 * y autorizacion por roles.
 */

// src/routes/r-passport.ts
// Endpoints del Pasaporte del Mundial.
// 
// GET  /api/v1/passport/album      — álbum completo del usuario
// GET  /api/v1/passport/points     — saldo de puntos actual
// POST /api/v1/passport/open-pack  — abrir sobre (gastar 200 puntos)

import { Hono } from 'hono'
import { mAuth } from '../middleware/m-auth.js'
import { mRequireRole } from '../middleware/m-rbac.js'
import { sGetAlbum, sOpenPack } from '../services/s-passport.js'
import { lSupabase } from '../lib/l-supabase.js'
import type { ApiResponse, AppContext } from '../types/t-app.js'

export const rPassport = new Hono<AppContext>()

/**
 * Obtener el estado global del coleccionable para el turista autenticado.
 *
 * Ruta asociada: Metodo Get apuntando al recurso del album.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red extrayendo la identidad en curso.
 * Retorno: Promesa que entrega un objeto Json con las colecciones estructuradas y las estampas asignadas.
 * Efecto: Delegar la construccion del progreso y el cruce de datos al servicio especializado.
 *
 * Complejidad temporal: Orden constante O(1) a nivel de controlador, transfiriendo la carga 
 * algoritmica al modulo de servicios subyacente.
 * Complejidad espacial: Orden constante O(1) localmente.
 * Escalabilidad: Altamente escalable al aplicar el patron de delegacion, asegurando que 
 * el hilo de recepcion de peticiones responda con prontitud ante concurrencia.
 */
// GET /passport/album
// Devuelve las 4 colecciones con todas las estampas y su estado.
// Estampas exclusivas incluyen requires_physical_checkin = true
// y exclusive_city con el nombre de la ciudad requerida.

rPassport.get('/album', mAuth, mRequireRole('tourist'), async (ctx) => {
  const userId = ctx.get('userId')

  try {
    const album = await sGetAlbum(userId)
    return ctx.json<ApiResponse>({ data: { album }, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al obtener el álbum'
    return ctx.json<ApiResponse>({ data: null, error: message }, 500)
  }
})

/**
 * Consultar el balance disponible de puntos de interaccion del usuario.
 *
 * Ruta asociada: Metodo Get apuntando al recurso de saldo.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red provisto con la identificacion extraida del interceptor.
 * Retorno: Promesa resolviendo en la cantidad numerica actual disponible.
 * Efecto: Ejecutar una lectura directa e individual sobre el registro del perfil.
 *
 * Complejidad temporal: Orden constante O(1). Acceso analitico veloz apoyado en llaves primarias.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Optima. Consumo minimo de recursos para una peticion de alta frecuencia 
 * utilizada constantemente para actualizar la vista de usuario.
 */
// GET /passport/points
// Saldo de puntos actual. Lee de profiles.point_balance — O(1).

rPassport.get('/points', mAuth, async (ctx) => {
  const userId = ctx.get('userId')

  const { data, error } = await lSupabase
    .from('profiles')
    .select('point_balance')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return ctx.json<ApiResponse>({ data: null, error: 'No se pudo obtener el saldo' }, 500)
  }

  return ctx.json<ApiResponse>({ data: { point_balance: data.point_balance }, error: null })
})

/**
 * Procesar la transaccion de intercambio de puntos por un paquete de recompensas.
 *
 * Ruta asociada: Metodo Post apuntando a la operacion de apertura de sobres.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red autenticado requiriendo privilegios de turista.
 * Retorno: Promesa entregando los resultados transaccionales, incluyendo elementos obtenidos y reembolsos logrados.
 * Efecto: Realizar una verificacion preliminar del balance para prevenir peticiones erroneas masivas, 
 * y en caso favorable, canalizar la ejecucion atomica hacia la capa de servicios.
 *
 * Complejidad temporal: Orden constante O(1). La comprobacion inicial es inmediata mediante busqueda directa.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Excepcionalmente robusta. Introducir una compuerta de validacion preliminar (guard clause) 
 * para confirmar la solvencia de puntos antes de despachar instrucciones transaccionales pesadas evita 
 * el encolamiento de operaciones que irremediablemente fallarian en la base de datos, incrementando la 
 * estabilidad de la red bajo volumenes excesivos de transacciones.
 */
// POST /passport/open-pack
// Abre un sobre: gasta 200 puntos y devuelve 5 estampas.
// El algoritmo de probabilidad garantizada asegura que ninguna
// estampa quede permanentemente inalcanzable.
//
// Errores posibles:
//   400 INSUFFICIENT_POINTS — saldo menor a 200 (la BD lo rechaza con CHECK)
//   400 NOT_ENOUGH_STAMPS   — catálogo insuficiente (improbable en producción)

rPassport.post('/open-pack', mAuth, mRequireRole('tourist'), async (ctx) => {
  const userId = ctx.get('userId')

  // Verificación rápida del saldo antes de intentar la transacción
  // (evita el viaje a la BD si el saldo es claramente insuficiente)
  const { data: profile } = await lSupabase
    .from('profiles')
    .select('point_balance')
    .eq('id', userId)
    .single()

  if (!profile || profile.point_balance < 200) {
    return ctx.json<ApiResponse>(
      { data: null, error: 'Saldo insuficiente. Necesitas 200 puntos para abrir un sobre.' },
      400
    )
  }

  try {
    const result = await sOpenPack(userId)

    return ctx.json<ApiResponse>({
      data: {
        pack_opening_id:    result.pack_opening_id,
        stamps_obtained:    result.stamps_obtained,
        points_spent:       result.points_spent,
        bonus_points_total: result.bonus_points_total,
        new_balance:        result.new_balance,
      },
      error: null,
    }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al abrir el sobre'

    if (message === 'INSUFFICIENT_POINTS') {
      return ctx.json<ApiResponse>(
        { data: null, error: 'Saldo insuficiente para abrir el sobre.' },
        400
      )
    }

    return ctx.json<ApiResponse>({ data: null, error: message }, 500)
  }
})