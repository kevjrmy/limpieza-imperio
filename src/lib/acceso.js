'use server';

/**
 * Entrar y salir. Las dos únicas cosas que hace la autenticación.
 *
 * Va aparte de `acciones.js` por un motivo evidente en cuanto se piensa: allí
 * todo pasa por `exigirSesion()`, y entrar es justo lo que no puede exigir
 * sesión. Aquí no se toca la base de datos en ningún caso.
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { COOKIE, DURACION, configurada, esHttps, firmarSesion, opcionesCookie } from './firma.js';
import { claveCorrecta } from './clave.js';

// ── Freno a la fuerza bruta ─────────────────────────────────────────────────
//
// Se cuenta en memoria del proceso, y hay que ser honesto con lo que eso vale:
// Vercel reutiliza instancias pero puede levantar varias, así que esto frena a
// quien pruebe en serie y no a quien reparta los intentos. No es la defensa
// principal —la defensa principal es que la contraseña tiene 139 bits y no se
// adivina— sino lo que evita que alguien deje un script dando la lata toda la
// noche y de paso nos coma la factura de funciones.
//
// El propio `scrypt` pone lo suyo: unos 50 ms por intento, se acierte o no.

const MAX_INTENTOS = 8;
const VENTANA = 15 * 60 * 1000;
const TOPE_MEMORIA = 500;   // para que la lista no crezca sin fin

const fallos = new Map();

function demasiados(quien) {
  const f = fallos.get(quien);
  if (!f) return false;
  if (Date.now() - f.desde > VENTANA) { fallos.delete(quien); return false; }
  return f.veces >= MAX_INTENTOS;
}

function anotarFallo(quien) {
  if (fallos.size > TOPE_MEMORIA) fallos.clear();
  const f = fallos.get(quien);
  if (!f || Date.now() - f.desde > VENTANA) fallos.set(quien, { veces: 1, desde: Date.now() });
  else f.veces += 1;
}

/**
 * A dónde ir después de entrar.
 *
 * Sólo se aceptan rutas de esta aplicación. Un `volver` sin comprobar convierte
 * la pantalla de entrada en un trampolín a cualquier sitio: se entra de verdad,
 * y se acaba en una página ajena que se le parece.
 */
function destinoSeguro(volver) {
  const r = String(volver ?? '');
  if (!r.startsWith('/') || r.startsWith('//') || r.includes('\\')) return '/';
  if (r.startsWith('/entrar')) return '/';
  return r;
}

/**
 * Comprobar usuario y contraseña, y abrir la sesión.
 *
 * El mensaje de error es el mismo se equivoque en lo que se equivoque. Decir
 * «ese usuario no existe» le ahorraría trabajo a quien esté probando, y a él no
 * le sirve de nada: sólo hay un usuario y se lo sabe.
 */
export async function entrar(datos) {
  if (!configurada()) {
    return { error: 'La autenticación no está configurada en este servidor.' };
  }

  const cabeceras = await headers();
  const quien = (cabeceras.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip';

  if (demasiados(quien)) {
    return {
      error: 'Demasiados intentos seguidos. Espera un cuarto de hora y vuelve a probar.',
    };
  }

  const usuario = String(datos.get('usuario') ?? '').trim().toLowerCase();
  const clave = String(datos.get('clave') ?? '');

  // La contraseña se comprueba SIEMPRE, aunque el usuario ya esté mal. Con un
  // cortocircuito, un usuario equivocado responde en un milisegundo y uno
  // acertado en cincuenta: eso es contarle a quien mide cuál de los dos campos
  // ha acertado, que es media contraseña regalada.
  const claveVale = await claveCorrecta(clave, process.env.CLAVE_HASH || '');
  const usuarioVale = usuario === (process.env.USUARIO || '').trim().toLowerCase();

  if (!claveVale || !usuarioVale) {
    anotarFallo(quien);
    return { error: 'El usuario o la contraseña no son correctos.' };
  }

  fallos.delete(quien);

  const galletas = await cookies();
  galletas.set(
    COOKIE,
    firmarSesion(Date.now() + DURACION),
    opcionesCookie(esHttps(cabeceras)),
  );

  // Fuera de cualquier try: `redirect` funciona lanzando, y capturarlo lo
  // convertiría en un error rojo en pantalla con la sesión ya abierta.
  redirect(destinoSeguro(datos.get('volver')));
}

/** Cerrar la sesión: se borra la cookie y se vuelve a la pantalla de entrada. */
export async function salir() {
  const cabeceras = await headers();
  const galletas = await cookies();

  // Se pisa con una cookie vacía y caducada en vez de `delete()` a secas: así
  // los atributos coinciden exactamente con los que se usaron al ponerla, que
  // es lo que decide si el navegador la da por la misma.
  galletas.set(COOKIE, '', { ...opcionesCookie(esHttps(cabeceras)), maxAge: 0 });

  redirect('/entrar');
}
