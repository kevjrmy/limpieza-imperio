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

/**
 * Número visible de un cliente o de un colaborador: 47 → '#047'.
 *
 * Sale del `id`, no de la columna `ref`. `ref` guarda el código del libro
 * modelo (CLI-001) y **sólo la rellena el sembrador**: todo lo que él da de
 * alta desde la aplicación la tiene vacía, que es precisamente la gente más
 * reciente y la más fácil de confundir. El `id` nunca falta, no cambia nunca y
 * ya es lo que va en la dirección de la ficha, así que «#047» y
 * `/clientes/47` son lo mismo y se pueden leer el uno del otro.
 *
 * Esto NO evita que se creen duplicados —dos fichas de la misma persona
 * tendrían dos números—: sirve para poder señalar a una en concreto cuando hay
 * varias que se llaman parecido.
 */
export const codigo = (id) => `#${String(Number(id) || 0).padStart(3, '0')}`;

/**
 * ¿Está buscando por número? Sólo si escribe dígitos y nada más, con o sin
 * almohadilla: '47', '#47', '047'. Así «3» no se lleva por delante a todos los
 * que tienen un 3 en el nombre, que sería un buscador inservible.
 */
export function idBuscado(busqueda) {
  const t = String(busqueda ?? '').trim().replace(/^#/, '');
  return /^\d+$/.test(t) ? Number(t) : null;
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

/** '2026-12' → '2027-01'. Sin objetos Date, que aquí sólo traen problemas. */
export function siguienteMes(periodo) {
  const [a, m] = String(periodo ?? '').split('-').map(Number);
  if (!a || !m) return '';
  const total = a * 12 + (m - 1) + 1;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
