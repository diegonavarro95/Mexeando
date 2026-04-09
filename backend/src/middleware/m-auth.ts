/**
 * Archivo: src/middleware/m-auth.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se situa en la capa dos de la arquitectura, referida a la logica y la interfaz de
 * programacion de aplicaciones. Actua como el interceptor perimetral principal de seguridad para
 * el control de acceso. Su proposito arquitectonico es validar la autenticidad y la integridad de
 * las peticiones entrantes antes de que estas alcancen los controladores de dominio o interactuen
 * con la base de datos de la capa tres.
 * Al emplear validacion criptografica, el sistema logra una resolucion libre de estado, 
 * delegando la persistencia de la sesion y eliminando la necesidad de consultar el repositorio de 
 * datos en cada solicitud protegida.
 */

import type { MiddlewareHandler } from 'hono'
import { sVerifyAccessToken } from '../services/s-auth.js'
import type { AppContext } from '../types/t-app.js'

/**
 * Interceptar peticiones de red para verificar la presencia y validez de un token de acceso.
 *
 * Rutas asociadas: Aplicable de manera transversal a cualquier ruta de red que requiera identidad.
 * Tipo: Funcion interceptora asincrona.
 * Parametros: Contexto de la peticion en curso y funcion de avance en la cadena de resolucion.
 * Retorno: Promesa que avanza la ejecucion hacia el controlador destino o aborta el flujo 
 * emitiendo un codigo de estado no autorizado.
 * Efecto: Extraer la cabecera de autorizacion, someter la cadena a validacion criptografica, 
 * decodificar la carga util e inyectar el identificador univoco del usuario junto a su rol 
 * operativo en el contexto de memoria de la peticion.
 *
 * Complejidad temporal: Orden constante O(1). La verificacion del token se resuelve con algoritmos 
 * de hash que operan enteramente en la memoria local, consumiendo un tiempo de ciclo predecible 
 * sin depender del tamano de la base de datos de usuarios.
 * Complejidad espacial: Orden constante O(1). La huella de memoria comprende unicamente las cadenas 
 * de texto en evaluacion y el objeto simple resultante de la decodificacion.
 * Escalabilidad: Excepcionalmente alta. Al disenar este interceptor de manera puramente libre de 
 * estado, se omite cualquier bloqueo de lectura sobre bases de datos o memorias intermedias. 
 * Esta independencia permite escalar horizontalmente los nodos de logica de forma lineal sin 
 * generar cuellos de botella en la fase de reconocimiento de identidad.
 */
export const mAuth: MiddlewareHandler<AppContext> = async (ctx, next) => {
  const authHeader = ctx.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ctx.json(
      { data: null, error: 'Token de acceso requerido' },
      401
    )
  }

  const token = authHeader.slice(7)

  try {
    const payload = await sVerifyAccessToken(token)

    // Inyectar los datos de identidad y privilegios en el contexto para consumo de los controladores subyacentes.
    ctx.set('userId', payload.sub)
    ctx.set('userRole', payload.role)

    await next()
  } catch {
    // Interrumpir el flujo de la peticion en caso de detectar alteraciones criptograficas o caducidad temporal.
    return ctx.json(
      { data: null, error: 'Token invalido o expirado' },
      401
    )
  }
}