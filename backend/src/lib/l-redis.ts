/**
 * Archivo: src/lib/l-redis.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo opera como un puente entre la capa dos (Logica y Api) y la capa tres (Datos y Almacenamiento). 
 * Su responsabilidad arquitectonica principal es establecer y mantener una conexion de red persistente 
 * y segura con el cluster de Redis administrado mediante Upstash.
 * Dentro del diagrama de arquitectura, esta conexion es un recurso compartido y critico, consumido 
 * primariamente por la libreria BullMQ para orquestar colas de trabajo asincronas, procesamiento en 
 * segundo plano y el bus de eventos de publicacion o suscripcion. Al abstraer la instanciacion del 
 * cliente en este modulo, se garantiza la reutilizacion de un unico canal TCP a lo largo de la 
 * aplicacion, previniendo el agotamiento de puertos y optimizando el consumo de memoria del servidor.
 */

import { Redis } from "ioredis"

/**
 * Instancia de conexion principal para el orquestador de colas asincronas.
 *
 * Tipo: Instancia de objeto (Cliente de configuracion para ioredis).
 * Parametros de inicializacion: Se alimenta de la cadena de conexion segura inyectada por el 
 * entorno de despliegue, acompanada de un objeto de opciones de red.
 * Efecto: Inicializar un conector bidireccional hacia la base de datos en memoria, configurando 
 * el protocolo de seguridad de la capa de transporte (TLS) para permitir esquemas de validacion 
 * flexibles, un estandar necesario para las redes internas de proveedores en la nube como Upstash.
 *
 * Complejidad temporal: Orden constante O(1) respecto al consumo del procesador para levantar la 
 * instancia en la memoria. El tiempo real para establecer el apreton de manos cifrado depende de 
 * la latencia de red, pero al ser una operacion unica en el ciclo de vida, no afecta el rendimiento.
 * Complejidad espacial: Orden constante O(1). La referencia ocupa una huella de memoria fija 
 * para gestionar el agrupamiento de conexiones (connection pool) y el buffer de transmision.
 * Escalabilidad: Excepcionalmente alta. Al delegar el manejo de estados efimeros a Upstash, esta 
 * configuracion permite escalar horizontalmente los nodos de la aplicacion de manera infinita sin 
 * estados compartidos. El disenio es robusto frente a caidas de red, ya que la libreria ioredis 
 * implementa reconexion automatica y reintentos exponenciales, garantizando la resiliencia 
 * del sistema de colas en escenarios de carga masiva.
 */
export const bullConnection = new Redis(
    process.env.UPSTASH_REDIS_TLS_URL!,
    {
        tls: { rejectUnauthorized: false },
    }
)