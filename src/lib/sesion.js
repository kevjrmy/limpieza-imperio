import { auth, currentUser } from '@clerk/nextjs/server';

/**
 * Quién puede entrar.
 *
 * La aplicación tiene un único usuario. No hay registro, no hay invitaciones y
 * no hay roles: sólo hay que responder a una pregunta, ¿es él?
 *
 * La comprobación se hace en cada recurso que toca datos —el layout que envuelve
 * todas las páginas, cada acción de servidor y cada ruta de descarga— y no sólo
 * en el proxy. Es lo que recomienda el propio Clerk desde la v7, y por un motivo
 * concreto: filtrar por patrones de ruta en el proxy no siempre coincide con
 * cómo Next resuelve las peticiones, y basta un desajuste para dejar accesible
 * algo que se creía protegido.
 *
 * Dos comportamientos deliberados:
 *
 *  · Sin Clerk configurado y en producción, la aplicación NO se sirve. Esto es
 *    contabilidad real con nombres, direcciones y teléfonos: quedarse abierta
 *    al mundo por un despiste de variables de entorno no es una opción.
 *
 *  · Sin Clerk configurado en local, se pasa sin autenticar para poder
 *    trabajar, pero la interfaz lo anuncia con una banda imposible de no ver.
 *    La regla de la casa: avisar, nunca disimular.
 */

export const clerkConfigurado = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export const enProduccion = process.env.NODE_ENV === 'production';

/**
 * Correo autorizado. El registro se cierra desde el panel de Clerk, pero esto
 * es el cinturón además de los tirantes: aunque alguien lograra crearse una
 * cuenta, sin este correo no entra.
 */
export const correoAutorizado = (process.env.CORREO_AUTORIZADO || '').toLowerCase().trim();

/** Mensaje de por qué no se puede servir, o null si todo está en orden. */
export function motivoBloqueo() {
  if (clerkConfigurado) return null;
  if (enProduccion) {
    return 'La autenticación no está configurada. La aplicación no se sirve sin ella '
      + 'porque contiene datos reales de clientes. Faltan CLERK_SECRET_KEY y '
      + 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.';
  }
  return null;
}

class SinPermiso extends Error {}

/**
 * Exige sesión válida. Se llama desde todo lo que lee o escribe datos.
 *
 * @returns {Promise<{userId: string|null, correo: string|null}>}
 * @throws  si hay sesión pero no es la persona autorizada
 */
export async function exigirSesion() {
  if (!clerkConfigurado) {
    // En producción no se llega hasta aquí: el layout ya ha cortado.
    if (enProduccion) throw new SinPermiso('Autenticación no configurada.');
    return { userId: null, correo: null, sinAutenticar: true };
  }

  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  if (!correoAutorizado) return { userId, correo: null };

  const usuario = await currentUser();
  const correos = (usuario?.emailAddresses ?? []).map((c) => c.emailAddress.toLowerCase());
  if (!correos.includes(correoAutorizado)) {
    throw new SinPermiso('Esta cuenta no tiene acceso a la contabilidad de Limpiezas El Imperio.');
  }

  return { userId, correo: correoAutorizado };
}
