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

/**
 * Hoy en Valencia, en formato '2026-08-16'.
 *
 * El huso va escrito, no heredado. Estos valores por defecto se calculan en el
 * servidor al renderizar —Vercel corre en UTC— y de ahí salen tal cual al
 * campo: entre las 00:00 y las 02:00 de aquí, en el servidor todavía es el día
 * anterior, y el formulario proponía la fecha de ayer. La noche del día 1 eso
 * no es un día de más o de menos: el mes contable sale de la fecha, así que el
 * servicio se archivaba en el mes pasado, que ya está cerrado.
 *
 * 'sv-SE' se usa porque da el formato ISO (2026-08-16) tal cual, sin montarlo a
 * mano a partir de las partes.
 */
const DIA_ES = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function fechaDeHoy() {
  return DIA_ES.format(new Date());
}

/** Mes actual en formato '2026-08', para valores por defecto de formulario. */
export function periodoDeHoy() {
  return fechaDeHoy().slice(0, 7);
}
