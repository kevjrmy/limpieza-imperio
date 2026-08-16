'use server';

/**
 * Todas las escrituras de la aplicación.
 *
 * Reglas que se cumplen aquí y no en la pantalla, para que valgan también si
 * alguien llama a la acción por otro camino:
 *
 *  · El pago a colaboradores se reparte en céntimos enteros. La suma de las
 *    partes es idéntica al pago del servicio, siempre.
 *  · Nada se borra si tiene historial colgando. Un cliente con servicios no se
 *    borra: se marca inactivo. Borrarlo se llevaría por delante su contabilidad.
 *  · El margen no se escribe nunca: lo calcula la base.
 */

import { revalidatePath } from 'next/cache';

import { consultar, consultarUna, ejecutar, enLote } from './db.js';
import { repartir } from './metricas.js';
import { exigirSesion } from './sesion.js';

// ── Utilidades de formulario ────────────────────────────────────────────────

const txt = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

/** Número desde un campo de formulario, tolerando la coma decimal española. */
function num(v) {
  const t = String(v ?? '').trim().replace(/[€\s]/g, '').replace(',', '.');
  if (!t) return 0;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** '2026-08-14' → '2026-08'. El mes contable sale de la fecha si no se dice otra cosa. */
const periodoDe = (fecha, periodo) => txt(periodo) || txt(fecha).slice(0, 7);

class ErrorDeUso extends Error {}

function exigir(condicion, mensaje) {
  if (!condicion) throw new ErrorDeUso(mensaje);
}

/**
 * Envuelve una acción: exige sesión y devuelve { ok } o { error } en vez de
 * reventar. La sesión se comprueba aquí, en la puerta de cada escritura, y no
 * sólo en el proxy — una acción de servidor es una URL como cualquier otra.
 */
function accion(fn) {
  return async (...args) => {
    try {
      await exigirSesion();
      return await fn(...args);
    } catch (e) {
      // Next señaliza redirecciones y 404 lanzando un error con `digest`. Si lo
      // capturamos como si fuera un fallo, la redirección al login nunca ocurre
      // y el usuario se queda mirando un mensaje que no explica nada.
      if (typeof e?.digest === 'string'
        && (e.digest.startsWith('NEXT_REDIRECT') || e.digest === 'NEXT_NOT_FOUND')) throw e;

      if (e instanceof ErrorDeUso) return { error: e.message };
      console.error(e);
      return { error: 'No se ha podido guardar. Inténtalo otra vez.' };
    }
  };
}

function refrescar(...rutas) {
  for (const r of ['/', '/servicios', '/clientes', '/colaboradores', '/gastos',
    '/meses', '/revisar', ...rutas]) {
    revalidatePath(r);
  }
}

// ── Servicios ───────────────────────────────────────────────────────────────

/** Reescribe quién hizo un servicio y reparte su pago entre esas personas. */
async function asignarColaboradores(servicioId, ids, pagoColab) {
  const unicos = [...new Set(ids.map(Number).filter(Boolean))];
  const sentencias = [{
    sql: 'DELETE FROM servicio_colaborador WHERE servicio_id = ?',
    args: [servicioId],
  }];

  const partes = repartir(pagoColab, unicos.length);
  unicos.forEach((id, i) => sentencias.push({
    sql: 'INSERT INTO servicio_colaborador (servicio_id, colaborador_id, pago) VALUES (?,?,?)',
    args: [servicioId, id, partes[i]],
  }));

  await enLote(sentencias);
}

function leerServicio(datos) {
  const fecha = txt(datos.get('fecha'));
  const periodo = periodoDe(fecha, datos.get('periodo'));

  exigir(/^\d{4}-\d{2}$/.test(periodo), 'Falta la fecha o el mes contable.');
  exigir(Number(datos.get('cliente_id')), 'Hay que elegir un cliente.');

  return {
    periodo,
    fecha,
    hora: txt(datos.get('hora')),
    clienteId: Number(datos.get('cliente_id')),
    horas: num(datos.get('horas')),
    personas: txt(datos.get('personas')) ? Number(num(datos.get('personas'))) : null,
    valor: num(datos.get('valor')),
    pagoColab: num(datos.get('pago_colab')),
    transporte: num(datos.get('transporte')),
    pagado: datos.get('pagado') ? 1 : 0,
    notas: txt(datos.get('notas')),
    revisar: datos.get('revisar') ? 1 : 0,
    colaboradores: datos.getAll('colaboradores'),
  };
}

export const crearServicio = accion(async (datos) => {
  const s = leerServicio(datos);

  const { id } = await ejecutar(
    `INSERT INTO servicios
       (periodo, fecha, hora, cliente_id, horas, personas, valor,
        pago_colab, transporte, pagado, notas, revisar)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [s.periodo, s.fecha, s.hora, s.clienteId, s.horas, s.personas, s.valor,
      s.pagoColab, s.transporte, s.pagado, s.notas, s.revisar],
  );

  await asignarColaboradores(Number(id), s.colaboradores, s.pagoColab);
  refrescar();
  return { ok: true, id: Number(id) };
});

export const actualizarServicio = accion(async (id, datos) => {
  const s = leerServicio(datos);

  await ejecutar(
    `UPDATE servicios SET periodo=?, fecha=?, hora=?, cliente_id=?, horas=?,
            personas=?, valor=?, pago_colab=?, transporte=?, pagado=?, notas=?,
            revisar=?, editado_en=datetime('now')
      WHERE id=?`,
    [s.periodo, s.fecha, s.hora, s.clienteId, s.horas, s.personas, s.valor,
      s.pagoColab, s.transporte, s.pagado, s.notas, s.revisar, Number(id)],
  );

  await asignarColaboradores(Number(id), s.colaboradores, s.pagoColab);
  refrescar();
  return { ok: true };
});

export const borrarServicio = accion(async (id) => {
  // Las asignaciones se van solas por ON DELETE CASCADE.
  await ejecutar('DELETE FROM servicios WHERE id = ?', [Number(id)]);
  refrescar();
  return { ok: true };
});

export const marcarRevisado = accion(async (id) => {
  await ejecutar("UPDATE servicios SET revisar=0, editado_en=datetime('now') WHERE id=?",
    [Number(id)]);
  refrescar();
  return { ok: true };
});

// ── Clientes ────────────────────────────────────────────────────────────────

export const guardarCliente = accion(async (id, datos) => {
  const nombre = txt(datos.get('nombre'));
  exigir(nombre, 'El cliente necesita un nombre.');

  const campos = [nombre, txt(datos.get('direccion')), txt(datos.get('telefono')),
    txt(datos.get('notas')), datos.get('activo') ? 1 : 0];

  if (id) {
    await ejecutar(
      `UPDATE clientes SET nombre=?, direccion=?, telefono=?, notas=?, activo=?,
              editado_en=datetime('now') WHERE id=?`, [...campos, Number(id)]);
    refrescar();
    return { ok: true, id: Number(id) };
  }

  // Un nombre repetido casi siempre es el mismo cliente escrito dos veces, y
  // duplicarlo parte su historial en dos. Se avisa en vez de crearlo.
  const yaEsta = await consultarUna(
    'SELECT id, nombre FROM clientes WHERE UPPER(nombre) = UPPER(?)', [nombre]);
  exigir(!yaEsta, `Ya existe un cliente llamado «${yaEsta?.nombre}». Edítalo en vez de crear otro.`);

  const { id: nuevo } = await ejecutar(
    'INSERT INTO clientes (nombre, direccion, telefono, notas, activo) VALUES (?,?,?,?,?)',
    campos);
  refrescar();
  return { ok: true, id: Number(nuevo) };
});

export const borrarCliente = accion(async (id) => {
  const [{ n }] = await consultar(
    'SELECT COUNT(*) AS n FROM servicios WHERE cliente_id = ?', [Number(id)]);
  exigir(n === 0,
    `Este cliente tiene ${n} servicio(s). Borrarlo se llevaría su contabilidad por delante. `
    + 'Márcalo como inactivo si ya no trabajas con él.');

  await ejecutar('DELETE FROM clientes WHERE id = ?', [Number(id)]);
  refrescar();
  return { ok: true };
});

// ── Colaboradores ───────────────────────────────────────────────────────────

export const guardarColaborador = accion(async (id, datos) => {
  const nombre = txt(datos.get('nombre'));
  exigir(nombre, 'El colaborador necesita un nombre.');

  const campos = [nombre, txt(datos.get('telefono')), txt(datos.get('notas')),
    datos.get('activo') ? 1 : 0];

  if (id) {
    await ejecutar(
      `UPDATE colaboradores SET nombre=?, telefono=?, notas=?, activo=?,
              editado_en=datetime('now') WHERE id=?`, [...campos, Number(id)]);
    refrescar();
    return { ok: true, id: Number(id) };
  }

  const yaEsta = await consultarUna(
    'SELECT id, nombre FROM colaboradores WHERE UPPER(nombre) = UPPER(?)', [nombre]);
  exigir(!yaEsta, `Ya existe un colaborador llamado «${yaEsta?.nombre}».`);

  const { id: nuevo } = await ejecutar(
    'INSERT INTO colaboradores (nombre, telefono, notas, activo) VALUES (?,?,?,?)', campos);
  refrescar();
  return { ok: true, id: Number(nuevo) };
});

export const borrarColaborador = accion(async (id) => {
  const [{ n }] = await consultar(
    'SELECT COUNT(*) AS n FROM servicio_colaborador WHERE colaborador_id = ?', [Number(id)]);
  exigir(n === 0,
    `Esta persona figura en ${n} servicio(s). Márcala como inactiva en vez de borrarla.`);

  await ejecutar('DELETE FROM colaboradores WHERE id = ?', [Number(id)]);
  refrescar();
  return { ok: true };
});

// ── Gastos y costes fijos ───────────────────────────────────────────────────

export const guardarGasto = accion(async (id, datos) => {
  const fecha = txt(datos.get('fecha'));
  const periodo = periodoDe(fecha, datos.get('periodo'));
  exigir(/^\d{4}-\d{2}$/.test(periodo), 'Falta la fecha o el mes del gasto.');

  const campos = [periodo, fecha, txt(datos.get('comercio')),
    txt(datos.get('concepto')), num(datos.get('importe'))];

  if (id) {
    await ejecutar(
      `UPDATE gastos SET periodo=?, fecha=?, comercio=?, concepto=?, importe=?,
              editado_en=datetime('now') WHERE id=?`, [...campos, Number(id)]);
  } else {
    await ejecutar(
      'INSERT INTO gastos (periodo, fecha, comercio, concepto, importe) VALUES (?,?,?,?,?)',
      campos);
  }
  refrescar();
  return { ok: true };
});

export const borrarGasto = accion(async (id) => {
  await ejecutar('DELETE FROM gastos WHERE id = ?', [Number(id)]);
  refrescar();
  return { ok: true };
});

export const guardarCosteFijo = accion(async (id, datos) => {
  const periodo = txt(datos.get('periodo'));
  const concepto = txt(datos.get('concepto'));
  exigir(/^\d{4}-\d{2}$/.test(periodo), 'Falta el mes.');
  exigir(concepto, 'Falta el concepto.');

  const campos = [periodo, concepto, num(datos.get('importe'))];
  if (id) {
    await ejecutar(
      `UPDATE costes_fijos SET periodo=?, concepto=?, importe=?,
              editado_en=datetime('now') WHERE id=?`, [...campos, Number(id)]);
  } else {
    await ejecutar(
      'INSERT INTO costes_fijos (periodo, concepto, importe) VALUES (?,?,?)', campos);
  }
  refrescar();
  return { ok: true };
});

export const borrarCosteFijo = accion(async (id) => {
  await ejecutar('DELETE FROM costes_fijos WHERE id = ?', [Number(id)]);
  refrescar();
  return { ok: true };
});

// ── Cierre del mes ──────────────────────────────────────────────────────────

export const guardarCierre = accion(async (datos) => {
  const periodo = txt(datos.get('periodo'));
  exigir(/^\d{4}-\d{2}$/.test(periodo), 'Falta el mes.');

  await ejecutar(
    `INSERT INTO cierres (periodo, seg_soc, gestoria, iva_irpf, notas)
     VALUES (?,?,?,?,?)
     ON CONFLICT(periodo) DO UPDATE SET
       seg_soc=excluded.seg_soc, gestoria=excluded.gestoria,
       iva_irpf=excluded.iva_irpf, notas=excluded.notas,
       editado_en=datetime('now')`,
    [periodo, num(datos.get('seg_soc')), num(datos.get('gestoria')),
      num(datos.get('iva_irpf')), txt(datos.get('notas'))],
  );
  refrescar();
  return { ok: true };
});

// ── Revisión ────────────────────────────────────────────────────────────────

export const resolverAviso = accion(async (id, resuelto = true) => {
  await ejecutar('UPDATE avisos SET resuelto = ? WHERE id = ?',
    [resuelto ? 1 : 0, Number(id)]);
  refrescar();
  return { ok: true };
});

/**
 * Aplica una fusión de nombres: mueve todo lo que cuelga de los nombres
 * absorbidos al que se queda, y borra los que sobran.
 *
 * Esto sí destruye datos —por eso nunca se hace solo— así que se comprueba que
 * no quede nada colgando antes de borrar nada.
 */
export const aplicarFusion = accion(async (id) => {
  const f = await consultarUna('SELECT * FROM fusiones WHERE id = ?', [Number(id)]);
  exigir(f, 'Esa propuesta ya no existe.');
  exigir(f.estado === 'pendiente', 'Esa propuesta ya estaba decidida.');

  const tabla = f.tabla === 'clientes' ? 'clientes' : 'colaboradores';
  const nombres = String(f.absorberia)
    .split('|')
    .map((t) => t.replace(/\s*\(\d+\)\s*$/, '').trim())
    .filter(Boolean);

  const destino = await consultarUna(
    `SELECT id FROM ${tabla} WHERE UPPER(nombre) = UPPER(?)`, [f.quedaria]);
  exigir(destino, `Ya no existe «${f.quedaria}».`);

  for (const nombre of nombres) {
    const origen = await consultarUna(
      `SELECT id FROM ${tabla} WHERE UPPER(nombre) = UPPER(?)`, [nombre]);
    if (!origen || origen.id === destino.id) continue;

    if (tabla === 'clientes') {
      await ejecutar('UPDATE servicios SET cliente_id = ? WHERE cliente_id = ?',
        [destino.id, origen.id]);
    } else {
      // Si las dos personas ya estaban en el mismo servicio, la fila del que se
      // absorbe se descarta: si no, la clave primaria compuesta chocaría.
      await ejecutar(
        `DELETE FROM servicio_colaborador
          WHERE colaborador_id = ?
            AND servicio_id IN (SELECT servicio_id FROM servicio_colaborador
                                 WHERE colaborador_id = ?)`,
        [origen.id, destino.id]);
      await ejecutar(
        'UPDATE servicio_colaborador SET colaborador_id = ? WHERE colaborador_id = ?',
        [destino.id, origen.id]);
    }

    await ejecutar(`DELETE FROM ${tabla} WHERE id = ?`, [origen.id]);
  }

  await ejecutar("UPDATE fusiones SET estado = 'aceptada' WHERE id = ?", [Number(id)]);
  refrescar();
  return { ok: true };
});

export const rechazarFusion = accion(async (id) => {
  await ejecutar("UPDATE fusiones SET estado = 'rechazada' WHERE id = ?", [Number(id)]);
  refrescar();
  return { ok: true };
});
