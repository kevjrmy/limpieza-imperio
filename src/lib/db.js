/**
 * Acceso a la base de datos.
 *
 * Es SQLite en los dos lados: en producción Turso (libSQL) y en local un
 * archivo `.datos/limpiezas.db`. Mismo cliente, mismo dialecto, mismas
 * consultas — lo que se prueba en local es lo que corre desplegado.
 *
 * El cliente se crea perezosamente y NO se envuelve en un Proxy: Next evalúa el
 * código de módulo en tiempo de compilación, y crear el cliente ahí arriba
 * revienta el build cuando todavía no hay variables de entorno.
 */

import { createClient } from '@libsql/client';

let cliente = null;

/** URL de la base. Sin Turso configurado, cae a un archivo local. */
export function urlBase() {
  return process.env.TURSO_DATABASE_URL || 'file:.datos/limpiezas.db';
}

export function db() {
  if (!cliente) {
    cliente = createClient({
      url: urlBase(),
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return cliente;
}

/** Lee filas y las devuelve como objetos planos. */
export async function consultar(sql, args = []) {
  const { rows } = await db().execute({ sql, args });
  return rows.map((f) => ({ ...f }));
}

/** Lee una sola fila, o null. */
export async function consultarUna(sql, args = []) {
  const filas = await consultar(sql, args);
  return filas[0] ?? null;
}

/** Escribe. Devuelve filas afectadas y último id insertado. */
export async function ejecutar(sql, args = []) {
  const r = await db().execute({ sql, args });
  return { filas: r.rowsAffected, id: r.lastInsertRowid };
}

/**
 * Varias sentencias como una sola transacción.
 * @param {Array<{sql: string, args?: any[]}>} sentencias
 */
export async function enLote(sentencias) {
  return db().batch(sentencias.map((s) => ({ sql: s.sql, args: s.args ?? [] })), 'write');
}
