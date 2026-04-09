/**
 * Archivo: src/services/s-translations.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo opera dentro de la capa dos de la arquitectura (Logica de Negocio), funcionando 
 * como un servicio de integracion externa. Su proposito arquitectonico es abstraer la 
 * complejidad de la traduccion multilingue, sirviendo como un cliente envoltorio (wrapper) 
 * para la interfaz de programacion de DeepL (ubicada en la capa cuatro). 
 * Fundamentalmente, implementa un patron de diseno de cacheo en memoria distribuida 
 * empleando Redis (capa tres) para interceptar solicitudes repetitivas. Esta estrategia 
 * (Cache-Aside) es critica para mitigar el consumo de cuotas en APIs de pago, reducir la 
 * latencia general del chat interactivo y garantizar que la aplicacion se mantenga reactiva.
 */

// Servicio de Traducción con capa de Caché

import { Redis } from '@upstash/redis';

// Inicialización de la memoria caché
// El método fromEnv() lee automáticamente las variables REST_URL y REST_TOKEN en el entorno
const redis = Redis.fromEnv();

// Credenciales y configuración de la interfaz externa
const TRANSLATION_API_KEY = process.env.DEEPL_API_KEY;
const TRANSLATION_URL = 'https://api-free.deepl.com/v2/translate'; 

/**
 * Traduce una cadena de texto a un idioma objetivo implementando interceptacion de cache.
 *
 * Tipo: Funcion de dominio asincrona y recursiva de red.
 * Parametros: Texto original y el identificador de la lengua destino (ISO 639-1).
 * Retorno: Promesa que resuelve en la cadena de texto traducida.
 * Efecto: Primero, evalua si la traduccion exacta ya existe en el repositorio de memoria 
 * rapida (Redis) utilizando una llave predecible. Si existe (Cache Hit), la retorna 
 * instantaneamente. Si no existe (Cache Miss), invoca al servicio externo, procesa 
 * la respuesta, almacena el nuevo resultado en Redis para futuras peticiones y finalmente 
 * entrega la cadena al controlador de red.
 *
 * Complejidad temporal: O(1) si la cadena esta en cache (resolucion de milisegundos). 
 * O(m) si ocurre un fallo de cache, donde m es el tiempo de procesamiento de lenguaje 
 * natural del servicio externo (variable segun la longitud del texto y congestion de red).
 * Complejidad espacial: O(t) donde t es el tamano combinado de la cadena original y traducida.
 * Escalabilidad: Altamente escalable. El patron de cache distribuido asegura que unicamente 
 * las frases nuevas penalicen el rendimiento de la red externa. A medida que la aplicacion 
 * acumula vocabulario estandarizado de los turistas, la tasa de aciertos de cache incrementara, 
 * acercando el costo temporal promedio a O(1) y disminuyendo los costos operativos.
 */
export const translateText = async (text: string, targetLang: string): Promise<string> => {
  // Validación de seguridad para que el servidor no explote si falta la credencial
  if (!TRANSLATION_API_KEY) {
    throw new Error("Falta la API Key de traducción en el entorno de despliegue");
  }

  // Generar una "llave" única y predecible de identificación para la búsqueda en caché
  const cacheKey = `trans:${targetLang}:${text}`;
  const cachedTranslation = await redis.get<string>(cacheKey);
  
  // Condicion de éxito inmediato (Cache Hit)
  if (cachedTranslation) {
    console.log(`Caché Hit: '${text}' -> '${cachedTranslation}'`);
    return cachedTranslation;
  }

  // Condicion de procesamiento pesado (Cache Miss) - Solicitud de red externa
  console.log(`Caché Miss. Solicitando traducción de: '${text}'...`);
  const response = await fetch(TRANSLATION_URL, {
    method: 'POST',
    headers: {
      // Formato de autorización estricto requerido por el proveedor
      'Authorization': `DeepL-Auth-Key ${TRANSLATION_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [text], // La estructura receptora demanda un arreglo de elementos
      target_lang: targetLang.toUpperCase() // Normalización estricta de la nomenclatura del idioma
    })
  });

  // Manejo de códigos de error de red o bloqueos de tarifa de la API externa
  if (!response.ok) {
    throw new Error(`Error en el servicio externo: Status HTTP ${response.status}`);
  }
  
  // Analizar sintácticamente el flujo de bytes de la respuesta JSON
  const data = await response.json();
  // Navegar por el árbol de objetos de la respuesta para extraer la cadena atómica
  const translatedText = data.translations[0].text;

  // Persistir asíncronamente el nuevo par clave-valor en el sistema de memoria rápida
  await redis.set(cacheKey, translatedText);

  return translatedText;
};