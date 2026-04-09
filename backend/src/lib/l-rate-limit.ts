/**
 * Archivo: src/lib/l-rate-limit.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura, referida a la logica y la interfaz 
 * de programacion de aplicaciones. Constituye el modulo de seguridad y proteccion contra abusos, 
 * implementando un mecanismo de limitacion de tasa apoyado en una instancia de Redis.
 * Su proposito arquitectonico es actuar como un escudo perimetral antes de que las peticiones 
 * alcancen los controladores o la base de datos de la capa tres, previniendo ataques de denegacion de 
 * servicio, ataques de fuerza bruta y el agotamiento de cuotas en servicios externos de la capa cuatro.
 * Utiliza una conexion basada en transferencia de estado representacional optimizada para 
 * entornos sin servidor, garantizando latencias minimas en la validacion de cada transaccion 
 * sin consumir conexiones de red persistentes.
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * Instancia de conexion para la gestion de cache y limitacion de tasa.
 * * Tipo: Instancia de objeto.
 * Parametros: Localizador de recursos y clave de acceso provistos por el entorno de despliegue.
 * Efecto: Inicializar un cliente de red para comunicarse con el cluster de Redis de manera 
 * transaccional, ideal para interceptores de ejecucion rapida.
 */
const redis = new Redis({
   url: process.env.UPSTASH_REDIS_REST_URL!,
   token : process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Limitador de tasa para rutas de acceso publico y consumo general.
 * Rutas asociadas: Peticiones generales hacia puntos de acceso de lectura e interaccion basica.
 * Tipo: Instancia de clase empleando algoritmo de ventana deslizante.
 * Parametros: Limite configurado a cien peticiones por cada intervalo de sesenta segundos.
 * Efecto: Evaluar el identificador del cliente para decidir si se permite o rechaza 
 * el procesamiento de la peticion en curso hacia el servidor.
 * * Complejidad temporal: Orden constante O(1). El algoritmo de ventana deslizante se ejecuta en el 
 * servidor de Redis mediante un guion atomico precompilado que evalua los contadores instantaneamente.
 * Complejidad espacial: Orden constante O(1) por cada usuario unico. La huella de memoria consiste 
 * unicamente en identificadores de marcas de tiempo efimeras gestionadas por Redis.
 * Escalabilidad: Extremadamente alta. Al externalizar el estado de la validacion, los nodos de la 
 * aplicacion mantienen su naturaleza libre de estado, permitiendo balancear el trafico de manera 
 * uniforme sin desincronizacion de limites de tasa entre multiples instancias del servidor.
 */
export const publicRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "ratelimit_public",
});

/**
 * Limitador de tasa estricto para rutas de autenticacion.
 * Rutas asociadas: Peticiones dirigidas a los puntos de acceso de seguridad y sesiones.
 * Tipo: Instancia de clase empleando algoritmo de ventana deslizante.
 * Parametros: Limite configurado a veinte peticiones por cada intervalo de sesenta segundos.
 * Efecto: Mitigar activamente intentos de adivinacion de credenciales o ataques de diccionarios 
 * aplicando una restriccion significativamente mas severa sobre puntos de acceso sensibles.
 * * Complejidad temporal: Orden constante O(1). Resolucion atomica y veloz en el repositorio en memoria.
 * Complejidad espacial: Orden constante O(1) por cada identificador rastreado en la red.
 * Escalabilidad: Excelente. Proporciona resiliencia critica para la capa de seguridad sin impactar 
 * el tiempo de respuesta en el flujo normal de inicio de sesion para los usuarios legitimos del ecosistema.
 */
export const authRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "ratelimit_auth",
});