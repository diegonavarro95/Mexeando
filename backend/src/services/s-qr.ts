/**
 * Archivo: src/services/s-qr.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo se situa en la capa dos de la arquitectura (Logica de Negocio), funcionando 
 * como un microservicio criptografico utilitario. Su proposito arquitectonico es 
 * gestionar el ciclo de vida de los testigos de identidad (tokens) que se codifican 
 * fisicamente en los codigos de barras bidimensionales (Qr) impresos por los negocios.
 * A diferencia de los testigos de sesion, estos codigos se disenan para ser inmutables 
 * y carecer de fecha de expiracion, permitiendo que la validacion de las visitas 
 * fisicas sea segura (infalsificable gracias a la firma digital) y libre de estado 
 * (verificable matematicamente sin consultar la base de datos).
 */

// src/services/s-qr.ts
// Genera y verifica los tokens JWT que van dentro del código QR del negocio.
// El QR contiene un token firmado con JWT_SECRET que incluye el business_id.
// No tiene expiración — el negocio no cambia y el QR debe ser permanente.
// La firma garantiza que un token no puede ser fabricado sin el JWT_SECRET.

import { SignJWT, jwtVerify } from 'jose'

// Extraer y codificar la clave maestra del entorno en un arreglo de bytes.
const sQrSecret = new TextEncoder().encode(process.env.JWT_SECRET!)

export interface sQrPayload {
  sub: string         // Referencia al identificador del negocio
  type: 'qr_checkin' // Marcador de proposito estricto para evitar suplantacion
  iat: number
}

/**
 * Emitir un testigo criptografico permanente asociado a un local comercial.
 *
 * Tipo: Funcion utilitaria asincrona.
 * Parametros: Cadena de texto correspondiente al identificador unico del negocio.
 * Retorno: Promesa que entrega una cadena de texto (JWT) firmada y lista para renderizacion visual.
 * Efecto: Construir una carga util con el identificador como sujeto principal (`sub`) 
 * y un proposito inequivoco (`type`). Omite intencionalmente la fecha de expiracion 
 * para garantizar la durabilidad del soporte fisico (papel/acrilico) en los comercios.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Altamente escalable al no interactuar con persistencia ni requerir red externa.
 */
// Genera un token firmado para el QR del negocio.
// Sin expiración: el dueño puede imprimirlo y usarlo indefinidamente.
export async function sGenerateQrToken(businessId: string): Promise<string> {
  return new SignJWT({ type: 'qr_checkin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(businessId)
    .setIssuedAt()
    .sign(sQrSecret)
}

/**
 * Comprobar la validez criptografica y la intencion de un testigo escaneado.
 *
 * Tipo: Funcion utilitaria asincrona.
 * Parametros: Cadena de texto recuperada por la lente del dispositivo del turista.
 * Retorno: Promesa resolviendo en el objeto estructurado de la carga util si es autentico.
 * Efecto: Someter la cadena al algoritmo de verificacion empleando la clave maestra. 
 * Si la firma es legitima, realiza una asercion de dominio para asegurar que el 
 * testigo provisto fue emitido especificamente para registrar visitas y no es un 
 * token de sesion reciclado maliciosamente.
 *
 * Complejidad temporal: Orden constante O(1).
 * Complejidad espacial: Orden constante O(1).
 * Escalabilidad: Extrema. El diseno de arquitectura distribuida descansa en esta validacion 
 * algoritmica, ahorrando miles de consultas a la base de datos durante eventos de alta 
 * densidad poblacional.
 */
// Verifica y decodifica un token de QR.
// Lanza error si la firma es inválida o el tipo no coincide.
export async function sVerifyQrToken(token: string): Promise<sQrPayload> {
  const { payload } = await jwtVerify(token, sQrSecret)

  // Auditoria estricta de proposito para prevenir la reutilizacion cruzada de credenciales
  if (payload['type'] !== 'qr_checkin') {
    throw new Error('El testigo no cumple los parametros de un registro de visita valido')
  }

  return {
    sub:  payload.sub as string,
    type: 'qr_checkin',
    iat:  payload.iat as number,
  }
}