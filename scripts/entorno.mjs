/**
 * Carga .env.local para los scripts de línea de comandos.
 *
 * Next lo hace solo; Node no. Sin esto, `npm run sembrar` escribiría en la base
 * local aunque Turso estuviera configurado, que es un error silencioso y caro
 * de encontrar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function cargarEntorno(archivo = '.env.local') {
  const ruta = path.join(raiz, archivo);
  if (!fs.existsSync(ruta)) return false;

  // Node 22 sabe hacerlo solo.
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(ruta);
    return true;
  }

  for (const linea of fs.readFileSync(ruta, 'utf8').split('\n')) {
    const t = linea.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const nombre = t.slice(0, i).trim();
    const valor = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(nombre in process.env)) process.env[nombre] = valor;
  }
  return true;
}
