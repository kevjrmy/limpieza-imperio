import { ClerkProvider } from '@clerk/nextjs';

import '../estilos.css';
import Navegacion from '../componentes/Navegacion.jsx';
import { clerkConfigurado, motivoBloqueo, exigirSesion } from '../lib/sesion.js';
import { pendientes } from '../lib/consultas.js';

export const metadata = {
  title: 'Limpiezas El Imperio',
  description: 'Contabilidad de Limpiezas El Imperio',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

/** Pantalla de parada cuando falta la autenticación en producción. */
function Bloqueado({ motivo }) {
  return (
    <html lang="es">
      <body>
        <main className="bloqueo">
          <h1>No se puede servir la aplicación</h1>
          <p>{motivo}</p>
        </main>
      </body>
    </html>
  );
}

async function Estructura({ children }) {
  // Toda página pasa por aquí, así que aquí se comprueba la sesión. Las
  // acciones de servidor y las descargas la comprueban por su cuenta: no pasan
  // por el layout.
  await exigirSesion();

  // El menú lleva el contador de cosas pendientes de revisar. Si la base aún no
  // está sembrada, la consulta falla y el menú se enseña sin contadores: no
  // vale la pena tirar la página entera por un número.
  let cuenta = null;
  try {
    cuenta = await pendientes();
  } catch {
    cuenta = null;
  }

  return (
    <html lang="es">
      <body>
        {!clerkConfigurado && (
          <p className="aviso-sin-auth" role="alert">
            Sin autenticación: esta copia no pide contraseña. Sólo para desarrollo en local.
          </p>
        )}
        <Navegacion pendientes={cuenta} conSesion={clerkConfigurado} />
        <main className="contenido">{children}</main>
      </body>
    </html>
  );
}

export default function RootLayout({ children }) {
  const motivo = motivoBloqueo();
  if (motivo) return <Bloqueado motivo={motivo} />;

  if (!clerkConfigurado) return <Estructura>{children}</Estructura>;

  return (
    <ClerkProvider>
      <Estructura>{children}</Estructura>
    </ClerkProvider>
  );
}
