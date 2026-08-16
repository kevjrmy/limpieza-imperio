/**
 * Normalización de texto.
 *
 * Todo el libro está escrito a mano durante dos años: hay acentos puestos y
 * quitados, mayúsculas mezcladas, espacios dobles y espacios finales. Cualquier
 * comparación entre cadenas pasa antes por `clave()`.
 */

/** Quita los diacríticos (Ñ → N, Ó → O) descomponiendo en NFD. */
export function sinAcentos(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Clave canónica de comparación: sin acentos, mayúsculas, espacios colapsados.
 * Es la única forma en que dos cadenas se consideran "la misma" sin intervención
 * humana.
 */
export function clave(s) {
  return sinAcentos(s)
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Igual que `clave` pero además retira signos de puntuación sueltos. */
export function claveDura(s) {
  return clave(s)
    .replace(/[.,;:_'"()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte a número tolerando lo que se escribe a mano en una celda:
 * "55 €", "1.234,50", "  60 ", null, "" o un número ya limpio.
 * Devuelve 0 cuando no hay nada interpretable — nunca NaN.
 */
export function aNumero(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;

  let t = String(v).trim();
  if (!t) return 0;

  t = t.replace(/[€$\s]/g, '');

  // "1.234,50" (formato español) vs "1234.50"
  if (t.includes(',') && t.includes('.')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (t.includes(',')) {
    t = t.replace(',', '.');
  }

  t = t.replace(/[^0-9.\-]/g, '');
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Presenta un nombre en Mayúsculas De Título, respetando partículas. */
export function comoTitulo(s) {
  const menores = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'DA', 'DO']);
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => {
      const alta = p.toUpperCase();
      if (i > 0 && menores.has(alta)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' ');
}
