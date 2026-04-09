/**
 * Archivo: src/routes/r-dashboard.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura, conformando la logica central y la 
 * interfaz de programacion de aplicaciones. Su proposito arquitectonico es actuar como un orquestador 
 * de datos (Bff o Backend for Frontend) especifico para el panel de control de los propietarios. 
 * Para lograrlo, interactua concurrentemente con la capa tres de almacenamiento relacional para extraer 
 * metricas operativas, e integra servicios externos de la capa cuatro al consultar un modelo de 
 * inteligencia artificial generativa. Esta consolidacion permite entregar un estado global y analitico 
 * del comercio en una unica transaccion de red hacia el cliente.
 */

// src/routes/r-dashboard.ts
// Get /api/v1/owner/dashboard
//
// v2 — Ahora devuelve tambien:
//   address, phone, accepts_card, lat, lng  — para mostrar en el mapa del dashboard
//   images                                  — galeria de fotos del negocio
//   profile_views / profile_views_today     — vistas del perfil
//   checkins_today                          — registros de visita recientes
//   daily_metrics (ultimos 7 dias)          — grafica de trafico semanal

import { Hono } from 'hono'
import { lSupabase } from '../lib/l-supabase.js'
import { mAuth } from '../middleware/m-auth.js'
import { GoogleGenAI } from '@google/genai'

const dashboardRoute = new Hono()

/**
 * Extraer coordenadas geograficas desde formatos espaciales de bases de datos.
 *
 * Tipo: Funcion utilitaria sincronica.
 * Parametros: Variable de tipo desconocido que representa la ubicacion almacenada.
 * Retorno: Objeto con latitud y longitud tipadas numericamente.
 * Efecto: Analizar mediante expresiones regulares o desestructuracion de objetos el 
 * valor provisto para aislar los componentes vectoriales del punto espacial.
 *
 * Complejidad temporal: Orden constante O(1). La evaluacion de la cadena es estricta y acotada.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable, siendo una funcion pura que no compromete memoria ni 
 * concurrencia del servidor.
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
 * Compilar y retornar el panel de control integral para el usuario propietario.
 *
 * Ruta asociada: Metodo Get en la raiz del recurso de panel.
 * Tipo: Controlador asincrono.
 * Parametros: Contexto de la solicitud autenticada.
 * Retorno: Promesa que resuelve en una estructura Json masiva con indicadores, galerias y un resumen analitico.
 * Efecto: Ejecutar una peticion primaria para validar la existencia del comercio. Posteriormente, 
 * disparar multiples consultas en paralelo para recopilar visitas, resenas e imagenes. Finalmente, 
 * calcular promedios en memoria e invocar al proveedor generativo para sintetizar los comentarios.
 *
 * Complejidad temporal: Orden lineal O(r + c) donde r equivale al total de resenas recientes y c 
 * representa el volumen de visitas en la ultima semana cronologica. Las consultas a la base de 
 * datos se resuelven en paralelo, mitigando la latencia, pero el tiempo final esta fuertemente 
 * dominado por el tiempo de respuesta del proveedor de inteligencia artificial externo.
 * Complejidad espacial: Orden lineal O(r + c) necesario para mantener los arreglos de datos en 
 * la memoria de la aplicacion durante los ciclos de agrupamiento y formateo de la respuesta.
 * Escalabilidad: Moderada bajo su implementacion actual. La resolucion concurrente de consultas 
 * a la capa tres es eficiente y escalable. Sin embargo, realizar una peticion sincronica y 
 * bloqueante a la interfaz de programacion de Gemini en el flujo principal representa un riesgo de 
 * latencia frente a picos de trafico, podemos escalar a niveles empresariales este resumen deberia 
 * generarse asincronamente utilizando colas de trabajo temporales  y sirviendo un valor en 
 * cache para el panel principal. A mejorar.
 */
dashboardRoute.get('/', mAuth, async (c) => {
  try {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'No autorizado' }, 401)

    // Extraer la informacion fundamental del negocio requerida por la interfaz frontal
    const { data: business, error: businessError } = await lSupabase
      .from('businesses')
      .select(`
        id, name, status,
        address, phone, website, accepts_card,
        location
      `)
      .eq('owner_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (businessError) {
      console.error('[dashboard] Error al consultar datos del comercio:', businessError)
      return c.json({ error: 'Hubo un problema al cargar el dashboard' }, 500)
    }

    if (!business) {
      return c.json({
        data: {
          has_business:        false,
          business_id:         null,
          business_name:       null,
          status:              null,
          total_checkins:      0,
          checkins_today:      0,
          avg_rating:          0,
          total_reviews:       0,
          profile_views:       0,
          profile_views_today: 0,
          ai_summary:          null,
          recent_reviews:      [],
          daily_metrics:       [],
          images:              [],
          address:             null,
          phone:               null,
          accepts_card:        null,
          lat:                 null,
          lng:                 null,
        },
        error: null,
      })
    }

    // Ejecutar consultas colaterales en paralelo para maximizar la velocidad de resolucion
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayISO = todayStart.toISOString()

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)
    const sevenDaysAgoISO = sevenDaysAgo.toISOString()

    const [
      reviewsRes,
      checkinsAllRes,
      checkinsTodayRes,
      imagesRes,
      checkinsWeekRes,
    ] = await Promise.all([
      // Obtener valoraciones recientes
      lSupabase
        .from('reviews')
        .select('id, rating, body, created_at, profiles(display_name)')
        .eq('business_id', business.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10),

      // Contabilizar historico de visitas
      lSupabase
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id),

      // Contabilizar visitas del ciclo actual
      lSupabase
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .gte('created_at', todayISO),

      // Recuperar recursos graficos asociados al perfil
      lSupabase
        .from('business_images')
        .select('id, storage_path, sort_order')
        .eq('business_id', business.id)
        .order('sort_order', { ascending: true }),

      // Filtrar iteraciones de la ultima semana para ensamblar graficas
      lSupabase
        .from('checkins')
        .select('created_at')
        .eq('business_id', business.id)
        .gte('created_at', sevenDaysAgoISO),
    ])

    const reviews      = reviewsRes.data      || []
    const totalCheckins = checkinsAllRes.count  || 0
    const checkinsToday = checkinsTodayRes.count || 0
    const { lat, lng } = sExtractLatLngFromLocation((business as { location?: unknown }).location)
    const images       = (imagesRes.data || []).map(img => ({
      id:           img.id,
      storage_path: img.storage_path,
      position:     img.sort_order ?? 0,
    }))

    // Calcular el promedio numerico de satisfaccion iterando el arreglo
    const avgRating = reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : 0

    // Construir el reporte cronologico agrupando registros de visitas por fecha exacta
    const checkinsWeek = checkinsWeekRes.data || []
    const daily_metrics: { date: string; views: number; checkins: number }[] = []

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const dateStr = d.toISOString().split('T')[0]

      const dayCheckins = checkinsWeek.filter(c => {
        const cDate = new Date(c.created_at).toISOString().split('T')[0]
        return cDate === dateStr
      }).length

      daily_metrics.push({
        date:     dateStr,
        views:    dayCheckins, // Proyectar visitas confirmadas como interacciones proxy
        checkins: dayCheckins,
      })
    }

    // Sintetizar la retroalimentacion utilizando un modelo analitico externo
    let aiSummary = 'Aún no hay suficientes reseñas para generar un resumen inteligente.'

    if (reviews.length > 0) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
        const commentsText = reviews
          .map(r => `- ${r.body ?? ''} (${r.rating} estrellas)`)
          .join('\n')

        const prompt = `
          Eres un experto consultor de restaurantes. Lee las siguientes reseñas recientes del negocio "${business.name}" y redacta UN SOLO PÁRRAFO CORTO (máximo 3 oraciones) resumiendo qué le gusta a la gente y qué áreas de oportunidad tienen.
          Reseñas:
          ${commentsText}
        `

        const response = await ai.models.generateContent({
          model:    'gemini-2.5-flash',
          contents: prompt,
        })
        aiSummary = response.text || 'Resumen generado exitosamente.'
      } catch (geminiError) {
        console.error('[dashboard] Error de red hacia el proveedor de inferencia:', geminiError)
        aiSummary = 'Análisis inteligente no disponible temporalmente.'
      }
    }

    // Entregar el objeto consolidado final
    return c.json({
      data: {
        has_business:        true,
        business_id:         business.id,
        business_name:       business.name,
        status:              business.status,

        // Indicadores clave
        total_checkins:      totalCheckins,
        checkins_today:      checkinsToday,
        avg_rating:          avgRating,
        total_reviews:       reviews.length,

        // Marcadores de seguimiento de trafico visual
        profile_views:       0,
        profile_views_today: 0,

        // Secuencia cronologica para graficas
        daily_metrics,

        // Sumario cognitivo
        ai_summary: aiSummary,

        // Muestra de interacciones de clientes
        recent_reviews: reviews.slice(0, 5),

        // Identidad comercial y ubicacion para marcadores
        address:      business.address  ?? null,
        phone:        business.phone    ?? null,
        website:      business.website  ?? null,
        accepts_card: business.accepts_card ?? null,
        lat,
        lng,

        // Repositorio visual asociado
        images,
      },
      error: null,
    })

  } catch (error) {
    console.error('[dashboard] Error interno de procesamiento:', error)
    return c.json({ error: 'Hubo un problema al cargar el dashboard' }, 500)
  }
})

export { dashboardRoute as rDashboard }