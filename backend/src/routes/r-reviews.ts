/**
 * Archivo: src/routes/r-reviews.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura, conformando la interfaz de programacion 
 * de aplicaciones y la logica de negocio. Su proposito es exponer y gestionar los puntos de acceso 
 * correspondientes a la generacion de retroalimentacion (resenas) y las interacciones sociales (aprobaciones).
 * En la arquitectura, este modulo no solo maneja la persistencia de comentarios en la capa tres, sino que 
 * tambien orquesta el sistema de gamificacion subyacente, calculando y emitiendo los puntos de lealtad 
 * correspondientes a estas acciones sin sobrecargar la responsabilidad del cliente.
 */

// src/routes/r-reviews.ts
// Endpoints de reseñas y likes.
//
// POST /api/v1/businesses/:id/reviews  — crear reseña (tourist con check-in previo)
// POST /api/v1/reviews/:id/like        — dar/quitar like a una reseña

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { mAuth } from '../middleware/m-auth.js'
import { mRequireRole } from '../middleware/m-rbac.js'
import { lSupabase } from '../lib/l-supabase.js'
import type { ApiResponse, AppContext } from '../types/t-app.js'

export const rReviews = new Hono<AppContext>()

/**
 * Esquema de validacion estructural para la composicion de resenas.
 *
 * Efecto: Validar que el cuerpo de texto, la calificacion numerica y las referencias a imagenes 
 * fisicas cumplan con las reglas de formato, mitigando ataques de inyeccion y asegurando 
 * la homogeneidad de los datos que seran evaluados posteriormente por el motor de inteligencia.
 */
const rCreateReviewSchema = z.object({
  rating:     z.number().int().min(1).max(5),
  body:       z.string().min(1).max(800).trim().optional(),
  // image_path: la foto ya fue subida a Supabase Storage por el frontend
  // El frontend sube la imagen y pasa solo el path del archivo
  image_path: z.string().max(500).optional(),
  language:   z.enum(['es','en','fr','pt','de','zh']).default('es'),
})

/**
 * Registrar una calificacion y comentario publico sobre una entidad comercial especifica.
 *
 * Ruta asociada: Metodo Post en el recurso de resenas del negocio.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Identificador del comercio, datos de la sesion del turista y esquema de la resena.
 * Retorno: Promesa que resuelve en los metadatos de la publicacion generada y el balance actualizado.
 * Efecto: Confirmar la existencia y estado activo del local comercial. Auditar el historial de 
 * transacciones del turista para exigir la preexistencia de una visita confirmada. Insertar el 
 * comentario, contabilizar la recompensa de lealtad y retornar la confirmacion.
 *
 * Complejidad temporal: Orden constante O(1). Las consultas transaccionales de verificacion de 
 * historial se apoyan en indices de agrupacion que el motor relacional procesa velozmente.
 * Complejidad espacial: Orden constante O(1). La estructura de memoria requerida es fija y minima.
 * Escalabilidad: Altamente escalable y segura. Restringir la creacion de resenas a usuarios con 
 * visitas validadas previene efectivamente los ataques de denigracion masiva (review bombing) 
 * orquestados por bots, preservando la legitimidad del ecosistema sin requerir moderacion manual.
 */
// POST /businesses/:id/reviews
// Solo turistas que hayan hecho check-in en el negocio pueden reseñar.
// La tabla reviews tiene UNIQUE (user_id, business_id), una reseña por par.

rReviews.post(
  '/businesses/:id/reviews',
  mAuth,
  mRequireRole('tourist'),
  zValidator('json', rCreateReviewSchema),
  async (ctx) => {
    const { id: businessId } = ctx.req.param()
    const body   = ctx.req.valid('json')
    const userId = ctx.get('userId')

    // 1. Verificar que el negocio existe y está activo
    const { data: biz, error: bizErr } = await lSupabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single()

    if (bizErr || !biz) {
      return ctx.json<ApiResponse>(
        { data: null, error: 'Negocio no encontrado o no disponible' },
        404
      )
    }

    // 2. Verificar check-in previo — requisito estricto para poder reseñar
    const { count: checkinCount, error: checkinErr } = await lSupabase
      .from('checkins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('business_id', businessId)

    if (checkinErr) {
      return ctx.json<ApiResponse>(
        { data: null, error: 'Ocurrió un error al verificar tu visita al negocio.' },
        500
      )
    }

    if ((checkinCount ?? 0) === 0) {
      return ctx.json<ApiResponse>(
        { data: null, error: 'Debes visitar el negocio (escanear su QR) antes de dejar una reseña.' },
        403
      )
    }

    // 3. Crear la reseña asegurando unicidad logica en el motor de base de datos
    // La constraint UNIQUE (user_id, business_id) previene reseñas duplicadas
    const { data: review, error } = await lSupabase
      .from('reviews')
      .insert({
        business_id: businessId,
        user_id:     userId,
        rating:      body.rating,
        body:        body.body ?? null,
        image_path:  body.image_path ?? null,
        language:    body.language,
      })
      .select('id, rating, body, image_path, language, created_at')
      .single()

    if (error) {
      // Interpretar el codigo de error de indice duplicado
      if (error.code === '23505') {
        return ctx.json<ApiResponse>(
          { data: null, error: 'Ya dejaste una reseña para este negocio.' },
          409
        )
      }
      return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
    }

    // 4. Inyectar incentivo por la aportacion a la plataforma
    // La logica interna de la base de datos se encarga de reestructurar el balance principal
    await lSupabase.from('point_transactions').insert({
      user_id:  userId,
      amount:   80,
      action:   'review_created',
      ref_type: 'review',
      ref_id:   review.id,
    })

    // 5. Leer la sumatoria del balance actualizado
    const { data: profile } = await lSupabase
      .from('profiles')
      .select('point_balance')
      .eq('id', userId)
      .single()

    return ctx.json<ApiResponse>({
      data: {
        ...review,
        business_name:   biz.name,
        points_earned:   80,
        total_balance:   profile?.point_balance ?? 0,
      },
      error: null,
    }, 201)
  }
)

/**
 * Alternar el registro de aprobacion sobre un comentario e intercambiar incentivos.
 *
 * Ruta asociada: Metodo Post en el recurso especifico de iteracion de resenas.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Identificador del comentario y contexto autenticado.
 * Retorno: Promesa confirmando el nuevo estado booleano de la interaccion.
 * Efecto: Auditar la existencia previa de la interaccion. Eliminar la marca de aprobacion y 
 * aplicar una deduccion de puntos al autor original, o registrar la aprobacion y conceder la 
 * recompensa. En ambos casos se evade transaccionar puntos si la autoaprobacion esta intentandose.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Funcional pero dependiente del diseno relacional. La necesidad de transaccionar 
 * puntos al autor exige consultas secundarias, lo que agrega un ligero costo de red. Es escalable, 
 * pero en flujos de concurrencia extremadamente alta se recomendaria desplazar la asignacion 
 * de puntos hacia un activador asincrono (trigger) dentro del motor de PostgreSQL de la capa tres.
 */
// POST /reviews/:id/like
// Toggle de like: si ya existe lo quita, si no existe lo agrega.
// Cuando se agrega: +10 puntos al AUTOR de la reseña. Al quitar, se restan esos 10.

rReviews.post(
  '/reviews/:id/like',
  mAuth,
  mRequireRole('tourist'),
  async (ctx) => {
    const { id: reviewId } = ctx.req.param()
    const userId = ctx.get('userId')

    // 1. Validar integridad referencial del elemento destino
    const { data: review, error: revErr } = await lSupabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .is('deleted_at', null)
      .single()

    if (revErr || !review) {
      return ctx.json<ApiResponse>({ data: null, error: 'Reseña no encontrada' }, 404)
    }

    // 2. Sondear el estado binario de la accion (existencia)
    const { data: existingLike } = await lSupabase
      .from('review_likes')
      .select('user_id, review_id')
      .eq('user_id', userId)
      .eq('review_id', reviewId)
      .single()

    if (existingLike) {
      // Estado presente: retirar la aprobacion (toggle)
      await lSupabase
        .from('review_likes')
        .delete()
        .eq('user_id', userId)
        .eq('review_id', reviewId)

      // Ejecutar devolucion de puntos al autor original
      if (review.user_id !== userId) {
        await lSupabase.from('point_transactions').insert({
          user_id:  review.user_id,
          amount:   -10, // Insercion de cifra negativa para deduccion
          action:   'like_removed', 
          ref_type: 'review',
          ref_id:   reviewId,
        })
        
      }

      return ctx.json<ApiResponse>({
        data: { liked: false, review_id: reviewId },
        error: null,
      })
    }

    // 3. Estado ausente: registrar la nueva interaccion
    const { error: likeErr } = await lSupabase
      .from('review_likes')
      .insert({ user_id: userId, review_id: reviewId })

    if (likeErr) {
      return ctx.json<ApiResponse>({ data: null, error: likeErr.message }, 500)
    }

    // 4. Compensar al autor del contenido por la participacion de la comunidad
    // Condicion: Ignorar la transaccion monetaria si se detecta autoaprobacion
    if (review.user_id !== userId) {
      await lSupabase.from('point_transactions').insert({
        user_id:  review.user_id,
        amount:   10,
        action:   'like_received',
        ref_type: 'review',
        ref_id:   reviewId,
      })
    }

    return ctx.json<ApiResponse>({
      data: { liked: true, review_id: reviewId },
      error: null,
    })
  }
)