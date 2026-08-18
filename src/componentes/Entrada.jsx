'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignIn, SignOutButton, useAuth } from '@clerk/nextjs';

/**
 * La pantalla de entrada, con salida de emergencia.
 *
 * El caso normal es el de siempre: no hay sesión, se pinta `<SignIn />` y al
 * entrar Clerk devuelve a donde iba.
 *
 * El caso malo es un bucle, y lo vivió él: el navegador cree que tiene sesión,
 * el servidor no la ve, `exigirSesion()` manda aquí con `redirect_url=…`, Clerk
 * ve la sesión del navegador y devuelve a la página, la página vuelve a mandar
 * aquí… y así sin parar. Ninguna de las dos partes hace nada raro por separado;
 * juntas no salen nunca. Y el botón de salir vive dentro de `UserButton`, en la
 * cabecera, así que hace falta poder cargar una página para llegar a él: justo
 * lo que no se puede hacer estando dentro del bucle.
 *
 * Así que si llega aquí rebotado (`redirect_url`) Y el navegador dice tener
 * sesión, NO se pinta `<SignIn />` —que es quien devolvería el rebote— sino la
 * explicación y un botón para salir del todo. Se rompe la cadena y se sale con
 * un toque, sin borrar cookies a mano.
 *
 * La decisión se toma UNA vez, en cuanto Clerk carga, y ya no cambia: si
 * dependiera del estado en vivo, al entrar con usuario y contraseña la sesión
 * pasaría a activa, este componente cambiaría de rama y le quitaría a `<SignIn />`
 * el redirigir que es su trabajo. Se congela para no romper el caso normal.
 */
export default function Entrada() {
  const { isLoaded, isSignedIn } = useAuth();
  const parametros = useSearchParams();
  const rebotado = Boolean(parametros.get('redirect_url'));

  const [atascado, setAtascado] = useState(null);
  if (isLoaded && atascado === null) setAtascado(Boolean(isSignedIn) && rebotado);

  if (atascado) {
    // Misma maquetación que /sin-acceso: la otra pantalla que existe para que
    // nadie se quede encerrado con una sesión que no le sirve.
    return (
      <main className="bloqueo">
        <h1>Tu sesión no vale ya</h1>
        <p>
          El navegador cree que has entrado, pero el servidor no reconoce esa
          sesión, así que os estabais mandando el uno al otro sin parar.
        </p>
        <p>
          Sal del todo y vuelve a entrar: es un momento y se arregla. No se
          pierde nada de lo que hay guardado.
        </p>
        <p>
          <SignOutButton redirectUrl="/entrar">
            <button type="button" className="boton boton--principal">
              Salir y volver a entrar
            </button>
          </SignOutButton>
        </p>
      </main>
    );
  }

  return (
    <section className="entrar">
      <SignIn />
    </section>
  );
}
