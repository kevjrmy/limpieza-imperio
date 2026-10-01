import { timingSafeEqual } from 'node:crypto';

import { Resend } from 'resend';

import { negocio } from '../../../lib/negocio.js';
import { fechaRespaldo, volcar } from '../../../lib/respaldo.js';

export const dynamic = 'force-dynamic';

/**
 * El respaldo semanal, por correo.
 *
 * Lo llama el cron de Vercel (`vercel.json`) una vez a la semana: vuelca la
 * base con el mismo código que `npm run respaldo` y la manda adjunta al correo
 * del negocio. **Sólo lee**; ver `lib/respaldo.js`.
 *
 * Es la única ruta que toca datos sin `exigirSesion()`, y no es un descuido: el
 * cron no tiene cookie. Lo que la guarda es `CRON_SECRET`, que Vercel manda
 * solo en la cabecera `Authorization` cuando la variable existe. Sin la
 * variable no pasa nadie —tampoco el cron—, que es el lado seguro del fallo.
 * La respuesta no lleva nunca datos: el volcado sale sólo por el correo.
 *
 * **Si la base no se puede leer, no se manda nada.** Es una decisión suya
 * (octubre de 2026), no un olvido: no quiere un correo de fallo. El error queda
 * en los registros de Vercel y la única señal que le llega es que ese lunes no
 * hay correo. No añadas un aviso sin hablarlo.
 *
 * El adjunto lleva nombres, direcciones, teléfonos y algún DNI. Va a un solo
 * buzón, el del negocio; no añadas destinatarios de paso.
 */
export async function GET(peticion) {
  if (!autorizada(peticion.headers.get('authorization'))) {
    return new Response('No autorizado.', { status: 401 });
  }

  const llave = process.env.RESENT_RESEND_API_KEY;
  const dominio = process.env.RESENT_RESEND_EMAIL_DOMAIN;
  if (!llave || !dominio) {
    console.error('Respaldo semanal: faltan las variables de Resend.');
    return new Response('Sin configurar.', { status: 500 });
  }

  let copia;
  try {
    copia = await volcar();
  } catch (e) {
    console.error('Respaldo semanal: no se pudo leer la base.', e);
    return new Response('No se pudo leer la base.', { status: 500 });
  }

  const fecha = fechaRespaldo();
  const archivo = `respaldo-${fecha}.sql`;
  const { error } = await new Resend(llave).emails.send({
    from: `${negocio.nombre} <respaldo@${dominio}>`,
    to: [negocio.correo],
    subject: `Respaldo semanal de la contabilidad · ${fecha}`,
    text: [
      `Copia de seguridad de la contabilidad a ${fecha}.`,
      '',
      `${copia.filas} filas: ${copia.resumen.join(' · ')}.`,
      '',
      'El archivo adjunto es la base entera. No hay que hacer nada con él:',
      'basta con no borrar este correo. Si algún día hiciera falta, se recupera',
      `con  sqlite3 nueva.db < ${archivo}`,
      '',
      'Lleva los datos de tus clientes y colaboradores: no lo reenvíes.',
    ].join('\n'),
    attachments: [{ filename: archivo, content: Buffer.from(copia.sql, 'utf8') }],
  });

  if (error) {
    console.error('Respaldo semanal: el correo no salió.', error);
    return new Response('El correo no salió.', { status: 500 });
  }

  return Response.json({ ok: true, fecha, filas: copia.filas });
}

/** ¿Trae la cabecera el secreto del cron? Sin secreto configurado, nunca. */
function autorizada(cabecera) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !cabecera) return false;
  const esperada = Buffer.from(`Bearer ${secreto}`);
  const recibida = Buffer.from(cabecera);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
