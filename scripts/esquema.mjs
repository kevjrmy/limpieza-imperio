/**
 * Aplica el esquema a la base que apunte el entorno.
 *
 *   npm run esquema            → archivo local .datos/limpiezas.db
 *   TURSO_DATABASE_URL=… …     → la base de Turso
 *
 * Es idempotente: todo es CREATE TABLE IF NOT EXISTS, así que se puede volver a
 * pasar sin miedo. No borra nada.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarEntorno } from './entorno.mjs';

cargarEntorno();

const { db, urlBase } = await import('../src/lib/db.js');

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sql = fs.readFileSync(path.join(raiz, 'src/lib/esquema.sql'), 'utf8');

// El archivo local necesita que exista su carpeta antes de abrirlo.
const url = urlBase();
if (url.startsWith('file:')) {
  fs.mkdirSync(path.join(raiz, path.dirname(url.slice(5))), { recursive: true });
}

// Se parte por sentencia: `execute` acepta una cada vez.
const sentencias = sql
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s && !s.split('\n').every((l) => l.trim().startsWith('--')));

/**
 * Columnas añadidas después de que la base ya estuviera en producción.
 *
 * `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe, así que una
 * columna nueva no llega nunca a una base sembrada. Esto la añade si falta y no
 * hace nada si ya está.
 */
const COLUMNAS_NUEVAS = [
  { tabla: 'servicios', columna: 'borrador', definicion: 'INTEGER NOT NULL DEFAULT 0' },
  {
    tabla: 'clientes',
    columna: 'colaborador_id',
    definicion: 'INTEGER REFERENCES colaboradores(id) ON DELETE SET NULL',
  },
  { tabla: 'colaboradores', columna: 'direccion', definicion: "TEXT NOT NULL DEFAULT ''" },
  { tabla: 'colaboradores', columna: 'barrio', definicion: "TEXT NOT NULL DEFAULT ''" },
  { tabla: 'colaboradores', columna: 'provincia', definicion: "TEXT NOT NULL DEFAULT ''" },
  { tabla: 'clientes', columna: 'codigo_postal', definicion: "TEXT NOT NULL DEFAULT ''" },
  { tabla: 'clientes', columna: 'provincia', definicion: "TEXT NOT NULL DEFAULT ''" },
];

// El orden importa: las vistas se definen sobre columnas que quizá aún no
// existen en una base antigua, así que van después de las migraciones. Las
// tablas van antes, porque no se puede migrar lo que todavía no está.
// Cada sentencia arrastra sus comentarios delante, así que hay que quitarlos
// antes de mirar con qué empieza.
const sinComentarios = (s) => s.split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join('\n')
  .trim();

// Los índices y las vistas pueden apuntar a columnas que en una base antigua
// todavía no existen, así que van después de las migraciones. Las tablas van
// antes, porque no se puede migrar lo que aún no está.
const esDerivado = (s) => /^CREATE\s+(VIEW|INDEX|UNIQUE\s+INDEX)/i.test(sinComentarios(s));
const tablas = sentencias.filter((s) => !esDerivado(s));
const derivados = sentencias.filter(esDerivado);

for (const s of tablas) await db().execute(s);

let añadidas = 0;
for (const { tabla, columna, definicion } of COLUMNAS_NUEVAS) {
  const { rows } = await db().execute(`PRAGMA table_info(${tabla})`);
  if (!rows.length) continue;                       // la tabla aún no existe
  if (rows.some((f) => f.name === columna)) continue;
  await db().execute(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  console.log(`  + ${tabla}.${columna}`);
  añadidas++;
}

// Se rehacen siempre: si una vista cambió de definición, `IF NOT EXISTS` la
// dejaría como estaba y nadie se enteraría.
for (const s of derivados) {
  const limpia = sinComentarios(s);

  // Las vistas se rehacen siempre: si una cambió de definición,
  // `IF NOT EXISTS` la dejaría como estaba y nadie se enteraría.
  const vista = limpia.match(/CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i)?.[1];
  if (vista) {
    await db().execute(`DROP VIEW IF EXISTS ${vista}`);
    await db().execute(limpia.replace(/IF\s+NOT\s+EXISTS\s+/i, ''));
  } else {
    await db().execute(limpia);
  }
}

console.log(`Esquema aplicado sobre ${url} — ${tablas.length} tablas, `
  + `${derivados.length} índices y vistas`
  + `${añadidas ? `, ${añadidas} columna(s) añadida(s)` : ''}.`);
