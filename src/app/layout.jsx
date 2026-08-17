import '../estilos.css';
import ProveedorClerk from '../componentes/ProveedorClerk.jsx';
import { clerkConfigurado, motivoBloqueo } from '../lib/sesion.js';

export const metadata = {
  title: 'Limpiezas El Imperio',
  description: 'Contabilidad de Limpiezas El Imperio',
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

  // El proveedor va aparte y es de cliente: ver `ProveedorClerk.jsx`. Traer el
  // diccionario aquí multiplicaba por once el peso de todas las páginas.
  return <ProveedorClerk>{pagina}</ProveedorClerk>;
}
