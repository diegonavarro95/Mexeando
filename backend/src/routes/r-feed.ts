/**
 * Archivo: src/routes/r-feed.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se ubica en la capa dos de la arquitectura, referida a la logica y Api del sistema.
 * Funciona como el orquestador principal del flujo de interacciones sociales, gestionando la entrega 
 * de resenas y el registro de reacciones por parte de los usuarios. Su proposito arquitectonico es 
 * abstraer la complejidad de la paginacion y el ensamblaje relacional, conectando de manera segura 
 * la interfaz del cliente (capa uno) con el almacenamiento en Supabase (capa tres). Al implementar 
 * cursores y resolver uniones de datos en el servidor, garantiza un desempeno optimo y reduce la 
 * cantidad de peticiones requeridas desde el dispositivo final.
 */

// src/routes/r-feed.ts
// Metodo Get  /api/v1/feed               — flujo de resenas con filtros y paginacion por cursor
// Metodo Post /api/v1/reviews/:id/like   — alternar estado de aprobacion

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { lSupabase } from '../lib/l-supabase.js'
import { mAuth } from '../middleware/m-auth.js'
import type { AppContext } from '../types/t-app.js'

export const rFeed = new Hono<AppContext>()

/**
 * Obtener un flujo continuo de resenas publicas aplicando filtros y paginacion.
 *
 * Ruta asociada: Metodo Get en la raiz del recurso de flujo.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto con variables de consulta para tipo de filtro, marcador de cursor y limite.
 * Retorno: Promesa que resuelve en un objeto Json conteniendo el arreglo de resenas enriquecidas 
 * y las referencias para continuar la paginacion.
 * Efecto: Interpretar el parametro de paginacion, estructurar una consulta relacional profunda, 
 * recuperar la informacion, ordenar los resultados si es necesario y ensamblar el estado de 
 * interaccion del usuario autenticado frente a cada publicacion.
 *
 * Complejidad temporal: Orden lineal O(n) donde n es el limite de registros solicitados. La 
 * construccion de la respuesta itera sobre los resultados de manera predecible. Excepcion: El 
 * filtro popular requiere ordenar localmente un subconjunto ampliado, resultando en O(n log n).
 * Complejidad espacial: Orden lineal O(n) requerido para alojar los registros temporales y el 
 * objeto formateado en la memoria del servidor.
 * Escalabilidad: Moderada a alta. El mecanismo de cursor para el filtro reciente es altamente 
 * escalable y robusto ante inserciones concurrentes. Sin embargo, el filtro popular, al ordenar 
 * en memoria y basarse en desplazamientos (offset), representa un cuello de botella logico. Para 
 * soportar trafico masivo en el futuro, se recomendaria implementar vistas materializadas o un 
 * campo sumatorio indexado en la capa de datos.
 */
// Filtros:
//   recent  — todas las resenas, mas recientes primero
//   popular — ordenadas por numero de aprobaciones
//   friends — solo resenas de negocios donde el usuario tiene historial
//
// Correcciones implementadas:
//   1. Uso de la tabla perfiles
//   2. Mapeo correcto a imagenes del negocio
//   3. Paginacion basada en marcadores (cursor)
//   4. Ampliacion del alcance del filtro reciente
//   5. Inclusion del indicador de interaccion previa
rFeed.get(
  '/',
  mAuth,
  zValidator('query', z.object({
    filter: z.enum(['recent', 'popular', 'videos']).default('recent'),
    cursor: z.string().optional(),   // Marca de tiempo del ultimo elemento
    limit:  z.coerce.number().int().min(1).max(20).default(20),
  })),
  async (c) => {
    const userId            = c.get('userId') as string | null
    const { filter, cursor, limit } = c.req.valid('query')

    // Valores estaticos de prueba para el flujo de videos
    if (filter === 'videos') {
      const mockVideos = [
        {
          id: 'video-mock-1',
          rating: 5,
          body: '¡Increíbles tacos! Grabé este video mostrando cómo preparan el trompo al pastor. 🌮🔥 (Simulación de video)',
          image_path: null, 
          language: 'es',
          created_at: new Date().toISOString(),
          like_count: 125,
          liked_by_me: false,
          author: {
            id: 'mock-user-1',
            display_name: 'Garnachero Pro',
            avatar_url: null,
          },
          business: {
            id: 'mock-biz-1',
            name: 'Tacos El Paisa',
            slug: 'tacos-el-paisa',
            city: 'CDMX',
            image_url: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=400&q=80',
          }
        },
        {
          id: 'video-mock-2',
          rating: 4,
          body: 'Reseña en video de las mejores margaritas de la ciudad. 🍹 (Simulación de video)',
          image_path: null,
          language: 'es',
          created_at: new Date(Date.now() - 86400000).toISOString(), 
          like_count: 89,
          liked_by_me: true,
          author: {
            id: 'mock-user-2',
            display_name: 'Turista Sediento',
            avatar_url: null,
          },
          business: {
            id: 'mock-biz-2',
            name: 'Cantina La Cueva',
            slug: 'cantina-la-cueva',
            city: 'Guadalajara',
            image_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&q=80',
          }
        }
      ]

      return c.json({
        data: {
          reviews: mockVideos,
          nextCursor: undefined, 
          hasMore: false,
        },
        error: null,
      })
    }

    // Construir la consulta principal
    let query = lSupabase
      .from('reviews')
      .select(`
        id,
        rating,
        body,
        image_path,
        language,
        created_at,
        user_id,
        business_id,
        profiles!user_id (
          id,
          display_name,
          avatar_url
        ),
        businesses!business_id (
          id,
          name,
          slug,
          city,
          business_images ( storage_path, is_primary )
        ),
        review_likes ( user_id )
      `)
      .is('deleted_at', null)

    // Mecanismo de paginacion por marcador
    if (cursor) {
      if (filter === 'popular') {
        // Implementar paginacion por desplazamiento al carecer de un orden estable
        const offset = parseInt(cursor, 10)
        if (!isNaN(offset)) {
          query = query.range(offset, offset + limit - 1)
        }
      } else {
        // Filtrar por elementos anteriores a la marca de tiempo provista
        query = query.lt('created_at', cursor)
      }
    }

    // Ordenamiento de registros
    if (filter === 'popular') {
      // Extraer un volumen mayor para procesar el ordenamiento local
      query = query
        .order('created_at', { ascending: false })
        .limit(limit * 3)
    } else {
      query = query
        .order('created_at', { ascending: false })
        .limit(limit + 1)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('[rFeed] error de consulta:', error.message)
      return c.json({ data: null, error: error.message }, 500)
    }

    // Transformar resultados y determinar el estado de aprobacion individual
    let reviews = (rows ?? []).map((r: any) => {
      const likes: Array<{ user_id: string }> = r.review_likes ?? []
      const likeCount   = likes.length
      const likedByMe   = userId ? likes.some((l) => l.user_id === userId) : false

      // Extraer la ruta grafica representativa del comercio
      const images      = r.businesses?.business_images ?? []
      const primaryImg  = images.find((i: any) => i.is_primary)?.storage_path
                       ?? images[0]?.storage_path
                       ?? null

      return {
        id:           r.id,
        rating:       r.rating,
        body:         r.body,
        image_path:   r.image_path,
        language:     r.language,
        created_at:   r.created_at,
        like_count:   likeCount,
        liked_by_me:  likedByMe,
        author: {
          id:           r.profiles?.id           ?? null,
          display_name: r.profiles?.display_name ?? 'Anónimo',
          avatar_url:   r.profiles?.avatar_url   ?? null,
        },
        business: {
          id:        r.businesses?.id   ?? null,
          name:      r.businesses?.name ?? '—',
          slug:      r.businesses?.slug ?? '',
          city:      r.businesses?.city ?? '',
          image_url: primaryImg,
        },
      }
    })

    // Ordenamiento condicional en memoria para el filtro de popularidad
    if (filter === 'popular') {
      reviews = reviews
        .sort((a, b) => b.like_count - a.like_count)
        .slice(0, limit + 1)
    }

    // Estimar el siguiente iterador de paginacion
    const hasMore    = reviews.length > limit
    const pageItems  = reviews.slice(0, limit)

    let nextCursor: string | undefined
    if (hasMore) {
      if (filter === 'popular') {
        const currentOffset = cursor ? parseInt(cursor, 10) : 0
        nextCursor = String(currentOffset + limit)
      } else {
        nextCursor = pageItems[pageItems.length - 1]?.created_at
      }
    }

    return c.json({
      data: {
        reviews:    pageItems,
        nextCursor,
        hasMore,
      },
      error: null,
    })
  }
)

/**
 * Alternar el registro de aprobacion sobre una resena especifica.
 *
 * Ruta asociada: Metodo Post incluyendo el identificador de la resena en la ruta.
 * Tipo: Controlador asincrono.
 * Parametros: Identificador provisto y sesion autenticada del solicitante.
 * Retorno: Promesa indicando el estado final de la interaccion y el recuento total.
 * Efecto: Validar la existencia de un registro previo. Ejecutar una eliminacion si la 
 * aprobacion existia, o una insercion en caso contrario, garantizando una funcion 
 * alternante y calculando el nuevo limite.
 *
 * Complejidad temporal: Orden constante O(1). Las sentencias operan directamente 
 * sobre indices unicos y foraneos en la base de datos.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable para lecturas y escrituras aisladas. Existe un ligero 
 * riesgo de lectura sucia al contabilizar los totales simultaneamente bajo concurrencia extrema. 
 * En el futuro se sugeriria delegar este conteo general a un activador interno en 
 * el motor relacional.
 */
// Metodo Post /api/v1/reviews/:id/like
// Alternar: agregar si es ausente, remover si esta presente.
rFeed.post('/reviews/:id/like', mAuth, async (c) => {
  const userId   = c.get('userId') as string | null
  const reviewId = c.req.param('id')

  if (!userId) {
    return c.json({ data: null, error: 'No autorizado' }, 401)
  }

  // Comprobar estado previo de interaccion
  const { data: existing } = await lSupabase
    .from('review_likes')
    .select('user_id')
    .eq('user_id', userId)
    .eq('review_id', reviewId)
    .maybeSingle()

  if (existing) {
    // Retirar la interaccion
    const { error } = await lSupabase
      .from('review_likes')
      .delete()
      .eq('user_id', userId)
      .eq('review_id', reviewId)

    if (error) return c.json({ data: null, error: error.message }, 500)

    const { count } = await lSupabase
      .from('review_likes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', reviewId)

    return c.json({ data: { liked: false, like_count: count ?? 0 }, error: null })

  } else {
    // Agregar la interaccion
    const { error } = await lSupabase
      .from('review_likes')
      .insert({ user_id: userId, review_id: reviewId })

    if (error) return c.json({ data: null, error: error.message }, 500)

    const { count } = await lSupabase
      .from('review_likes')
      .select('*', { count: 'exact', head: true })
      .eq('review_id', reviewId)

    return c.json({ data: { liked: true, like_count: count ?? 0 }, error: null })
  }
})