/**
 * La cookie de sesión: firmarla y comprobarla.
 *
 * Este es el único módulo de `lib/` que puede importar el proxy, y por eso no
 * toca Next, ni la base de datos, ni nada que arrastre dependencias: sólo
 * `node:crypto` y tres variables de entorno. Si algún día necesita algo más,
 * no lo añadas aquí — sepáralo, o el proxy volverá a arrastrar medio programa.
 *
 * **La sesión no se guarda en ninguna parte.** Es una cookie firmada que dice
 * cuándo caduca, y nada más: no hay tabla de usuarios ni tabla de sesiones. Eso
 * no es pereza, es la propiedad más valiosa de todo esto — la autenticación no
 * puede escribir ni un byte en la base del cliente, que es la única copia que
 * existe de su contabilidad. Un fallo aquí puede dejarle fuera; no puede
 * corromperle los datos.
 *
 * Lo que se pierde a cambio es poder cerrar una sesión concreta desde el
 * servidor. Para eso está el interruptor general: la clave con la que se firma
 * NO es `SESION_SECRETO` a secas, sino algo derivado de los tres valores
 * juntos. Cambiar cualquiera de ellos en Vercel invalida en el acto todas las
 * cookies emitidas — es el botón de emergencia si él pierde el móvil, y de
 * paso hace que cambiar la contraseña cierre las sesiones abiertas sin que
 * haya que acordarse de nada.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Nombre de la cookie.
 *
 * Se dejó a propósito sin el prefijo `__Host-`, que obligaría a `Secure` y con
 * ello impediría entrar en un `next start` local por http. La comprobación de
 * que no se escapa nada sin autenticar (ver CLAUDE.md) se hace justo así.
 */
export const COOKIE = 'imperio_sesion';

/** Treinta días, deslizantes: la cuenta se reinicia cada vez que la usa. */
export const DURACION = 30 * 24 * 60 * 60 * 1000;

/**
 * Cada cuánto se vuelve a firmar la cookie.
 *
 * Renovar en cada petición sería escribir una cabecera `Set-Cookie` en cada
 * navegación para no ganar nada. Con un día basta: si la abre a diario nunca
 * ve la pantalla de entrada, y si la deja un mes caduca.
 */
export const RENOVAR_TRAS = 24 * 60 * 60 * 1000;

/** ¿Están las tres variables? Sin ellas no hay autenticación posible. */
export function configurada() {
  return Boolean(
    process.env.USUARIO && process.env.CLAVE_HASH && process.env.SESION_SECRETO,
  );
}

/**
 * La clave con la que se firma, derivada de las tres variables.
 *
 * Va por `SESION_SECRETO` y no por `CLAVE_HASH` para que una filtración del
 * hash de la contraseña no permita fabricarse una cookie válida: el hash entra
 * como ingrediente, no como secreto.
 */
function claveDeFirma() {
  return createHmac('sha256', process.env.SESION_SECRETO || '')
    .update(`${process.env.USUARIO || ''}\n${process.env.CLAVE_HASH || ''}`)
    .digest();
}

/** Emite el testigo de sesión. `expira` en milisegundos desde la época. */
export function firmarSesion(expira = Date.now() + DURACION) {
  const cuerpo = Buffer.from(JSON.stringify({ e: expira })).toString('base64url');
  const firma = createHmac('sha256', claveDeFirma()).update(cuerpo).digest('base64url');
  return `${cuerpo}.${firma}`;
}

/**
 * Comprueba el testigo. Devuelve `{ expira }` o null si no vale por lo que sea
 * —firma mala, caducado, ilegible, o firmado con otras variables—.
 *
 * El orden importa: primero se comprueba la firma y sólo después se interpreta
 * el contenido. Al revés estaríamos pasando por `JSON.parse` algo que todavía
 * no sabemos de quién viene.
 */
export function leerSesion(testigo) {
  if (!testigo || !configurada()) return null;

  const punto = testigo.indexOf('.');
  if (punto < 1) return null;
  const cuerpo = testigo.slice(0, punto);
  const firma = testigo.slice(punto + 1);

  const esperada = createHmac('sha256', claveDeFirma()).update(cuerpo).digest();
  const recibida = Buffer.from(firma, 'base64url');
  // `timingSafeEqual` exige el mismo largo, así que hay que mirarlo antes.
  if (recibida.length !== esperada.length) return null;
  if (!timingSafeEqual(recibida, esperada)) return null;

  let datos;
  try {
    datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const expira = Number(datos?.e);
  if (!Number.isFinite(expira) || expira <= Date.now()) return null;
  return { expira };
}

/** ¿Lleva más de un día firmada? Entonces toca refrescarla. */
export function tocaRenovar(sesion) {
  if (!sesion) return false;
  return DURACION - (sesion.expira - Date.now()) >= RENOVAR_TRAS;
}

/**
 * ¿Vino la petición por https? De aquí sale el `Secure` de la cookie.
 *
 * Sale del protocolo de la petición y NO de `NODE_ENV`. En Vercel
 * siempre llega `x-forwarded-proto: https`, así que allí sale puesto; pero un
 * `next build && next start` en local va por http, y con `Secure` el navegador
 * tira la cookie sin decir ni pío. Se ve como «entro y me devuelve otra vez a
 * la pantalla de entrar», que es de las cosas más desagradables de
 * diagnosticar. Con `NODE_ENV` de respaldo pasaría exactamente eso, porque
 * `next start` en local ya es producción.
 *
 * Sin cabecera y sin protocolo que mirar se asume http, que es el único caso en
 * que eso pasa: nadie por delante haciendo de proxy, o sea localhost.
 */
export function esHttps(cabeceras, protocoloDeRespaldo = '') {
  const reenviado = (cabeceras.get('x-forwarded-proto') || '').split(',')[0].trim();
  return (reenviado || protocoloDeRespaldo).replace(':', '') === 'https';
}

/** Atributos de la cookie. `https` sale de `esHttps()`. */
export function opcionesCookie(https) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(https),
    path: '/',
    maxAge: Math.floor(DURACION / 1000),
  };
}
