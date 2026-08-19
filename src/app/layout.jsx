import '../estilos.css';
import { motivoBloqueo } from '../lib/sesion.js';

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
 * cuelga de este layout, y exigirle sesión la mandaría a sí misma en un bucle
 * de redirecciones. Quien exige sesión es el layout de `(panel)`, que envuelve
 * todo lo demás — y, por debajo, cada consulta y cada acción.
 *
 * Lo que sí se corta aquí es servir nada en absoluto si la autenticación no
 * está montada y esto es producción. Es la última línea antes de dejar la
 * contabilidad de un negocio abierta a internet por una variable mal puesta.
 */
export default function RootLayout({ children }) {
  const motivo = motivoBloqueo();

  return (
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
}
