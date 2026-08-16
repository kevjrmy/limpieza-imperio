/** Formato español para todo lo que se enseña en pantalla. */

// `useGrouping: 'always'` porque el español omite el punto en los millares de
// cuatro cifras (6288 en vez de 6.288). En una columna de importes eso rompe la
// alineación visual justo donde más se nota.
const EUROS = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
  useGrouping: 'always',
});

const NUMERO = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 0, maximumFractionDigits: 2,
});

const ENTERO = new Intl.NumberFormat('es-ES');

export const euros = (n) => EUROS.format(Number(n) || 0);
export const numero = (n) => NUMERO.format(Number(n) || 0);
export const entero = (n) => ENTERO.format(Number(n) || 0);

/** Porcentaje con un decimal; devuelve '—' cuando no hay base sobre la que calcular. */
export function porcentaje(parte, total) {
  if (!total) return '—';
  return `${((parte / total) * 100).toLocaleString('es-ES', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  })} %`;
}

/** '2026-05-14' → '14/05/2026'. Sin objetos Date: no hay zonas horarias de por medio. */
export function fecha(iso) {
  const [a, m, d] = String(iso ?? '').split('-');
  return a && m && d ? `${d}/${m}/${a}` : String(iso ?? '');
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * '2026-05' → 'mayo 2026'.
 *
 * Vive aquí y no junto a las consultas porque lo usan también componentes de
 * cliente, y `consultas.js` arrastra el módulo de sesión, que es sólo de
 * servidor. Importarlo desde el navegador rompía la compilación.
 */
export function nombrePeriodo(periodo) {
  const [a, m] = String(periodo ?? '').split('-');
  return `${MESES_ES[Number(m) - 1] ?? m} ${a}`;
}
