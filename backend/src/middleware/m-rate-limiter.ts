/**
 * Archivo: src/middleware/m-rate-limiter.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se ubica en la capa dos de la arquitectura, correspondiente a la logica y Api del sistema.
 * Funciona como un interceptor (middleware) global de seguridad que protege la infraestructura 
 * subyacente frente a trafico abusivo o ataques de denegacion de servicio. 
 * Su responsabilidad arquitectonica es coordinarse con el servicio de Redis (capa tres) proporcionado 
 * por la libreria de limitacion de tasa, evaluando cada peticion entrante antes de que consuma 
 * ciclos de procesamiento en los controladores de dominio. Al abstraer esta validacion en un 
 * componente perimetral, se garantiza la resiliencia del servidor y se mantiene una separacion 
 * clara de responsabilidades.
 */

import { Context, Next } from "hono";
import { publicRateLimit, authRateLimit } from "../lib/l-rate-limit.js";

/**
 * Interceptar peticiones entrantes para contabilizar y limitar la tasa de consumo por usuario.
 *
 * Rutas asociadas: Aplicable transversalmente a todas las rutas de la aplicacion, derivando 
 * dinamicamente a reglas mas estrictas si la ruta de destino incluye el segmento de autenticacion.
 * Tipo: Funcion interceptora asincrona.
 * Parametros: Contexto de ejecucion del servidor y funcion para avanzar al siguiente eslabon.
 * Retorno: Promesa que avanza la ejecucion o interrumpe la respuesta con un codigo de estado 429.
 * Efecto: Identificar al cliente mediante su direccion de red, consultar el repositorio en memoria 
 * para verificar la cuota disponible, adjuntar cabeceras informativas al cliente y bloquear el 
 * acceso si se ha excedido el limite permitido.
 *
 * Complejidad temporal: Orden constante O(1). La extraccion de cabeceras y la evaluacion de rutas 
 * toman un tiempo insignificante. La comunicacion con el proveedor externo de Redis utiliza 
 * algoritmos atomicos que se resuelven en milisegundos.
 * Complejidad espacial: Orden constante O(1). Las asignaciones de memoria son variables primitivas 
 * locales que se recolectan inmediatamente al finalizar el ciclo de peticion.
 * Escalabilidad: Altamente escalable. Depender de un almacen de datos externo y centralizado (Redis) 
 * para contabilizar los accesos permite que el servidor de Node conserve su arquitectura libre de 
 * estado. Esto facilita el despliegue de multiples instancias del servidor detras de un balanceador 
 * de carga, asegurando que los limites de cuota se apliquen uniformemente a nivel de ecosistema 
 * y no por maquina individual.
 */
export const rateLimiter = async (c: Context, next: Next) => {
    // Extraer la direccion de red del cliente considerando entornos de proxy inverso.
    const identifier = c.req.header('x-forwarded-for') || '127.0.0.1';

    // Evaluar la ruta destino para asignar la politica de restriccion adecuada.
    const isAuth = c.req.path.includes('/auth');
    const limiter = isAuth ? authRateLimit : publicRateLimit;

    // Ejecutar la transaccion de verificacion de cuota en el servicio de cache.
    const { success, limit, remaining, reset} = await limiter.limit(identifier);

    // Adjuntar cabeceras estandarizadas de limitacion de tasa para la telemetria del cliente.
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', reset.toString());

    // Interrumpir el flujo y notificar al cliente si la cuota ha sido agotada.
    if(!success){
        return c.json({
        error: 'Too Many Requests',
        message: isAuth 
            ? 'Limite de seguridad en Auth excedido (20/min).' 
            : 'Limite de peticiones publicas excedido (100/min).'
        }, 429);
    }

    await next();
};