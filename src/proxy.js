/**
 * Proxy (lo que hasta Next 15 se llamaba middleware).
 *
 * Su único trabajo es dejar la sesión de Clerk disponible para el resto de la
 * aplicación. Aquí NO se decide quién entra: eso se comprueba en cada recurso
 * que toca datos —el layout, cada acción de servidor, cada descarga— mediante
 * `exigirSesion()`. Filtrar por patrones de ruta aquí es frágil: el patrón y la
 * forma en que Next resuelve la petición pueden no coincidir, y un desajuste
 * deja accesible algo que se creía protegido.
 *
 * No importa nada de `lib/`: el proxy se despliega aparte del código de render
 * y no debe depender de módulos compartidos.
 */

import { NextResponse } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

const clerkConfigurado = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export const proxy = clerkConfigurado ? clerkMiddleware() : () => NextResponse.next();

export const config = {
  matcher: [
    // Todo menos los internos de Next y los archivos estáticos.
    '/((?!_next|favicon.ico|.*\\.(?:css|js|png|jpg|jpeg|svg|ico|woff2?)$).*)',
    '/(api|trpc)(.*)',
  ],
};
