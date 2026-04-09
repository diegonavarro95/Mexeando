/**
 * Archivo: src/lib/l-sendgrid.ts
 *
 * Introduccion a la arquitectura del sistema:
 * Este archivo pertenece a la capa dos de la arquitectura (Logica y Api). Actua como un servicio 
 * de integracion externa para delegar el envio de correos electronicos transaccionales, utilizando 
 * el proveedor SendGrid. Su alcance esta estrictamente limitado a los flujos secundarios, especificamente 
 * la recuperacion de contrasenas, dado que la verificacion inicial de correos se gestiona nativamente en 
 * la capa tres mediante el servicio de autenticacion de Supabase (Supa Auth). La abstraccion de esta 
 * libreria mantiene los controladores limpios y facilita la modificacion del servicio de mensajeria 
 * en escenarios futuros sin refactorizar la logica de negocio.
 */

import sgMail from '@sendgrid/mail'

const apiKey = process.env.SENDGRID_API_KEY

// Iniciar y verificar la configuracion del proveedor externo.
if (!apiKey) {
  console.warn('[sendgrid] SENDGRID_API_KEY no configurada — el envio de correos fallara')
} else {
  sgMail.setApiKey(apiKey)
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@garnacha.dev'
const FROM_NAME  = 'La Ruta de la Garnacha'
const APP_URL    = process.env.APP_URL ?? 'http://localhost:5173'

export interface lEmailOptions {
  to:      string
  subject: string
  html:    string
  text:    string
}

/**
 * Despachar un correo electronico utilizando la interfaz de SendGrid.
 *
 * Tipo: Funcion asincrona.
 * Parametros: Objeto estructurado que contiene el destinatario, el asunto y el cuerpo del mensaje 
 * en formatos de texto plano e HyperText Markup Language (HTML).
 * Retorno: Promesa vacia resolviendo la finalizacion de la transmision al proveedor.
 * Efecto: Invocar la libreria del proveedor para encolar el correo.
 *
 * Complejidad temporal: O(1). La ejecucion de encolado y envio se maneja de forma constante 
 * mediante un servicio asincrono optimizado que despacha peticiones de red directas.
 * Complejidad espacial: O(M) donde M es la longitud del mensaje y las opciones proporcionadas.
 * Escalabilidad: Moderada a alta. El cuello de botella no radica en Node.js, sino en los 
 * limites de tarifa (Rate Limits) impuestos por la interfaz externa de SendGrid y el ancho de 
 * banda de red del servidor de despliegue.
 */
export async function lSendEmail(opts: lEmailOptions): Promise<void> {
  if (!apiKey) throw new Error('SENDGRID_API_KEY no configurada')

  await sgMail.send({
    to:   opts.to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  })
}

/**
 * Generar la plantilla de correo electronico para el flujo de recuperacion de contrasena.
 *
 * Tipo: Funcion constructora sincronica.
 * Parametros: Cadenas de texto con el nombre de usuario a mostrar y el token de seguridad generado.
 * Retorno: Objeto configurado de tipo lEmailOptions carente unicamente del destinatario final.
 * Efecto: Ensamblar una url de redireccion utilizando el entorno local y concatenarla dentro de 
 * una plantilla visual enriquecida para garantizar una experiencia de usuario consistente con la 
 * interfaz grafica (PWA) de la capa uno.
 *
 * Complejidad temporal: O(1). La concatenacion de literales es una operacion trivial en tiempo de ejecucion.
 * Complejidad espacial: O(P) donde P es el tamano de la plantilla generada, manteniendose siempre en 
 * parametros reducidos sin impacto en la memoria operativa.
 * Escalabilidad: Altamente escalable, siendo una funcion pura y sin dependencias externas bloqueantes.
 */
export function lPasswordResetEmail(displayName: string, resetToken: string): lEmailOptions {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`

  return {
    to:      '',  // Se completa en la capa de servicio que realiza la invocacion final.
    subject: 'Recupera tu contraseña — La Ruta de la Garnacha',
    text: [
      `Hola ${displayName},`,
      '',
      'Recibimos una solicitud para cambiar la contraseña de tu cuenta.',
      `Copia este enlace en tu navegador: ${resetUrl}`,
      '',
      'El enlace expira en 30 minutos.',
      'Si no solicitaste este cambio, ignora este correo.',
      '',
      '— Equipo La Ruta de la Garnacha',
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0400;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0400;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1C0D03;border-radius:12px;overflow:hidden;border:1px solid rgba(255,243,220,0.1);">
        <tr>
          <td width="33%" height="4" style="background:#2D6A4F;"></td>
          <td width="34%" height="4" style="background:#F5EFE0;"></td>
          <td width="33%" height="4" style="background:#C1121F;"></td>
        </tr>
        <tr><td colspan="3" style="padding:32px 40px 0;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:bold;color:#F4A300;letter-spacing:0.08em;">LA RUTA DE LA GARNACHA</p>
          <p style="margin:6px 0 0;font-size:12px;color:rgba(255,243,220,0.5);">FIFA World Cup 2026</p>
        </td></tr>
        <tr><td colspan="3" style="padding:28px 40px;">
          <p style="color:#FFF3DC;font-size:16px;margin:0 0 12px;">Hola <strong>${displayName}</strong>,</p>
          <p style="color:rgba(255,243,220,0.7);font-size:14px;line-height:1.6;margin:0 0 24px;">
            Recibimos una solicitud para cambiar la contraseña de tu cuenta.<br>
            Haz clic en el botón para continuar. El enlace expira en <strong style="color:#F4A300;">30 minutos</strong>.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center">
              <a href="${resetUrl}"
                 style="display:inline-block;background:#C1121F;color:#FFF3DC;font-size:14px;font-weight:bold;
                        text-decoration:none;padding:14px 32px;border-radius:50px;letter-spacing:0.06em;">
                CAMBIAR CONTRASEÑA
              </a>
            </td></tr>
          </table>
          <p style="color:rgba(255,243,220,0.4);font-size:12px;margin:24px 0 0;line-height:1.5;">
            Si no solicitaste este cambio, ignora este correo. Tu contraseña actual sigue siendo válida.<br>
            O copia este enlace: <span style="color:#F4A300;">${resetUrl}</span>
          </p>
        </td></tr>
        <tr><td colspan="3" style="padding:16px 40px;border-top:1px solid rgba(255,243,220,0.08);text-align:center;">
          <p style="color:rgba(255,243,220,0.3);font-size:11px;margin:0;">
            La Ruta de la Garnacha · Talent Land 2026
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}