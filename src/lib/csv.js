/**
 * Exportación a CSV que su Excel abra bien a la primera.
 *
 * Esto no es teórico: el CSV que él mismo exportó desde Excel llegaba en
 * cp1252 —con «AÑO» convertido en «A?O» y el símbolo del euro roto—, con los
 * importes como texto («150,00 €») y con 83,333 recortado a 83,33. Cada una de
 * las decisiones de aquí evita uno de esos destrozos:
 *
 *  · UTF-8 con BOM. Sin el BOM, Excel en Windows asume la codificación del
 *    sistema y se come los acentos y las eñes.
 *
 *  · Separador punto y coma. En un Windows en español la coma es el separador
 *    decimal, así que un CSV separado por comas se abre todo en una columna.
 *
 *  · Los números van con coma decimal y sin símbolo de moneda ni separador de
 *    millares: así Excel los reconoce como números y se pueden sumar. Un
 *    «1.234,50 €» llega como texto y no suma.
 *
 *  · Fin de línea CRLF, que es lo que dice el RFC 4180 y lo que Excel espera.
 */

const SEPARADOR = ';';
const BOM = '﻿';

/** Escapa un valor: comillas dobles si lleva separador, comillas o salto. */
function celda(valor) {
  if (valor == null) return '';

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return '';
    // Coma decimal, sin miles. Hasta tres decimales porque el libro los tiene
    // (83,333 €) y redondear aquí cambiaría sus totales.
    return String(Math.round(valor * 1000) / 1000).replace('.', ',');
  }

  const t = String(valor);
  if (t.includes(SEPARADOR) || t.includes('"') || /[\r\n]/.test(t)) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}

/**
 * Convierte filas en CSV.
 *
 * @param {Array<object>} filas
 * @param {Array<{campo: string, titulo: string}>} columnas
 */
export function aCSV(filas, columnas) {
  const lineas = [columnas.map((c) => celda(c.titulo)).join(SEPARADOR)];
  for (const fila of filas) {
    lineas.push(columnas.map((c) => celda(fila[c.campo])).join(SEPARADOR));
  }
  return BOM + lineas.join('\r\n') + '\r\n';
}

/** Respuesta de descarga con el nombre de archivo ya puesto. */
export function respuestaCSV(texto, nombre) {
  return new Response(texto, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  });
}
