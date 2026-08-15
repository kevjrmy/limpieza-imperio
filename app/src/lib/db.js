/**
 * Cliente del worker de SQLite.
 *
 * Envuelve el paso de mensajes en promesas para que el resto de la aplicación
 * no sepa que hay un worker por medio.
 */

let worker = null;
let siguienteId = 1;
const pendientes = new Map();

/** Estado del almacenamiento, para poder decírselo al usuario sin mentir. */
export const estadoAlmacenamiento = {
  modo: 'desconocido',   // 'opfs' | 'memoria'
  aislado: false,
  version: null,
  error: null,
};

function arrancar() {
  if (worker) return worker;
  worker = new Worker(new URL('./sqlite.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (ev) => {
    const { id, ok, resultado, error } = ev.data || {};
    const p = pendientes.get(id);
    if (!p) return;
    pendientes.delete(id);
    ok ? p.resolver(resultado) : p.rechazar(new Error(error));
  };
  worker.onerror = (e) => {
    for (const p of pendientes.values()) p.rechazar(new Error(e.message || 'Fallo en el worker de SQLite'));
    pendientes.clear();
  };
  return worker;
}

function pedir(tipo, carga) {
  const w = arrancar();
  const id = siguienteId++;
  return new Promise((resolver, rechazar) => {
    pendientes.set(id, { resolver, rechazar });
    w.postMessage({ id, tipo, carga });
  });
}

/**
 * Abre la base. Devuelve el modo de almacenamiento real, que la interfaz
 * enseña: si no hay aislamiento entre orígenes no hay OPFS, y perder la
 * importación al recargar sin avisar sería lo peor que podría hacer.
 */
export async function abrirBase() {
  try {
    const info = await pedir('abrir');
    Object.assign(estadoAlmacenamiento, info, { error: null });
  } catch (e) {
    Object.assign(estadoAlmacenamiento, { modo: 'no disponible', error: String(e.message ?? e) });
    throw e;
  }
  return estadoAlmacenamiento;
}

export const guardarImportacion = (datos) => pedir('guardar', datos);
export const consultar = (sql, params) => pedir('consultar', { sql, params });
export const limpiarBase = () => pedir('limpiar');
