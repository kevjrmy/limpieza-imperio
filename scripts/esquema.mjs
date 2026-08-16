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

for (const s of sentencias) await db().execute(s);

console.log(`Esquema aplicado sobre ${url} — ${sentencias.length} sentencias.`);
