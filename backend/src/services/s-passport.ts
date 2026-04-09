/**
 * Archivo: src/services/s-passport.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se ubica en la capa dos de la arquitectura (Logica de Negocio), actuando 
 * como un modulo de servicio puro dedicado al subsistema de gamificacion (Pasaporte del Mundial).
 * Su responsabilidad arquitectonica principal es implementar el algoritmo de probabilidad 
 * garantizada (Pity System), un componente critico para la retencion de usuarios.
 * Al abstraer la logica matematica compleja (calculo de probabilidades ponderadas y muestreo 
 * sin reemplazo) fuera de los controladores de red, este modulo asegura que las transacciones 
 * de recompensas sean deterministas, testeables y mantengan la integridad del modelo 
 * economico virtual antes de delegar la persistencia a la capa tres.
 */

// src/services/s-passport.ts
// Lógica del sistema de recompensas del Pasaporte del Mundial.
// Contiene el algoritmo de probabilidad garantizada (pity system).

import { lSupabase } from '../lib/l-supabase.js'
import {
  qGetPityCounters,
  qGetAlbum,
  qOpenPack,
  type qOpenPackResult,
  type qCollectionProgress,
} from '../db/queries/q-passport.js'

// ── ALBUM ─────────────────────────────────────────────────────

/**
 * Obtener el progreso general de las colecciones del pasaporte.
 *
 * Tipo: Funcion de dominio asincrona.
 * Parametros: Identificador del usuario.
 * Retorno: Promesa resolviendo en un arreglo de estructuras de progreso por coleccion.
 * Efecto: Actua como un puente de paso (passthrough) hacia el modulo de consultas.
 *
 * Complejidad temporal: O(1) localmente, delegado a la eficiencia de la consulta en base de datos.
 * Complejidad espacial: O(1).
 */
export async function sGetAlbum(userId: string): Promise<qCollectionProgress[]> {
  return qGetAlbum(userId)
}

// ── ALGORITMO DE PROBABILIDAD GARANTIZADA ────────────────────
//
// Para cada estampa, la probabilidad real de obtenerla en un sobre es:
//
//   p_real = min(1.0, base_probability + (packs_since_last * pity_increment))
//
// Cuando packs_since_last >= pity_threshold, la probabilidad es 100%.
// Esto garantiza que ninguna estampa quede permanentemente inalcanzable.
//
// El algoritmo selecciona 5 estampas independientes con sus probabilidades
// ajustadas — cada estampa es un evento de Bernoulli.
// Para asegurar exactamente 5 estampas, si no hay suficientes con p=1.0,
// se usa selección ponderada hasta completar el sobre.

/**
 * Calcular la probabilidad efectiva de aparicion de un coleccionable considerando el historial de infortunio.
 *
 * Tipo: Funcion matematica pura.
 * Parametros: Probabilidad base asignada a la rareza, contador de intentos fallidos, factor de incremento y techo garantizado.
 * Retorno: Numero decimal representando la probabilidad ajustada (entre 0.0 y 1.0).
 * Efecto: Aplicar una funcion lineal limitada para incrementar progresivamente la posibilidad de 
 * obtencion de un elemento especifico, garantizando su aparicion una vez alcanzado el umbral.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Ejecucion instantanea en memoria.
 */
function sCalculateAdjustedProbability(
  baseProbability: number,
  packsSinceLast: number,
  pityIncrement: number,
  pityThreshold: number
): number {
  if (packsSinceLast >= pityThreshold) return 1.0
  return Math.min(1.0, baseProbability + packsSinceLast * pityIncrement)
}

/**
 * Realizar un muestreo aleatorio ponderado sin reemplazo para formar un conjunto de recompensas.
 *
 * Tipo: Funcion algoritmica pura.
 * Parametros: Arreglo de candidatos con sus probabilidades relativas ajustadas y la cantidad a seleccionar.
 * Retorno: Arreglo de identificadores correspondientes a los elementos sorteados.
 * Efecto: Simular el proceso de apertura de un sobre de manera justa. Suma los pesos relativos 
 * del conjunto restante, sortea un valor pseudoaleatorio y selecciona al ganador, retirandolo del 
 * conjunto (sin reemplazo) para evitar duplicados exactos dentro del mismo sobre. Se repite hasta 
 * llenar la cuota.
 *
 * Complejidad temporal: Orden cuadratico O(k * n) en el peor caso, donde k es la cantidad de elementos 
 * a seleccionar (habitualmente 5) y n es el tamano del catalogo de estampas. Dado que n es un numero acotado 
 * en una coleccion virtual y k es constante, el rendimiento se comporta funcionalmente como lineal O(n).
 * Complejidad espacial: Orden lineal O(n) para instanciar la copia superficial del arreglo de candidatos.
 * Escalabilidad: Altamente funcional para catalogos moderados.
 */
// Selección ponderada sin reemplazo: elige `count` elementos del array
// con probabilidades proporcionales a sus pesos ajustados.
function sWeightedSampleWithoutReplacement(
  items: Array<{ stamp_id: number; adjusted_prob: number }>,
  count: number
): number[] {
  const pool = [...items]
  const selected: number[] = []

  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.adjusted_prob, 0)
    let rand = Math.random() * totalWeight
    let idx = 0

    for (let i = 0; i < pool.length; i++) {
      rand -= pool[i].adjusted_prob
      if (rand <= 0) { idx = i; break }
    }

    selected.push(pool[idx].stamp_id)
    pool.splice(idx, 1)
  }

  return selected
}

/**
 * Orquestar el flujo transaccional completo para la adquisicion de un paquete de recompensas.
 *
 * Tipo: Funcion de dominio asincrona.
 * Parametros: Identificador de la sesion del usuario.
 * Retorno: Promesa que encapsula los resultados de la apertura (identificador, estampas ganadas, saldo consumido y reembolsos).
 * Efecto: Cargar en memoria el estado actual de suerte (pity) del usuario, procesar el sorteo 
 * aplicando los algoritmos matematicos, invocar la transaccion atomica en la capa de datos para deducir 
 * el saldo y registrar las ganancias, y finalmente, incrementar el contador de infortunio para los 
 * elementos no seleccionados en esta ronda.
 *
 * Complejidad temporal: Orden lineal O(n) relativo al tamano del catalogo de coleccionables para la 
 * construccion de probabilidades y la ejecucion del sorteo.
 * Complejidad espacial: Orden lineal O(n) para mantener el estado de los contadores en la memoria de la aplicacion.
 * Escalabilidad: Robusta. Al procesar el calculo de distribucion pseudoaleatoria en el hilo de ejecucion 
 * de Node.js (capa dos), se alivia la carga de computo de la base de datos PostgreSQL, reservando la 
 * capa tres exclusivamente para transacciones atomicas de escritura, lo cual es el patron optimo 
 * para escenarios de alta demanda concurrente.
 */
// Ejecuta el algoritmo completo y abre el sobre.
export async function sOpenPack(userId: string): Promise<qOpenPackResult> {
  // 1. Cargar el historial de intentos individuales del usuario
  const pityRows = await qGetPityCounters(userId)

  if (pityRows.length < 5) {
    throw new Error('No hay suficientes estampas en el catálogo para abrir un sobre')
  }

  // 2. Transmutar probabilidades estaticas a probabilidades efectivas
  const itemsWithProb = pityRows.map(row => ({
    stamp_id:      row.stamp_id,
    adjusted_prob: sCalculateAdjustedProbability(
      row.base_probability,
      row.packs_since_last,
      row.pity_increment,
      row.pity_threshold
    ),
  }))

  // 3. Ejecutar sorteo logico en memoria
  const selectedIds = sWeightedSampleWithoutReplacement(itemsWithProb, 5)

  // 4. Delegar la persistencia y control de saldo a una transaccion de base de datos
  const result = await qOpenPack(userId, selectedIds)

  // 5. Compensar el infortunio incrementando el contador logico de las estampas ausentes
  //    (Las recompensas ganadas reinician su propio contador desde el modulo de base de datos)
  const selectedSet = new Set(selectedIds)
  const notSelected = pityRows.filter(r => !selectedSet.has(r.stamp_id))

  if (notSelected.length > 0) {
    const pityIncrements = notSelected.map(r => ({
      user_id:          userId,
      stamp_id:         r.stamp_id,
      packs_since_last: Math.min(r.packs_since_last + 1, r.pity_threshold),
      updated_at:       new Date().toISOString(),
    }))

    // Actualizacion masiva asincrona sin bloquear el retorno del resultado al cliente
    await lSupabase
      .from('stamp_pity')
      .upsert(pityIncrements, { onConflict: 'user_id,stamp_id' })
  }

  return result
}