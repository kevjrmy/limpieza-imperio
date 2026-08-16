import { SignIn } from '@clerk/nextjs';

import { clerkConfigurado } from '../../../lib/sesion.js';

export const metadata = { title: 'Entrar · Limpiezas El Imperio' };

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
    <section className="entrar">
      <SignIn />
    </section>
  );
}
