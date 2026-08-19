/**
 * La contraseña: convertirla en hash y comprobarla.
 *
 * `scrypt` viene en Node, así que esto no añade ni una dependencia. Es
 * deliberado: bcrypt y argon2 se compilan, y un paquete nativo que un día deja
 * de compilar en el runtime de Vercel es un despliegue roto por algo que no
 * tiene nada que ver con la contabilidad.
 *
 * Aquí sólo se hashea y se compara. Quién es el usuario y qué pasa cuando
 * acierta es cosa de `acceso.js`.
 */

import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

// Los parámetros van dentro del propio hash, así que se pueden subir más
// adelante sin invalidar el que ya haya puesto: al comprobar se usan los que
// traiga el hash guardado, no éstos.
const N = 16384;   // coste: ~16 MB de memoria y unas décimas de segundo
const R = 8;
const P = 1;
const LARGO = 32;

// scrypt con N=16384 y r=8 pide 128·N·r = 16 MB. El tope por defecto de Node
// son 32 MB, justo al borde; se sube para que no reviente por un pelo.
const MAXMEM = 64 * 1024 * 1024;

const derivar = (clave, sal, n, r, p) => new Promise((cumplir, fallar) => {
  scrypt(clave, sal, LARGO, { N: n, r, p, maxmem: MAXMEM }, (e, dk) => (
    e ? fallar(e) : cumplir(dk)
  ));
});

/**
 * Hash de una contraseña, en un solo texto que ya lleva dentro todo lo que
 * hace falta para comprobarla: `scrypt$N$r$p$sal$hash`.
 *
 * Se normaliza a NFKC porque la misma contraseña tecleada en el móvil y en el
 * ordenador puede llegar con acentos compuestos de distinta manera; sin esto,
 * una contraseña con eñes entraría en un sitio y no en el otro.
 */
export async function hashDeClave(clave) {
  const sal = randomBytes(16);
  const dk = await derivar(String(clave).normalize('NFKC'), sal, N, R, P);
  return ['scrypt', N, R, P, sal.toString('base64url'), dk.toString('base64url')].join('$');
}

/** ¿Es ésta la contraseña? Comparación en tiempo constante. */
export async function claveCorrecta(clave, hash) {
  const partes = String(hash || '').split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const [, n, r, p, sal, esperado] = partes;
  let dk;
  try {
    dk = await derivar(
      String(clave).normalize('NFKC'),
      Buffer.from(sal, 'base64url'),
      Number(n), Number(r), Number(p),
    );
  } catch {
    return false;
  }

  const guardado = Buffer.from(esperado, 'base64url');
  if (guardado.length !== dk.length) return false;
  return timingSafeEqual(guardado, dk);
}

/**
 * Una contraseña aleatoria de 24 caracteres, en grupos de cuatro.
 *
 * El alfabeto no lleva `0 O 1 l I`: no hay que recuperar esto de un papel a
 * menudo, pero el día que toque no puede depender de distinguir un uno de una
 * ele. Son 24 caracteres sobre 56 posibles, del orden de 139 bits — no hay
 * fuerza bruta que valga, que es justo lo que sostiene todo esto: con un solo
 * secreto y sin segundo factor, la contraseña ES la seguridad.
 */
export function claveAleatoria(grupos = 6) {
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const trozo = () => Array.from(
    { length: 4 },
    () => ALFABETO[randomInt(ALFABETO.length)],
  ).join('');
  return Array.from({ length: grupos }, trozo).join('-');
}

/** Secreto para firmar las cookies. 32 bytes en hexadecimal. */
export function secretoAleatorio() {
  return randomBytes(32).toString('hex');
}
