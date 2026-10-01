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
 * La fecha del nombre lleva `Europe/Madrid` escrito, no el huso del proceso;
 * ver `fechaRespaldo()` en `src/lib/respaldo.js`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cargarEntorno } from './entorno.mjs';

cargarEntorno();

const { urlBase } = await import('../src/lib/db.js');
const { volcar, fechaRespaldo } = await import('../src/lib/respaldo.js');

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = path.join(raiz, '.datos');
fs.mkdirSync(carpeta, { recursive: true });

const destino = process.argv[2] || path.join(carpeta, `respaldo-${fechaRespaldo()}.sql`);

// No se pisa un respaldo que ya exista. Perder el de ayer por relanzar esto
// sería exactamente el fallo del que el respaldo tenía que protegernos.
if (fs.existsSync(destino)) {
  console.error(`Ya existe ${path.relative(raiz, destino)}. Muévelo o dale otro nombre:`);
  console.error('  npm run respaldo -- .datos/otro-nombre.sql');
  process.exit(1);
}

// El volcado en sí vive en `src/lib/respaldo.js`, que es también lo que manda
// el correo semanal: los dos sacan el mismo archivo.
const { sql, filas: filasTotales, resumen } = await volcar();
fs.writeFileSync(destino, sql);

const tam = (fs.statSync(destino).size / 1024).toFixed(0);
console.log(`Respaldo de ${urlBase()}`);
console.log(`  → ${path.relative(raiz, destino)}  (${tam} kB, ${filasTotales} filas)`);
console.log(`  ${resumen.join(' · ')}`);
console.log('\nPara recuperar:  sqlite3 nueva.db < '
  + `${path.relative(raiz, destino)}`);
