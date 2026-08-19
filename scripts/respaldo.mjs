/**
 * Copia de seguridad de la base, en SQL, tal cual está ahora mismo.
 *
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run respaldo
 *   npm run respaldo                              → la base local de desarrollo
 *
 * **Sólo lee.** No hay un solo INSERT, UPDATE ni ALTER en este archivo: lo
 * único que escribe es un archivo en `.datos/`, que está fuera de git. Se puede
 * ejecutar contra la base del cliente sin miedo, y hay que ejecutarlo antes de
 * cualquier `npm run esquema` que vaya a producción — el respaldo de `.datos/`
 * es lo único que hay si algo sale mal.
 *
 * El formato es el mismo que suelta `sqlite3 .dump`, así que para recuperar
 * basta con `sqlite3 nueva.db < el-archivo.sql`.
 *
 * La fecha del nombre se pasa por fuera y no se saca del reloj del proceso: en
 * Vercel eso sería UTC y aquí Madrid, y entre las 00:00 y las 02:00 no
 * coinciden. Aquí corre siempre a mano y en local, pero la regla de la casa es
 * la misma en todas partes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarEntorno } from './entorno.mjs';

cargarEntorno();

const { consultar, urlBase } = await import('../src/lib/db.js');

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = path.join(raiz, '.datos');
fs.mkdirSync(carpeta, { recursive: true });

const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const destino = process.argv[2] || path.join(carpeta, `respaldo-${hoy}.sql`);

// No se pisa un respaldo que ya exista. Perder el de ayer por relanzar esto
// sería exactamente el fallo del que el respaldo tenía que protegernos.
if (fs.existsSync(destino)) {
  console.error(`Ya existe ${path.relative(raiz, destino)}. Muévelo o dale otro nombre:`);
  console.error('  npm run respaldo -- .datos/otro-nombre.sql');
  process.exit(1);
}

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
fs.writeFileSync(destino, `${partes.join('\n')}\n`);

const tam = (fs.statSync(destino).size / 1024).toFixed(0);
console.log(`Respaldo de ${urlBase()}`);
console.log(`  → ${path.relative(raiz, destino)}  (${tam} kB, ${filasTotales} filas)`);
console.log(`  ${resumen.join(' · ')}`);
console.log('\nPara recuperar:  sqlite3 nueva.db < '
  + `${path.relative(raiz, destino)}`);
