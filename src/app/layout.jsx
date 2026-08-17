import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';

import '../estilos.css';
import { clerkConfigurado, motivoBloqueo } from '../lib/sesion.js';

export const metadata = {
  title: 'Limpiezas El Imperio',
  description: 'Contabilidad de Limpiezas El Imperio',
};

/**
 * El castellano de Clerk, con un hueco tapado.
 *
 * `signIn.start.titleCombined` no está traducido en @clerk/localizations, así
 * que Clerk cae al inglés justo en el titular más grande de la pantalla de
 * entrada: «Continue to …». Lo demás del paquete sí viene traducido.
 */
const ESPANOL = {
  ...esES,
  signIn: {
    ...esES.signIn,
    start: { ...esES.signIn.start, titleCombined: 'Entrar en {{applicationName}}' },
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * Layout raíz: sólo la página en bruto.
 *
 * Aquí NO se comprueba la sesión, y es a propósito: la pantalla de entrada
 * cuelga de este layout, y exigirle sesión la mandaba a sí misma en un bucle de
 * redirecciones. Quien exige sesión es el layout de `(panel)`, que envuelve
 * todo lo demás — y, por debajo, cada consulta y cada acción.
 */
export default function RootLayout({ children }) {
  const motivo = motivoBloqueo();

  const pagina = (
    <html lang="es">
      <body>
        {motivo ? (
          <main className="bloqueo">
            <h1>No se puede servir la aplicación</h1>
            <p>{motivo}</p>
          </main>
        ) : children}
      </body>
    </html>
  );

  if (!clerkConfigurado) return pagina;

  // La pantalla de entrada la pinta Clerk, no nosotros, y venía en inglés:
  // «Email address», «Password», «Continue». Es la primera pantalla que ve él
  // cada día y la única de toda la aplicación que no estaba en español.
  return <ClerkProvider localization={ESPANOL}>{pagina}</ClerkProvider>;
}
