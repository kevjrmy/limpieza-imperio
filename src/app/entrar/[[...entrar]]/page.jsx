import { Suspense } from 'react';

import Entrada from '../../../componentes/Entrada.jsx';
import { clerkConfigurado } from '../../../lib/sesion.js';

export const metadata = { title: 'Entrar · Limpiezas El Imperio' };

/**
 * Esta pantalla cuelga del layout raíz y NO del grupo `(panel)`: el layout de
 * `(panel)` llama a `exigirSesion()`, que es justo quien manda aquí, y colgarla
 * de ahí la mandaría a sí misma en bucle.
 *
 * El formulario va en un componente de cliente (`Entrada`) porque necesita
 * saber si el navegador cree tener sesión para poder romper el otro bucle, el
 * de Clerk devolviendo el rebote. Lleva `Suspense` porque lee la URL con
 * `useSearchParams`.
 */
export default function Entrar() {
  if (!clerkConfigurado) {
    return (
      <section className="entrar">
        <h1>Entrar</h1>
        <p>Esta copia corre sin autenticación. No hay nada que introducir.</p>
      </section>
    );
  }

  return (
    <Suspense fallback={<section className="entrar" />}>
      <Entrada />
    </Suspense>
  );
}
