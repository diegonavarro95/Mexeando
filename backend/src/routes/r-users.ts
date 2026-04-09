/**
 * Archivo: src/routes/r-users.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se ubica en la capa dos de la arquitectura, referida a la logica y Api del sistema.
 * Funciona como un orquestador de datos y metricas (BFF - Backend For Frontend) enfocado 
 * especificamente en la experiencia del turista. Su responsabilidad arquitectonica es agregar 
 * e interpretar el progreso del usuario dentro de la plataforma. Al extraer recuentos de 
 * multiples tablas y procesar localmente la logica de niveles (gamificacion), este modulo 
 * entrega una radiografia instantanea del desempeno del usuario en una unica peticion de red, 
 * optimizando el rendimiento de la aplicacion cliente.
 */

// src/routes/users.ts
import { Hono } from 'hono'
import { mAuth } from '../middleware/m-auth.js'
import { lSupabase } from '../lib/l-supabase.js'
import type { ApiResponse, AppContext } from '../types/t-app.js'

export const rUsers = new Hono<AppContext>()

/**
 * Consolidar y calcular las estadisticas y el nivel de gamificacion del turista activo.
 *
 * Ruta asociada: Metodo Get apuntando al recurso de estadisticas personales.
 * Tipo: Controlador de ruta asincrono.
 * Parametros: Contexto de red autenticado extrayendo el identificador unico.
 * Retorno: Promesa que resuelve en un objeto Json detallando los recuentos totales, 
 * el saldo disponible y el progreso hacia el siguiente nivel.
 * Efecto: Ejecutar tres consultas independientes pero eficientes a la capa de datos para 
 * obtener las sumatorias, y evaluar de manera condicional el rango del usuario (Novato, 
 * Frecuente, Explorador, Master) en la memoria del servidor local.
 *
 * Complejidad temporal: Orden constante O(1). El conteo de filas en el motor de base de 
 * datos esta optimizado por indices. La determinacion del nivel es una evaluacion 
 * condicional lineal e instantanea en Node.js.
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente funcional en fases tempranas y medias del proyecto. Al realizar 
 * operaciones de conteo exacto (`count: 'exact'`), el motor de PostgreSQL debe escanear el 
 * indice. Si un usuario llegara a tener decenas de miles de interacciones, este enfoque podria 
 * agregar latencia. Para escalar a millones de usuarios o transacciones masivas, seria 
 * recomendable migrar estos conteos en tiempo real hacia una Vista Materializada 
 * (Materialized View) o campos de sumatoria (counters) en la tabla `profiles`, actualizados 
 * mediante activadores (triggers).
 */
// GET /api/v1/users/me/stats
// Devuelve las estadísticas completas del turista para su Perfil
rUsers.get('/me/stats', mAuth, async (ctx) => {
  const userId = ctx.get('userId');

  try {
    // 1. Contar Check-ins reales en la BD
    const { count: checkIns } = await lSupabase
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 2. Contar Reseñas publicadas
    const { count: reviews } = await lSupabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 3. Obtener el saldo de puntos desde el perfil
    const { data: profile } = await lSupabase
      .from('profiles')
      .select('point_balance')
      .eq('id', userId)
      .single();

    const points = profile?.point_balance || 0;

    // 4. Lógica de Niveles (Ola México 2026)
    let level = 1;
    let levelName = 'Turista Novato';
    let currentLevelPoints = 0;
    let nextLevelPoints = 500;

    if (points >= 500 && points < 1500) {
      level = 2;
      levelName = 'Viajero Frecuente';
      currentLevelPoints = 500;
      nextLevelPoints = 1500;
    } else if (points >= 1500 && points < 3000) {
      level = 3;
      levelName = 'Explorador Ola';
      currentLevelPoints = 1500;
      nextLevelPoints = 3000;
    } else if (points >= 3000) {
      level = 4;
      levelName = 'Máster Garnachero';
      currentLevelPoints = 3000;
      nextLevelPoints = 6000;
    }

    const stats = {
      checkIns: checkIns || 0,
      reviews: reviews || 0,
      stampsObtained: 0, // Listo para cuando conectes el pasaporte
      level,
      levelName,
      currentLevelPoints,
      nextLevelPoints,
    };

    return ctx.json<ApiResponse>({ data: { stats }, error: null });

  } catch (error: any) {
    console.error("Error obteniendo stats del usuario:", error);
    return ctx.json<ApiResponse>({ data: null, error: 'Error interno del servidor' }, 500);
  }
});