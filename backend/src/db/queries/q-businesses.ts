/**
 * Archivo: src/db/queries/q-businesses.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo constituye la capa de acceso a datos para la entidad de negocios
 * situandose en la capa dos correspondiente a la interfaz de programacion de aplicaciones y logica.
 * Su responsabilidad arquitectonica es aislar la interaccion directa con la base de datos
 * alojada en la capa tres de almacenamiento utilizando el cliente de Supabase.
 * Centralizar las consultas permite que los controladores de rutas se enfoquen unicamente
 * en validar peticiones y devolver respuestas estructuradas.
 */

import { lSupabase } from '../../lib/l-supabase.js'
import type { BusinessMapResult } from '../../types/t-app.js'

/**
 * Interfaz de entrada para solicitar negocios cercanos.
 * Estructura los parametros necesarios para buscar en un radio geografico determinado.
 */
export interface qGetNearbyInput {
  lat: number
  lng: number
  radiusM: number
  userId: string | null
  categoryId: number | null
  limit: number
  q?: string
}

/**
 * Consultar negocios cercanos a una coordenada especifica.
 * Rutas asociadas: Peticion tipo Get en el endpoint principal de negocios.
 * Tipo: Funcion asincrona.
 * Parametros: Objeto de entrada con latitud, longitud, radio, identificador de usuario, categoria y limite.
 * Retorno: Promesa que resuelve en un arreglo con los datos de negocios cercanos estructurados para el mapa.
 * Efecto: Invocar una funcion de procedimiento almacenado en la base de datos para delegar el calculo
 * espacial de distancia correspondiente al Indice Ola de la capa dos. Posteriormente aplicar un filtrado
 * en la memoria del servidor si se incluye un termino de busqueda.
 */
export async function qGetNearbyBusinesses(
  input: qGetNearbyInput
): Promise<BusinessMapResult[]> {
  
  // Realizar la llamada a la funcion enviando unicamente los parametros que acepta nativamente.
  // La base de datos se encarga de filtrar la categoria utilizando el parametro designado.
  const { data, error } = await lSupabase.rpc('fn_indice_ola', {
    p_lat: input.lat,
    p_lng: input.lng,
    p_radius_m: input.radiusM,
    p_user_id: input.userId,
    p_category_id: input.categoryId, 
    p_limit: input.limit,
  });

  if (error) {
    console.error("Error en base de datos al consultar negocios cercanos:", error.message);
    throw new Error(`Error al consultar negocios: ${error.message}`);
  }

  let results = (data ?? []) as any[];

  // Aplicar filtrado en memoria para terminos de busqueda.
  // Ya que la funcion nativa no soporta la busqueda de texto libre dinamica, 
  // filtrar los resultados en el servidor antes de enviarlos al cliente.
  if (input.q) {
    const qLower = input.q.toLowerCase();
    results = results.filter(biz => {
      // Filtrar por coincidencia en el nombre o en el identificador de la categoria.
      const matchName = biz.name?.toLowerCase().includes(qLower);
      const matchCat = biz.category_slug?.toLowerCase().includes(qLower);
      return matchName || matchCat;
    });
  }

  return results as BusinessMapResult[];
}

/**
 * Interfaz para tipar de manera estricta los videos asociados a un negocio.
 */
export interface BusinessVideo {
  id: string
  storage_path: string
  video_type: 'pre_worldcup' | 'post_worldcup'
}

/**
 * Interfaz que define la estructura detallada de un negocio.
 */
export interface qBusinessDetail {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  category_id: number
  category_slug: string
  category_icon: string
  address: string
  city: string
  phone: string | null
  website: string | null
  accepts_card: boolean
  ola_verified: boolean
  avg_rating: number
  review_count: number
  checkin_count: number
  schedule: Record<string, string[] | null> | null
  status: string
  created_at: string
  lat?: number
  lng?: number
  folio?: number
  worldcup_finished?: boolean
  images: Array<{ id: string; storage_path: string; is_primary: boolean; sort_order: number }>
  menu_items: Array<{ id: string; name: string; price: number | null; icon: string | null; sort_order: number }>
  business_videos?: Array<BusinessVideo> 
  recent_reviews: Array<{
    id: string
    rating: number
    body: string | null
    language: string
    created_at: string
    profile: { display_name: string; avatar_url: string | null }
  }>
  translated_description: string | null
}

/**
 * Obtener la informacion detallada de un negocio por su identificador.
 * Rutas asociadas: Peticion tipo Get en el endpoint de negocios especificando el identificador.
 * Tipo: Funcion asincrona.
 * Parametros: Cadena de texto correspondiente al identificador del negocio y cadena opcional para el idioma.
 * Retorno: Promesa con los datos cruzados del negocio o valor nulo si ocurre un error.
 * Efecto: Ejecutar multiples consultas de lectura en las tablas correspondientes para anidar resenas, 
 * imagenes, productos de menu y videos. Extraer coordenadas desde el tipo espacial almacenado.
 */
export async function qGetBusinessById(
  id: string,
  lang: string = 'es'
): Promise<qBusinessDetail | null> {
  
  // Ejecutar una consulta directa seleccionando los campos necesarios para evitar errores de tipado.
  // Incluir elementos estructurados como el folio y los videos del negocio.
  const { data, error } = await lSupabase
    .from('businesses')
    .select(`
      id, owner_id, name, slug, description,
      category_id, address, city, phone, website,
      accepts_card, ola_verified, avg_rating, review_count,
      checkin_count, schedule, status, created_at,
      location, folio, worldcup_finished,
      categories ( slug, icon ),
      business_images ( id, storage_path, is_primary, sort_order ),
      menu_items ( id, name, price, icon, sort_order ),
      business_videos ( id, storage_path, video_type )
    `)
    .eq('id', id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single()

  if (error || !data) return null

  // Tratar el objeto de datos temporalmente de forma generica para permitir 
  // la lectura de la columna espacial de ubicacion.
  const biz = data as any;

  // Consultar las ultimas cinco resenas junto con el perfil de cada autor.
  const { data: reviews } = await lSupabase
    .from('reviews')
    .select(`
      id, rating, body, language, created_at,
      profiles ( display_name, avatar_url )
    `)
    .eq('business_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  // Procesar la traduccion de la descripcion si se requiere un idioma distinto al predeterminado.
  let translatedDescription: string | null = null
  if (lang !== 'es') {
    const { data: tr } = await lSupabase
      .from('translations')
      .select('value')
      .eq('entity_type', 'business')
      .eq('entity_id', id)
      .eq('field', 'description')
      .eq('language', lang)
      .single()

    translatedDescription = tr?.value ?? null
  }

  // Extraer las coordenadas de forma segura analizando la estructura recibida de la base de datos.
  let lat: number | undefined = undefined;
  let lng: number | undefined = undefined;

  if (biz.location && typeof biz.location === 'string') {
    // Soportar formatos espaciales estructurados como texto.
    const match = biz.location.match(/POINT\s*\(\s*([-\d.]+)\s+([-.\d.]+)\s*\)/i);
    if (match) {
      lng = parseFloat(match[1]);
      lat = parseFloat(match[2]);
    }
  } else if (biz.location && typeof biz.location === 'object' && biz.location.coordinates) {
    lng = biz.location.coordinates[0];
    lat = biz.location.coordinates[1];
  }

  console.log(`Log de sistema: Encontradas coordenadas espaciales con latitud ${lat} y longitud ${lng}`);

  const category = Array.isArray(biz.categories) ? biz.categories[0] : biz.categories;

  // Retornar el objeto final estructurado para acoplarse a la interfaz esperada por el cliente.
  return {
    id: biz.id,
    owner_id: biz.owner_id,
    name: biz.name,
    slug: biz.slug,
    description: biz.description,
    category_id: biz.category_id,
    address: biz.address,
    city: biz.city,
    phone: biz.phone,
    website: biz.website,
    accepts_card: biz.accepts_card,
    ola_verified: biz.ola_verified,
    avg_rating: biz.avg_rating,
    review_count: biz.review_count,
    checkin_count: biz.checkin_count,
    schedule: biz.schedule,
    status: biz.status,
    created_at: biz.created_at,
    lat, 
    lng,
    folio: biz.folio,
    worldcup_finished: biz.worldcup_finished,
    category_slug: category?.slug ?? '',
    category_icon: category?.icon ?? '',
    images: (biz.business_images ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    menu_items: (biz.menu_items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
    business_videos: biz.business_videos ?? [],
    recent_reviews: (reviews ?? []).map((r: any) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      language: r.language,
      created_at: r.created_at,
      profile: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    })),
    translated_description: translatedDescription,
  }
}

/**
 * Interfaz para los parametros de entrada requeridos al crear un negocio.
 */
export interface qCreateBusinessInput {
  ownerId: string
  name: string
  categoryId: number
  description: string
  lat: number
  lng: number
  address: string
  city: string
  phone?: string
  website?: string
  acceptsCard: boolean
  schedule?: Record<string, string[] | null>
}

/**
 * Insertar un nuevo negocio en el sistema.
 * Rutas asociadas: Peticion tipo Post en el endpoint principal de negocios.
 * Tipo: Funcion asincrona.
 * Parametros: Objeto especificando todos los metadatos y coordenadas del negocio.
 * Retorno: Promesa con el identificador, nombre y un alias de ruta generado de forma automatica.
 * Efecto: Almacenar una nueva fila en la tabla de negocios estableciendo el estatus como pendiente 
 * y construyendo la ubicacion mediante la funcion constructora de puntos espaciales.
 */
export async function qCreateBusiness(
  input: qCreateBusinessInput
): Promise<{ id: string; name: string; slug: string | null }> {
  const { data, error } = await lSupabase
    .from('businesses')
    .insert({
      owner_id:    input.ownerId,
      category_id: input.categoryId,
      name:        input.name,
      description: input.description,
      location:    `POINT(${input.lng} ${input.lat})`,
      address:     input.address,
      city:        input.city,
      phone:       input.phone ?? null,
      website:     input.website ?? null,
      accepts_card: input.acceptsCard,
      schedule:    input.schedule ?? null,
      status:      'pending',
    })
    .select('id, name, slug')
    .single()

  if (error || !data) {
    throw new Error(`Error al crear el negocio en base de datos: ${error?.message}`)
  }

  return data
}

/**
 * Interfaz de entrada para la creacion de elementos en el menu.
 */
export interface qAddMenuItemInput {
  businessId: string
  name: string
  price?: number
  icon?: string
  sortOrder?: number
}

/**
 * Interfaz de retorno que describe la estructura de un elemento de menu registrado.
 */
export interface qMenuItemResult {
  id: string
  business_id: string
  name: string
  price: number | null
  icon: string | null
  sort_order: number
  is_available: boolean
  created_at: string
}

/**
 * Anadir un producto o servicio al menu de un negocio.
 * Rutas asociadas: Peticion tipo Post en el endpoint de menu del negocio.
 * Tipo: Funcion asincrona.
 * Parametros: Objeto especificando los detalles comerciales del producto.
 * Retorno: Promesa representando el elemento creado.
 * Efecto: Almacenar el registro del menu en la tabla vinculada otorgando disponibilidad predeterminada.
 */
export async function qAddMenuItem(
  input: qAddMenuItemInput
): Promise<qMenuItemResult> {
  const { data, error } = await lSupabase
    .from('menu_items')
    .insert({
      business_id:  input.businessId,
      name:         input.name,
      price:        input.price ?? null,
      icon:         input.icon ?? null,
      sort_order:   input.sortOrder ?? 0,
      is_available: true,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(`Error al insertar item de menu: ${error?.message}`)
  }

  return data as qMenuItemResult
}

/**
 * Validar que un usuario es el propietario registrado de un negocio especifico.
 * Rutas asociadas: Peticiones de escritura que requieren validacion previa de acceso.
 * Tipo: Funcion asincrona.
 * Parametros: Cadenas de texto para el identificador del negocio y del propietario.
 * Retorno: Promesa resolviendo a un valor booleano verdadero en caso afirmativo.
 * Efecto: Ejecutar una consulta optimizada para buscar la coexistencia de ambos valores 
 * asegurando la autorizacion previa a la manipulacion de recursos.
 */
export async function qVerifyBusinessOwner(
  businessId: string,
  ownerId: string
): Promise<boolean> {
  const { data } = await lSupabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .single()

  return data !== null
}