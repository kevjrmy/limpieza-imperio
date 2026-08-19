/**
 * Proxy (lo que hasta Next 15 se llamaba middleware).
 *
 * Aquí NO se decide quién entra: eso se comprueba en cada recurso que toca
 * datos —el layout, cada acción de servidor, cada descarga— mediante
 * `exigirSesion()`. Filtrar por patrones de ruta aquí es frágil: el patrón y la
 * forma en que Next resuelve la petición pueden no coincidir, y un desajuste
 * deja accesible algo que se creía protegido.
 *
 * Le quedan dos trabajos, los dos cosas que sólo se pueden hacer antes de
 * renderizar:
 *
 *  1. Anotar la ruta pedida en `x-ruta`, para que `exigirSesion()` sepa a dónde
 *     devolverle después de entrar. Un componente de servidor no puede saber su
 *     propia URL de ninguna otra forma.
 *
 *  2. Volver a firmar la cookie cuando lleva más de un día emitida, que es lo
 *     que hace que los treinta días sean deslizantes. Tampoco cabe en otro
 *     sitio: una cookie sólo se puede escribir en una acción de servidor o aquí,
 *     nunca durante el renderizado, y él navega mucho más de lo que guarda.
 *
 * De `lib/` importa `firma.js` y sólo `firma.js`, que no toca Next ni la base
 * de datos. Con Clerk esto no podía importar nada porque el middleware se
 * empaquetaba aparte; desde Next 16 el proxy corre en Node y un módulo de
 * `node:crypto` entra sin problema. Si algún día `firma.js` crece hacia otras
 * dependencias, esta importación es lo primero que hay que revisar.
 */

import { NextResponse } from 'next/server';

import {
  COOKIE, DURACION, configurada, esHttps, firmarSesion, leerSesion, opcionesCookie, tocaRenovar,
} from './lib/firma.js';

export function proxy(peticion) {
  const cabeceras = new Headers(peticion.headers);

  // Se sobrescribe siempre, nunca se lee lo que venga: si no, cualquiera podría
  // mandar su propia `x-ruta` y decidir a dónde le devuelve el login.
  cabeceras.set('x-ruta', peticion.nextUrl.pathname + peticion.nextUrl.search);

  const respuesta = NextResponse.next({ request: { headers: cabeceras } });

  if (configurada()) {
    const sesion = leerSesion(peticion.cookies.get(COOKIE)?.value);
    if (tocaRenovar(sesion)) {
      respuesta.cookies.set(
        COOKIE,
        firmarSesion(Date.now() + DURACION),
        opcionesCookie(esHttps(peticion.headers, peticion.nextUrl.protocol)),
      );
    }
  }

  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos los internos de Next y los archivos estáticos.
    '/((?!_next|favicon.ico|.*\\.(?:css|js|png|jpg|jpeg|svg|ico|woff2?)$).*)',
    '/(api|trpc)(.*)',
  ],
};
