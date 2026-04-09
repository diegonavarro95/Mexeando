/**
 * Archivo: src/middleware/m-rbac.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se ubica en la capa dos de la arquitectura, referida a la logica y la interfaz 
 * de programacion de aplicaciones. Funciona como el modulo central de autorizacion, implementando 
 * un mecanismo de control de acceso basado en roles. Su proposito arquitectonico es gobernar los 
 * permisos a nivel de ruta, protegiendo los controladores y evitando modificaciones no autorizadas 
 * en la base de datos de la capa tres. Depende de manera estricta del interceptor de autenticacion 
 * para recibir el contexto de identidad poblado. Al resolver la autorizacion directamente en la memoria 
 * del servidor, aisla por completo esta responsabilidad y blinda la informacion critica sin consumir 
 * recursos de red.
 */

// Middleware de autorización basado en roles (RBAC).
// Siempre debe ir DESPUÉS de mAuth en la cadena de middlewares,
// porque depende de que ctx.get('userRole') ya esté disponible.
//
// Si los demas lo quieren probar:
//   app.post('/businesses', mAuth, mRequireRole('owner', 'admin'), handler)
//   app.get('/admin/metrics', mAuth, mRequireRole('admin'), handler)

import type { MiddlewareHandler } from 'hono'
import type { AppContext, UserRole } from '../types/t-app.js'

/**
 * Generar un interceptor dinamico para validar los privilegios del usuario solicitante.
 *
 * Rutas asociadas: Utilizado en rutas protegidas como administracion, creacion o edicion de recursos.
 * Tipo: Funcion de orden superior (fabrica) que retorna un interceptor asincrono.
 * Parametros: Parametro rest conteniendo un arreglo de roles permitidos del tipo enumerado correspondiente.
 * Retorno: Funcion interceptora compatible con el flujo de ejecucion del servidor.
 * Efecto: Extraer el rol del usuario desde el contexto de memoria. Evaluar si dicho rol se 
 * encuentra dentro del conjunto de roles autorizados. Permitir el avance hacia el controlador final o 
 * interrumpir la solicitud con un codigo de estado prohibitivo en caso de discrepancia.
 *
 * Complejidad temporal: Orden lineal O(n), donde n representa el numero de roles permitidos proporcionados 
 * como argumento. Dado que este conjunto tiene una longitud maxima de tres elementos, la operacion 
 * de busqueda se comporta funcionalmente como un orden constante O(1).
 * Complejidad espacial: Orden constante O(1). La retencion en memoria se limita a la referencia del arreglo 
 * capturado por la clausura (closure) de la funcion interna y las variables elementales de evaluacion.
 * Escalabilidad: Altamente escalable. El diseno favorece la autorizacion libre de estado. Al no requerir 
 * lecturas adicionales a la capa de persistencia ni comunicaciones con servicios externos para validar 
 * permisos, el interceptor procesa cada solicitud de manera instantanea, garantizando una latencia nula 
 * incluso bajo regimenes de alta concurrencia.
 */
// recibe los roles permitidos y devuelve el middleware
export function mRequireRole(
  ...allowedRoles: UserRole[]
): MiddlewareHandler<AppContext> {
  return async (ctx, next) => {
    const userRole = ctx.get('userRole')

    if (!userRole || !allowedRoles.includes(userRole)) {
      return ctx.json(
        {
          data: null,
          error: `Acceso denegado. Se requiere rol: ${allowedRoles.join(' o ')}`,
        },
        403
      )
    }

    await next()
  }
}