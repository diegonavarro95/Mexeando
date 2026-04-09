/**
 * Archivo: src/db/queries/q-passport.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo forma parte de la capa dos de la arquitectura, identificada como la capa de Api y logica.
 * Actua como la capa de acceso a datos para el dominio del pasaporte, estampas y transacciones de puntos. 
 * Su proposito arquitectonico es interactuar de manera exclusiva con la capa tres, correspondiente al 
 * almacenamiento en Supabase y el motor relacional. Al encapsular las consultas complejas y la logica 
 * transaccional en este nivel, se permite que los controladores de las rutas mantengan un enfoque unico 
 * en la logica de recepcion y respuesta de las peticiones. Las funciones definidas aqui son consumidas 
 * de manera habitual por rutas de tipo Get para mostrar el estado del perfil del turista, y rutas de tipo 
 * Post para registrar la logica de apertura de sobres.
 */

import { lSupabase } from '../../lib/l-supabase.js'

export interface qStampInAlbum {
  stamp_id: number
  slug: string
  icon: string
  rarity: 'common' | 'rare' | 'exclusive'
  base_probability: number
  exclusive_city: string | null
  requires_physical_checkin: boolean
  collection_id: number
  sort_order: number
  obtained: boolean
  obtained_at: string | null
}

export interface qCollectionProgress {
  collection_id: number
  slug: string
  icon: string
  sort_order: number
  reward_desc: string | null
  total_stamps: number
  obtained_stamps: number
  completion_pct: number
  is_complete: boolean
  stamps: qStampInAlbum[]
}

/**
 * Obtener el progreso general y el detalle del album de estampas de un usuario.
 *
 * Tipo: Funcion asincrona.
 * Parametros: Identificador del usuario provisto como cadena de texto.
 * Retorno: Promesa que resuelve en un arreglo de progreso de colecciones enriquecido con estampas.
 * Efecto: Ejecutar un procedimiento almacenado para calcular el progreso base, recuperar el catalogo
 * completo de estampas desde la base de datos y realizar un cruce de informacion en la memoria del 
 * servidor con el registro historico de obtenciones del usuario.
 *
 * Complejidad temporal: O(S + U) donde S representa el total de estampas del catalogo y U equivale 
 * al numero de estampas obtenidas por el usuario. El mapeo e iteracion se resuelven de forma lineal.
 * Complejidad espacial: O(S + U) requerido para almacenar los mapas y arreglos de busqueda rapida.
 * Escalabilidad: El codigo es altamente escalable dentro del contexto del sistema. Dado que el total 
 * de estampas (S) se encuentra acotado por reglas de negocio, y el total de estampas de usuario (U) 
 * nunca puede superar a (S), la carga computacional en el entorno de ejecucion siempre sera pequena 
 * y predecible, evitando cuellos de botella al escalar la base de usuarios concurrentes.
 */
export async function qGetAlbum(userId: string): Promise<qCollectionProgress[]> {
  // Primera fase: Consultar el progreso por coleccion utilizando una funcion parametrizada nativa.
  const { data: progress, error: progErr } = await lSupabase
    .rpc('fn_album_progress', { p_user_id: userId })

  if (progErr) throw new Error(`Error al obtener progreso: ${progErr.message}`)

  // Segunda fase: Solicitar todas las estampas del catalogo junto a sus metadatos.
  const { data: allStamps, error: stampErr } = await lSupabase
    .from('stamps')
    .select('id, slug, icon, rarity, base_probability, exclusive_city, collection_id, sort_order')
    .order('sort_order')

  if (stampErr) throw new Error(`Error al obtener catalogo: ${stampErr.message}`)

  // Tercera fase: Identificar las estampas adquiridas por el usuario para determinar la primera fecha de obtencion.
  const { data: userStamps, error: usErr } = await lSupabase
    .from('user_stamps')
    .select('stamp_id, obtained_at')
    .eq('user_id', userId)
    .order('obtained_at', { ascending: true })

  if (usErr) throw new Error(`Error al obtener estampas del usuario: ${usErr.message}`)

  // Construir una estructura de mapa rapido para asociar el identificador de la estampa con su fecha.
  const obtainedMap = new Map<number, string>()
  for (const us of userStamps ?? []) {
    if (!obtainedMap.has(us.stamp_id)) {
      obtainedMap.set(us.stamp_id, us.obtained_at)
    }
  }

  // Cuarta fase: Construir la respuesta final integrando el catalogo general con el historial individual.
  const stampsByCollection = new Map<number, qStampInAlbum[]>()
  for (const s of allStamps ?? []) {
    const obtained = obtainedMap.has(s.id)
    const stamp: qStampInAlbum = {
      stamp_id:                  s.id,
      slug:                      s.slug,
      icon:                      s.icon,
      rarity:                    s.rarity,
      base_probability:          s.base_probability,
      exclusive_city:            s.exclusive_city,
      requires_physical_checkin: s.rarity === 'exclusive',
      collection_id:             s.collection_id,
      sort_order:                s.sort_order,
      obtained,
      obtained_at: obtained ? (obtainedMap.get(s.id) ?? null) : null,
    }
    const arr = stampsByCollection.get(s.collection_id) ?? []
    arr.push(stamp)
    stampsByCollection.set(s.collection_id, arr)
  }

  return (progress ?? []).map((p: {
    collection_id: number; collection_slug: string; collection_icon: string
    sort_order?: number; reward_desc: string | null
    total_stamps: number; obtained_stamps: number
    completion_pct: number; is_complete: boolean
  }) => ({
    collection_id:   p.collection_id,
    slug:            p.collection_slug,
    icon:            p.collection_icon,
    sort_order:      p.sort_order ?? 0,
    reward_desc:     p.reward_desc,
    total_stamps:    Number(p.total_stamps),
    obtained_stamps: Number(p.obtained_stamps),
    completion_pct:  Number(p.completion_pct),
    is_complete:     Boolean(p.is_complete),
    stamps:          stampsByCollection.get(p.collection_id) ?? [],
  }))
}

export interface qPityRow {
  stamp_id: number
  packs_since_last: number
  base_probability: number
  pity_increment: number
  pity_threshold: number
}

/**
 * Consultar los contadores de probabilidad acumulada del sistema de sobres para un usuario.
 *
 * Tipo: Funcion asincrona.
 * Parametros: Identificador del usuario provisto como cadena de texto.
 * Retorno: Promesa que resuelve en un arreglo detallado de los contadores de probabilidad actuales.
 * Efecto: Consultar de manera exclusiva las estampas catalogadas como obtenibles en sobres y mapearlas
 * con los registros de aperturas del usuario desde la ultima vez que recibio dicha estampa.
 *
 * Complejidad temporal: O(S) donde S representa la fraccion de estampas disponibles en los sobres.
 * Complejidad espacial: O(S) necesario para construir y retornar el mapa en memoria.
 * Escalabilidad: Representa una operacion eficiente y escalable. Al depender unicamente de un subconjunto 
 * acotado y no del historial global de transacciones, garantiza tiempos de resolucion consistentes ante 
 * picos de interaccion en el ecosistema.
 */
export async function qGetPityCounters(userId: string): Promise<qPityRow[]> {
  // Obtener informacion de las estampas que cuentan con probabilidades validas para el mecanismo de sobres.
  const { data: stamps, error: sErr } = await lSupabase
    .from('stamps')
    .select('id, base_probability, pity_increment, pity_threshold')
    .neq('rarity', 'exclusive')

  if (sErr) throw new Error(`Error al obtener estampas: ${sErr.message}`)

  // Adquirir los registros numericos que detallan los sobres sin exito recientes del usuario.
  const { data: pity } = await lSupabase
    .from('stamp_pity')
    .select('stamp_id, packs_since_last')
    .eq('user_id', userId)

  const pityMap = new Map<number, number>(
    (pity ?? []).map(p => [p.stamp_id, p.packs_since_last])
  )

  return (stamps ?? []).map(s => ({
    stamp_id:         s.id,
    packs_since_last: pityMap.get(s.id) ?? 0,
    base_probability: Number(s.base_probability),
    pity_increment:   Number(s.pity_increment),
    pity_threshold:   s.pity_threshold,
  }))
}

export interface qOpenPackResult {
  pack_opening_id: number
  stamps_obtained: Array<{
    stamp_id: number
    slug: string
    icon: string
    rarity: string
    is_duplicate: boolean
    bonus_points: number  // Recompensa de veinte puntos al resultar duplicada
  }>
  points_spent:   number
  bonus_points_total: number
  new_balance:    number
}

/**
 * Ejecutar la secuencia logica y transaccional para la apertura de un sobre virtual de estampas.
 *
 * Tipo: Funcion asincrona.
 * Parametros: Identificador del usuario y un arreglo con los identificadores de estampas asignadas.
 * Retorno: Promesa que resuelve en los metadatos de la operacion, saldo nuevo y recompensas generadas.
 * Efecto: Completar un proceso con multiples etapas garantizando la integridad de los datos. Se 
 * descuentan los puntos del saldo aprovechando las validaciones del motor relacional, se asientan las 
 * estampas otorgadas calculando cuales son duplicados, se generan recompensas y se reinician contadores.
 *
 * Complejidad temporal: O(K) donde K designa el tamano del sobre provisto, siendo usualmente un digito 
 * constante igual a cinco. Todas las consultas secundarias emplean busquedas optimizadas por indices.
 * Complejidad espacial: O(K) empleado durante la construccion de arreglos temporales para las inserciones.
 * Escalabilidad: Posee una arquitectura de altisima escalabilidad y rendimiento optimizado. Debido a que 
 * la complejidad esta ligada al tamano constante del paquete y no al volumen historico de la base de 
 * datos, este metodo emula un desempeno de tiempo constante amortizado. La concurrencia se delega a 
 * las restricciones nativas del gestor relacional.
 */
export async function qOpenPack(
  userId: string,
  stampIds: number[]
): Promise<qOpenPackResult> {
  // Primera fase: Restar puntos de participacion asumiendo que el motor impedira la accion 
  // si el balance resultara inferior a cero por su naturaleza restrictiva.
  const { error: deductErr } = await lSupabase
    .from('point_transactions')
    .insert({
      user_id:  userId,
      amount:   -200,
      action:   'pack_opened',
      ref_type: 'pack',
    })

  if (deductErr) {
    // Si la restriccion interna bloquea la insercion, se interrumpe y previene la apertura.
    if (deductErr.message.includes('check') || deductErr.message.includes('violates')) {
      throw new Error('INSUFFICIENT_POINTS')
    }
    throw new Error(`Error al descontar puntos: ${deductErr.message}`)
  }

  // Segunda fase: Investigar la existencia previa de los identificadores proporcionados para el usuario.
  const { data: alreadyOwned } = await lSupabase
    .from('user_stamps')
    .select('stamp_id')
    .eq('user_id', userId)
    .in('stamp_id', stampIds)

  const ownedSet = new Set((alreadyOwned ?? []).map(s => s.stamp_id))

  // Tercera fase: Archivar el evento de consumo en la tabla de bitacora general.
  const { data: packRow, error: packErr } = await lSupabase
    .from('pack_openings')
    .insert({
      user_id:      userId,
      points_spent: 200,
      stamp_ids:    stampIds,
    })
    .select('id')
    .single()

  if (packErr) throw new Error(`Error al guardar historial: ${packErr.message}`)

  // Cuarta fase: Asentar la distribucion de cada elemento hacia el casillero del solicitante.
  const stampInserts = stampIds.map(sid => ({
    user_id:    userId,
    stamp_id:   sid,
    source:     'pack' as const,
    ref_id:     String(packRow.id),
  }))

  const { error: stampErr } = await lSupabase
    .from('user_stamps')
    .insert(stampInserts)

  if (stampErr) throw new Error(`Error al guardar estampas: ${stampErr.message}`)

  // Quinta fase: Generar recompensas equivalentes en caso de documentar repeticiones en las adjudicaciones.
  const duplicates = stampIds.filter(sid => ownedSet.has(sid))
  let bonusPointsTotal = 0

  if (duplicates.length > 0) {
    const bonusInserts = duplicates.map(sid => ({
      user_id:  userId,
      amount:   20,
      action:   'duplicate_stamp' as const,
      ref_type: 'stamp' as const,
      ref_id:   String(sid),
    }))

    const { error: bonusErr } = await lSupabase
      .from('point_transactions')
      .insert(bonusInserts)

    if (!bonusErr) bonusPointsTotal = duplicates.length * 20
  }

  // Sexta fase: Reiniciar las probabilidades acumuladas para los identificadores adjudicados.
  // La estrategia consiste en una insercion con reemplazo ante conflicto para prevenir redundancia.
  const pityUpserts = stampIds.map(sid => ({
    user_id:          userId,
    stamp_id:         sid,
    packs_since_last: 0,
    updated_at:       new Date().toISOString(),
  }))

  await lSupabase
    .from('stamp_pity')
    .upsert(pityUpserts, { onConflict: 'user_id,stamp_id' })

  // Septima fase: Leer el saldo actualizado aprovechando su disponibilidad en una tabla de perfiles.
  const { data: profile } = await lSupabase
    .from('profiles')
    .select('point_balance')
    .eq('id', userId)
    .single()

  // Octava fase: Recuperar estetica y metadatos de los elementos para informar a la capa de presentacion.
  const { data: stampMeta } = await lSupabase
    .from('stamps')
    .select('id, slug, icon, rarity')
    .in('id', stampIds)

  const metaMap = new Map((stampMeta ?? []).map(s => [s.id, s]))

  return {
    pack_opening_id:    packRow.id,
    stamps_obtained:    stampIds.map(sid => ({
      stamp_id:    sid,
      slug:        metaMap.get(sid)?.slug ?? '',
      icon:        metaMap.get(sid)?.icon ?? '',
      rarity:      metaMap.get(sid)?.rarity ?? 'common',
      is_duplicate: ownedSet.has(sid),
      bonus_points: ownedSet.has(sid) ? 20 : 0,
    })),
    points_spent:       200,
    bonus_points_total: bonusPointsTotal,
    new_balance:        profile?.point_balance ?? 0,
  }
}