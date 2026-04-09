/**
 * Archivo: src/routes/r-favorites.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura, conformando la logica y Api del sistema.
 * Su responsabilidad arquitectonica es gestionar la relacion de guardado entre los perfiles de los turistas 
 * y los comercios, permitiendo crear listas personalizadas de favoritos.
 * Al aislar esta funcionalidad en un modulo dedicado, se garantiza que las operaciones de lectura 
 * y escritura sobre la tabla asociativa en la capa tres de almacenamiento se resuelvan con alta cohesion 
 * y bajo acoplamiento, utilizando interceptores de seguridad para proteger la identidad del usuario y 
 * delegando el esfuerzo de integridad referencial al motor relacional.
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { mAuth } from '../middleware/m-auth.js'
import { lSupabase } from '../lib/l-supabase.js'
import type { ApiResponse, AppContext } from '../types/t-app.js'

export const rFavorites = new Hono<AppContext>()

/**
 * Guardar un comercio en la lista de favoritos del perfil autenticado.
 *
 * Ruta asociada: Metodo Post en la raiz del recurso de favoritos.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red transportando un cuerpo estructurado con el identificador del comercio.
 * Retorno: Promesa resolviendo en un objeto Json que confirma el exito de la transaccion.
 * Efecto: Insertar una nueva tupla en la tabla asociativa de favoritos. Si el motor relacional detecta 
 * una violacion de unicidad, el controlador captura el evento silenciosamente y retorna un estado de exito, 
 * garantizando la idempotencia de la operacion para el cliente.
 *
 * Complejidad temporal: Orden constante O(1). La insercion y validacion de indices unicos se procesan de manera inmediata por el gestor de datos.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable, disenada como una operacion idempotente que previene excepciones innecesarias ante reintentos de red.
 */
rFavorites.post('/', mAuth, zValidator('json', z.object({ business_id: z.string() })), async (ctx) => {
  const { business_id } = ctx.req.valid('json')
  const userId = ctx.get('userId')
  
  const { error } = await lSupabase.from('favorites').insert({ user_id: userId, business_id })
  
  if (error && error.code !== '23505') { 
    return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
  }
  return ctx.json<ApiResponse>({ data: { success: true }, error: null })
})

/**
 * Remover un comercio de la coleccion personal de favoritos.
 *
 * Ruta asociada: Metodo Delete apuntando a un identificador especifico.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de red incluyendo el identificador del negocio en el parametro de la ruta.
 * Retorno: Promesa devolviendo un indicador de exito en formato Json.
 * Efecto: Ejecutar una operacion de borrado condicional en la base de datos, asegurando 
 * la coincidencia estricta entre el identificador del comercio y el identificador del turista autenticado.
 *
 * Complejidad temporal: Orden constante O(1). La busqueda y eliminacion se optimizan mediante indices de claves foraneas.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Optima, protegiendo la integridad referencial sin impactar el rendimiento global del sistema de transacciones.
 */
rFavorites.delete('/:id', mAuth, async (ctx) => {
  const business_id = ctx.req.param('id')
  const userId = ctx.get('userId')

  const { error } = await lSupabase.from('favorites').delete().match({ user_id: userId, business_id })
  if (error) return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
  return ctx.json<ApiResponse>({ data: { success: true }, error: null })
})

/**
 * Obtener la lista completa de comercios guardados por el turista.
 *
 * Ruta asociada: Metodo Get en la raiz del recurso de favoritos.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de la solicitud autenticada.
 * Retorno: Promesa que entrega un arreglo detallado de los comercios favoritos.
 * Efecto: Ensamblar una consulta relacional para extraer los registros vinculados, anidar los metadatos 
 * correspondientes a categorias e imagenes, y realizar una normalizacion de coordenadas espaciales 
 * en la memoria del servidor local antes de emitir la respuesta final.
 *
 * Complejidad temporal: Orden lineal O(f) donde f representa la cantidad de favoritos vinculados al perfil. 
 * El cruce de datos primario se delega a las uniones de la capa tres.
 * Complejidad espacial: Orden lineal O(f) requerido para mapear y filtrar el arreglo de resultados.
 * Escalabilidad: Adecuada para el comportamiento esperado. Dado que el numero de favoritos por usuario 
 * esta habitualmente acotado por limites naturales de interaccion, la carga de memoria al mapear los 
 * resultados se mantiene controlada. Para una escalabilidad masiva extrema, este controlador podria 
 * ser adaptado para requerir paginacion progresiva en fases futuras.
 */
rFavorites.get('/', mAuth, async (ctx) => {
  const userId = ctx.get('userId')

  const { data, error } = await lSupabase
    .from('favorites')
    .select(`
      business_id, created_at,
      businesses (
        id, name, slug, address, city, avg_rating, review_count, 
        location, checkin_count, accepts_card, ola_verified,
        categories ( slug, icon ),
        business_images ( storage_path, is_primary, sort_order )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Error al consultar lista de favoritos:", error.message);
    return ctx.json<ApiResponse>({ data: null, error: error.message }, 500)
  }

  const favorites = data.map((fav: any) => {
    const biz = fav.businesses;
    if (!biz) return null;

    let lat = undefined;
    let lng = undefined;
    if (typeof biz.location === 'string') {
      const match = biz.location.match(/POINT\s*\(\s*([-\d.]+)\s+([-.\d.]+)\s*\)/i);
      if (match) { 
        lng = parseFloat(match[1]); 
        lat = parseFloat(match[2]); 
      }
    } else if (biz.location && typeof biz.location === 'object' && biz.location.coordinates) {
      lng = biz.location.coordinates[0];
      lat = biz.location.coordinates[1];
    }

    const category = Array.isArray(biz.categories) ? biz.categories[0] : biz.categories;
    const images = (biz.business_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order);

    return {
      id: biz.id,
      name: biz.name,
      category_slug: category?.slug || '',
      category_icon: category?.icon || '📍',
      address: biz.address,
      city: biz.city,
      avg_rating: biz.avg_rating,
      review_count: biz.review_count,
      is_open_now: null,
      distance_m: 0,
      primary_image: images.length > 0 ? images[0].storage_path : null,
      lat,
      lng,
      ola_verified: biz.ola_verified
    }
  }).filter(Boolean);

  return ctx.json<ApiResponse>({ data: { favorites }, error: null })
})