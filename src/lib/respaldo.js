/**
 * La base entera como texto SQL, tal cual está ahora mismo.
 *
 * Lo usan `scripts/respaldo.mjs` (que lo deja en `.datos/`) y la ruta
 * `api/respaldo` (que lo manda por correo cada semana). Vive aquí para que los
 * dos saquen exactamente el mismo archivo: dos volcados escritos por separado
 * acaban discrepando, y eso sólo se nota el día que hay que restaurar.
 *
 * **Sólo lee.** No hay un solo INSERT, UPDATE ni ALTER que se ejecute: los que
 * aparecen son texto del archivo que se devuelve.
 *
 * El formato es el mismo que suelta `sqlite3 .dump`, así que para recuperar
 * basta con `sqlite3 nueva.db < el-archivo.sql`.
 */

import { consultar } from './db.js';

/** Un valor de SQLite, escrito como literal SQL. */
function literal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return String(v);
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    return `X'${Buffer.from(v).toString('hex')}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * La fecha de hoy para el nombre del archivo. Lleva `Europe/Madrid` escrito, no
 * el huso del proceso: entre las 00:00 y las 02:00 el reloj en UTC va un día
 * por detrás, y un respaldo con la fecha de ayer en el nombre es justo el que
 * se confunde con el de ayer de verdad.
 */
export function fechaRespaldo() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}

/**
 * @returns {Promise<{ sql: string, filas: number, resumen: string[] }>}
 *   el volcado, cuántas filas lleva y el recuento por tabla.
 */
export async function volcar() {
  const objetos = await consultar(
    `SELECT type, name, sql FROM sqlite_master
      WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
      ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name`);

  const partes = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;'];
  let filasTotales = 0;
  const resumen = [];

  for (const o of objetos) {
    partes.push(`${o.sql};`);

    if (o.type !== 'table') continue;

    // Las columnas GENERADAS no se copian, y esto no es un detalle: `margen` lo
    // es, así que un `SELECT *` la trae y el INSERT de vuelta revienta con
    // «cannot INSERT into generated column». El resultado sería un respaldo que
    // se restaura sin UN SOLO SERVICIO y que sólo lo canta al restaurarlo, o sea
    // el día que ya da igual. `table_xinfo` las marca con hidden 2 (VIRTUAL) o 3
    // (STORED); `table_info` ni las enseña.
    const columnas = await consultar(`SELECT name, hidden FROM pragma_table_xinfo('${o.name}')`);
    const guardables = columnas
      .filter((c) => Number(c.hidden) !== 2 && Number(c.hidden) !== 3)
      .map((c) => c.name);

    const entrecomilladas = guardables.map((c) => `"${c}"`).join(',');
    const filas = await consultar(`SELECT ${entrecomilladas} FROM "${o.name}"`);
    filasTotales += filas.length;
    resumen.push(`${o.name}: ${filas.length}`);

    for (const f of filas) {
      const valores = guardables.map((c) => literal(f[c])).join(',');
      partes.push(`INSERT INTO "${o.name}" (${entrecomilladas}) VALUES (${valores});`);
    }
  }

  partes.push('COMMIT;');
  return { sql: `${partes.join('\n')}\n`, filas: filasTotales, resumen };
}
