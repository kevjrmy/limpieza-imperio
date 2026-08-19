import Navegacion from '../../componentes/Navegacion.jsx';
import { autenticacionConfigurada, exigirSesion } from '../../lib/sesion.js';
import { pendientes } from '../../lib/consultas.js';

/**
 * Layout de todo lo que hay detrás del login.
 *
 * La pantalla de entrada NO cuelga de aquí, así que puede pedir la sesión sin
 * mandarse a sí misma en bucle.
 *
 * Esta comprobación es la primera de dos, no la única: cada consulta y cada
 * acción vuelven a exigir sesión por su cuenta. Next ejecuta las páginas aparte
 * del layout y serializa su resultado aunque el layout no las pinte, así que
 * quedarse sólo con esta dejaría escapar datos por la carga RSC.
 */
export default async function LayoutPanel({ children }) {
  const { usuario } = await exigirSesion();

  // El menú lleva el contador de cosas pendientes. Si la base aún no está
  // sembrada la consulta falla y el menú sale sin contadores: no vale la pena
  // tirar la página entera por un número.
  let cuenta = null;
  try {
    cuenta = await pendientes();
  } catch (e) {
    // Una redirección de Next viaja como excepción: si se traga aquí, el
    // usuario se queda en una página a medias en lugar de ir al login.
    if (typeof e?.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT')) throw e;
    cuenta = null;
  }

  return (
    <>
      {!autenticacionConfigurada() && (
        <p className="aviso-sin-auth" role="alert">
          Sin autenticación: esta copia no pide contraseña. Sólo para desarrollo en local.
        </p>
      )}
      <Navegacion pendientes={cuenta} usuario={usuario} />
      <main className="contenido">{children}</main>
    </>
  );
}
