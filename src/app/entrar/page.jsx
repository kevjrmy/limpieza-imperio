import { redirect } from 'next/navigation';

import Entrada from '../../componentes/Entrada.jsx';
import { autenticacionConfigurada, haySesion } from '../../lib/sesion.js';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Entrar · Limpiezas El Imperio' };

/**
 * Esta pantalla cuelga del layout raíz y NO del grupo `(panel)`: el layout de
 * `(panel)` llama a `exigirSesion()`, que es justo quien manda aquí, y colgarla
 * de ahí la mandaría a sí misma en bucle.
 *
 * Con Clerk esto era una ruta comodín (`[[...entrar]]`) porque su componente
 * montaba varias pantallas debajo de la misma URL. Ya no: sólo hay un
 * formulario y una URL.
 */
export default async function Entrar({ searchParams }) {
  if (!autenticacionConfigurada()) {
    return (
      <main className="bloqueo">
        <h1>Entrar</h1>
        <p>Esta copia corre sin autenticación. No hay nada que introducir.</p>
      </main>
    );
  }

  const p = await searchParams;
  const volver = typeof p?.volver === 'string' ? p.volver : '';
  const destino = volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';

  // Con sesión abierta esta pantalla no pinta nada: se sigue camino. La
  // comprobación es la misma que usa `exigirSesion()`, así que las dos no
  // pueden contradecirse y mandarse la una a la otra.
  if (await haySesion()) redirect(destino);

  return <Entrada volver={volver} />;
}
