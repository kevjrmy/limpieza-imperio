/**
 * Ayudas de presentación compartidas por las pantallas.
 *
 * El color sólo se usa para dos cosas —el margen y lo que hay que revisar—, así
 * que decidir el tono de una cifra es una regla y no un adorno: vive aquí para
 * que sea la misma en todas las tablas.
 */

/** Clase de color para un importe: verde si deja, rojo si cuesta, nada si es cero. */
export function tonoDinero(n) {
  const v = Number(n) || 0;
  if (v > 0) return 'dinero--margen';
  if (v < 0) return 'dinero--perdida';
  return '';
}

/** Mes actual en formato '2026-08', para valores por defecto de formulario. */
export function periodoDeHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Hoy en formato '2026-08-16'. */
export function fechaDeHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
