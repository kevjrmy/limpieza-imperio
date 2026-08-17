'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';

/**
 * Clerk, hablando español.
 *
 * Esto es un componente de cliente **a propósito**, y no por capricho: si el
 * `localization` se le pasa a `ClerkProvider` desde el layout —que es de
 * servidor—, el diccionario entero viaja serializado en la carga RSC de cada
 * página. Se midió: las rutas pasaron de ~7,8 kB a ~87 kB, once veces más, en
 * todas, no sólo en la de entrar. Importándolo aquí viaja una vez como fragmento
 * de JavaScript y el navegador lo cachea.
 *
 * El remiendo de `titleCombined`: esa clave no está traducida en
 * @clerk/localizations y es justo el titular más grande de la pantalla de
 * entrada, así que Clerk caía al inglés ahí.
 */
const ESPANOL = {
  ...esES,
  signIn: {
    ...esES.signIn,
    start: { ...esES.signIn.start, titleCombined: 'Entrar en {{applicationName}}' },
  },
};

export default function ProveedorClerk({ children }) {
  return <ClerkProvider localization={ESPANOL}>{children}</ClerkProvider>;
}
