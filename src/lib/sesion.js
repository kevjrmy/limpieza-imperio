import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { COOKIE, configurada, leerSesion } from './firma.js';

/**
 * Quién puede entrar.
 *
 * La aplicación tiene un único usuario. No hay registro, no hay invitaciones,
 * no hay roles y no hay recuperación de contraseña: sólo hay que responder a
 * una pregunta, ¿es él? El usuario y el hash de su contraseña viven en dos
 * variables de entorno y la base de datos no sabe nada de todo esto.
 *
 * La comprobación se hace en cada recurso que toca datos —el layout que
 * envuelve todas las páginas, cada acción de servidor y cada ruta de descarga—
 * y no sólo en el proxy. El motivo es concreto: Next renderiza la página aparte
 * del layout, así que un layout que decide no pintar `children` igualmente ha
 * ejecutado la página y ha serializado su resultado en la carga RSC. Se probó,
 * y por ahí salían nombres y direcciones en /servicios. La única barrera que no
 * se puede esquivar es la que está pegada a los datos.
 *
 * Dos comportamientos deliberados:
 *
 *  · Sin configurar y en producción, la aplicación NO se sirve. Esto es
 *    contabilidad real con nombres, direcciones y teléfonos: quedarse abierta
 *    al mundo por un despiste de variables de entorno no es una opción.
 *
 *  · Sin configurar en local, se pasa sin autenticar para poder trabajar, pero
 *    la interfaz lo anuncia con una banda imposible de no ver. La regla de la
 *    casa: avisar, nunca disimular.
 */

/**
 * ¿Hay autenticación montada?
 *
 * Es una función y no una constante a propósito: Next evalúa los módulos en
 * tiempo de compilación, y una constante que lea `process.env` arriba del todo
 * se queda con lo que hubiera en el build. Lo mismo que pasa con el cliente de
 * la base en `db.js`.
 */
export const autenticacionConfigurada = configurada;

const enProduccion = process.env.NODE_ENV === 'production';

/** El usuario configurado, para enseñarlo. Nunca la contraseña, claro. */
function usuarioConfigurado() {
  return (process.env.USUARIO || '').trim();
}

/** Mensaje de por qué no se puede servir, o null si todo está en orden. */
export function motivoBloqueo() {
  if (configurada()) return null;
  if (enProduccion) {
    return 'La autenticación no está configurada. La aplicación no se sirve sin ella '
      + 'porque contiene datos reales de clientes. Faltan USUARIO, CLAVE_HASH '
      + 'y SESION_SECRETO.';
  }
  return null;
}

class SinPermiso extends Error {}

/** Lee la cookie y dice si vale. Sin efectos: no redirige ni escribe nada. */
export async function haySesion() {
  if (!configurada()) return false;
  return Boolean(leerSesion((await cookies()).get(COOKIE)?.value));
}

/**
 * A dónde volver después de entrar.
 *
 * La ruta la pone el proxy en `x-ruta` en cada petición. Se sobrescribe allí
 * siempre, así que no vale que alguien mande su propia cabecera; aun así se
 * comprueba que sea una ruta de esta aplicación y no un `//otro-sitio.com`,
 * porque un parámetro de redirección sin validar es un salto abierto a
 * cualquier parte y es exactamente el sitio donde suelen colarse.
 */
async function volverA() {
  let ruta = '';
  try {
    ruta = (await headers()).get('x-ruta') || '';
  } catch {
    return '';
  }
  if (!ruta.startsWith('/') || ruta.startsWith('//') || ruta.startsWith('/\\')) return '';
  if (ruta === '/' || ruta.startsWith('/entrar')) return '';
  return `?volver=${encodeURIComponent(ruta)}`;
}

/**
 * Exige sesión válida. Se llama desde todo lo que lee o escribe datos.
 *
 * @returns {Promise<{usuario: string|null, sinAutenticar?: boolean}>}
 */
export async function exigirSesion() {
  if (!configurada()) {
    // En producción no se llega hasta aquí: el layout raíz ya ha cortado.
    if (enProduccion) throw new SinPermiso('Autenticación no configurada.');
    return { usuario: null, sinAutenticar: true };
  }

  if (!(await haySesion())) redirect(`/entrar${await volverA()}`);

  return { usuario: usuarioConfigurado() };
}
