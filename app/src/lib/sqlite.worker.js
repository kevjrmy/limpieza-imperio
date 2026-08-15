/**
 * SQLite vive aquí, en un worker.
 *
 * No es una preferencia de arquitectura: el backend OPFS de sqlite-wasm usa
 * `Atomics.wait`, que el navegador prohíbe en el hilo principal. Dentro de un
 * worker sí está permitido. De paso, insertar 900 servicios no congela la
 * interfaz.
 *
 * Protocolo: {id, tipo, carga} → {id, ok, resultado|error}
 */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

const ESQUEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clientes (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE,
  direccion     TEXT,
  telefono      TEXT
);

CREATE TABLE IF NOT EXISTS trabajadores (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS servicios (
  id            INTEGER PRIMARY KEY,
  cliente_id    INTEGER NOT NULL REFERENCES clientes(id),
  fecha         TEXT NOT NULL,           -- YYYY-MM-DD
  periodo       TEXT NOT NULL,           -- YYYY-MM
  horas         REAL NOT NULL DEFAULT 0,
  personas      REAL NOT NULL DEFAULT 0,
  valor         REAL NOT NULL DEFAULT 0, -- lo que factura al cliente
  pago_colab    REAL NOT NULL DEFAULT 0,
  transporte    REAL NOT NULL DEFAULT 0,
  gasto         REAL NOT NULL DEFAULT 0,
  -- Se guarda pero NO se usa para calcular: está escrita a mano y es
  -- inconsistente entre hojas. Sirve para poder enseñar la diferencia.
  rentabilidad_hoja REAL,
  estado        TEXT,
  colaboradores_raw TEXT,                -- la celda original, sin tocar
  -- Trazabilidad: todo número del panel vuelve a una fila de su archivo.
  origen_hoja   TEXT NOT NULL,
  origen_fila   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS servicio_trabajador (
  servicio_id    INTEGER NOT NULL REFERENCES servicios(id) ON DELETE CASCADE,
  trabajador_id  INTEGER NOT NULL REFERENCES trabajadores(id),
  -- Parte del pago que le toca. Los céntimos se reparten sin perder nada,
  -- así que SUM(pago) por servicio es exactamente servicios.pago_colab.
  pago           REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (servicio_id, trabajador_id)
);

CREATE TABLE IF NOT EXISTS avisos (
  id       INTEGER PRIMARY KEY,
  tipo     TEXT NOT NULL,
  hoja     TEXT,
  fila     INTEGER,
  cliente  TEXT,
  mensaje  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hojas (
  nombre       TEXT PRIMARY KEY,
  estado       TEXT NOT NULL,
  maquetacion  TEXT,
  motivo       TEXT,
  servicios    INTEGER NOT NULL DEFAULT 0,
  columnas_faltantes TEXT
);

CREATE INDEX IF NOT EXISTS ix_servicios_cliente ON servicios(cliente_id);
CREATE INDEX IF NOT EXISTS ix_servicios_periodo ON servicios(periodo);
CREATE INDEX IF NOT EXISTS ix_st_trabajador     ON servicio_trabajador(trabajador_id);
`;

let sqlite3 = null;
let db = null;
let almacenamiento = 'memoria';

async function abrir() {
  if (!sqlite3) sqlite3 = await sqlite3InitModule();

  // `opfs` sólo aparece si el navegador concedió el aislamiento entre orígenes.
  if ('opfs' in sqlite3) {
    try {
      db = new sqlite3.oo1.OpfsDb('/limpiezas-imperio.sqlite3');
      almacenamiento = 'opfs';
    } catch {
      db = new sqlite3.oo1.DB(':memory:', 'c');
      almacenamiento = 'memoria';
    }
  } else {
    db = new sqlite3.oo1.DB(':memory:', 'c');
    almacenamiento = 'memoria';
  }

  db.exec(ESQUEMA);
  return {
    modo: almacenamiento,
    aislado: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated,
    version: sqlite3.version?.libVersion ?? null,
  };
}

/** Vacía las tablas para que reimportar no acumule con lo anterior. */
function limpiar() {
  db.exec(`
    DELETE FROM servicio_trabajador;
    DELETE FROM servicios;
    DELETE FROM trabajadores;
    DELETE FROM clientes;
    DELETE FROM avisos;
    DELETE FROM hojas;
  `);
}

/**
 * Vuelca una importación completa en una sola transacción: o entra todo, o no
 * entra nada. Así no queda una base a medio llenar si algo falla por el camino.
 */
function guardar({ servicios, avisos, hojas }) {
  limpiar();
  db.exec('BEGIN');
  try {
    const insCliente = db.prepare('INSERT INTO clientes (nombre, direccion, telefono) VALUES (?, ?, ?)');
    const insTrab = db.prepare('INSERT INTO trabajadores (nombre) VALUES (?)');
    const insServ = db.prepare(`INSERT INTO servicios
      (cliente_id, fecha, periodo, horas, personas, valor, pago_colab, transporte,
       gasto, rentabilidad_hoja, estado, colaboradores_raw, origen_hoja, origen_fila)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insST = db.prepare('INSERT OR IGNORE INTO servicio_trabajador (servicio_id, trabajador_id, pago) VALUES (?,?,?)');

    const idCliente = new Map();
    const idTrab = new Map();

    const obtenerCliente = (nombre, direccion, telefono) => {
      if (idCliente.has(nombre)) return idCliente.get(nombre);
      insCliente.bind([nombre, direccion || null, telefono || null]).stepReset();
      const id = db.selectValue('SELECT last_insert_rowid()');
      idCliente.set(nombre, id);
      return id;
    };
    const obtenerTrab = (nombre) => {
      if (idTrab.has(nombre)) return idTrab.get(nombre);
      insTrab.bind([nombre]).stepReset();
      const id = db.selectValue('SELECT last_insert_rowid()');
      idTrab.set(nombre, id);
      return id;
    };

    for (const s of servicios) {
      const cid = obtenerCliente(s.cliente, s.direccion, s.telefono);
      insServ.bind([
        cid, s.fecha, s.periodo, s.horas, s.personas, s.valor, s.pagoColab,
        s.transporte, s.gasto, s.rentabilidadHoja, s.estado || null,
        s.colaboradoresRaw || null, s.origenHoja, s.origenFila,
      ]).stepReset();
      const sid = db.selectValue('SELECT last_insert_rowid()');
      for (const t of s.trabajadores || []) {
        insST.bind([sid, obtenerTrab(t.nombre), t.pago]).stepReset();
      }
    }

    insCliente.finalize(); insTrab.finalize(); insServ.finalize(); insST.finalize();

    const insAviso = db.prepare('INSERT INTO avisos (tipo, hoja, fila, cliente, mensaje) VALUES (?,?,?,?,?)');
    for (const a of avisos) {
      insAviso.bind([a.tipo, a.hoja ?? null, a.fila ?? null, a.cliente ?? null, a.mensaje]).stepReset();
    }
    insAviso.finalize();

    const insHoja = db.prepare('INSERT INTO hojas (nombre, estado, maquetacion, motivo, servicios, columnas_faltantes) VALUES (?,?,?,?,?,?)');
    for (const h of hojas) {
      insHoja.bind([h.nombre, h.estado, h.maquetacion ?? null, h.motivo ?? null,
        h.servicios ?? 0, (h.columnasFaltantes || []).join(', ') || null]).stepReset();
    }
    insHoja.finalize();

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return {
    clientes: db.selectValue('SELECT COUNT(*) FROM clientes'),
    trabajadores: db.selectValue('SELECT COUNT(*) FROM trabajadores'),
    servicios: db.selectValue('SELECT COUNT(*) FROM servicios'),
    asignaciones: db.selectValue('SELECT COUNT(*) FROM servicio_trabajador'),
  };
}

/** Consulta libre, devuelta como array de objetos. */
function consultar({ sql, params }) {
  return db.exec({ sql, bind: params || [], rowMode: 'object', returnValue: 'resultRows' });
}

self.onmessage = async (ev) => {
  const { id, tipo, carga } = ev.data || {};
  try {
    let resultado;
    switch (tipo) {
      case 'abrir':     resultado = await abrir(); break;
      case 'guardar':   resultado = guardar(carga); break;
      case 'consultar': resultado = consultar(carga); break;
      case 'limpiar':   limpiar(); resultado = true; break;
      default: throw new Error(`Operación desconocida: ${tipo}`);
    }
    self.postMessage({ id, ok: true, resultado });
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e?.message ?? e) });
  }
};
