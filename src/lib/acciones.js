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
import { proponerMes } from './recurrencia.js';
import { serviciosParaRecurrencia } from './consultas.js';
import { nombrePeriodo } from './formato.js';

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

/**
 * Id del cliente del formulario, creándolo si vino escrito a mano.
 *
 * Si ese nombre ya existe se reutiliza en vez de duplicarlo: un cliente
 * repetido parte su historial en dos y eso no se arregla solo. La comparación
 * es la misma que hace `guardarCliente` —mayúsculas y poco más—; las variantes
 * con acento o abreviadas las recoge después la tabla `fusiones`, que existe
 * justo para eso.
 */
async function resolverCliente({ clienteId, clienteNuevo }) {
  if (clienteId) return clienteId;

  const yaEsta = await consultarUna(
    'SELECT id FROM clientes WHERE UPPER(nombre) = UPPER(?)', [clienteNuevo]);
  if (yaEsta) return Number(yaEsta.id);

  const { id } = await ejecutar('INSERT INTO clientes (nombre) VALUES (?)', [clienteNuevo]);
  return Number(id);
}

function leerServicio(datos) {
  const fecha = txt(datos.get('fecha'));
  const periodo = periodoDe(fecha, datos.get('periodo'));

  // El cliente puede venir elegido de la lista o escrito a mano. Obligarle a
  // salir a /clientes, crearlo allí y volver era razón suficiente para no
  // apuntar el servicio: viene de una hoja de cálculo donde un cliente nuevo
  // era, simplemente, una fila más.
  const clienteId = Number(datos.get('cliente_id')) || null;
  const clienteNuevo = txt(datos.get('cliente_nuevo'));

  exigir(/^\d{4}-\d{2}$/.test(periodo), 'Falta la fecha o el mes contable.');
  exigir(clienteId || clienteNuevo,
    'Hay que elegir un cliente, o escribir el nombre de uno nuevo.');

  return {
    periodo,
    fecha,
    hora: txt(datos.get('hora')),
    clienteId,
    clienteNuevo,
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
  const clienteId = await resolverCliente(s);

  const { id } = await ejecutar(
    `INSERT INTO servicios
       (periodo, fecha, hora, cliente_id, horas, personas, valor,
        pago_colab, transporte, pagado, notas, revisar)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [s.periodo, s.fecha, s.hora, clienteId, s.horas, s.personas, s.valor,
      s.pagoColab, s.transporte, s.pagado, s.notas, s.revisar],
  );

  await asignarColaboradores(Number(id), s.colaboradores, s.pagoColab);
  refrescar();
  return { ok: true, id: Number(id) };
});

export const actualizarServicio = accion(async (id, datos) => {
  const s = leerServicio(datos);
  const clienteId = await resolverCliente(s);

  await ejecutar(
    `UPDATE servicios SET periodo=?, fecha=?, hora=?, cliente_id=?, horas=?,
            personas=?, valor=?, pago_colab=?, transporte=?, pagado=?, notas=?,
            revisar=?, editado_en=datetime('now')
      WHERE id=?`,
    [s.periodo, s.fecha, s.hora, clienteId, s.horas, s.personas, s.valor,
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

// ── Preparar el mes desde lo que se repite ──────────────────────────────────

/**
 * Genera los borradores del mes a partir de la recurrencia del mes anterior.
 *
 * Los borradores no cuentan para nada hasta que él los confirma: los agregados
 * leen la vista `v_servicios`, que los excluye.
 *
 * Se niega a generar sobre un mes que ya tiene servicios confirmados. Adelantar
 * un mes ya empezado duplicaría trabajo hecho, y eso no se arregla deshaciendo.
 */
export const generarBorradores = accion(async (destino, origen) => {
  exigir(/^\d{4}-\d{2}$/.test(destino), 'Mes de destino mal escrito.');
  exigir(/^\d{4}-\d{2}$/.test(origen), 'Mes de origen mal escrito.');
  exigir(origen < destino, 'El mes de origen tiene que ser anterior al de destino.');

  const [{ firmes, borradores }] = await consultar(
    `SELECT (SELECT COUNT(*) FROM servicios WHERE periodo = ? AND borrador = 0) AS firmes,
            (SELECT COUNT(*) FROM servicios WHERE periodo = ? AND borrador = 1) AS borradores`,
    [destino, destino]);

  exigir(firmes === 0,
    `${nombrePeriodo(destino)} ya tiene ${firmes} servicio(s) confirmados. `
    + 'Generar encima duplicaría lo que ya está hecho.');
  exigir(borradores === 0,
    `${nombrePeriodo(destino)} ya tiene ${borradores} borradores. `
    + 'Descártalos antes de volver a generar.');

  const servicios = await serviciosParaRecurrencia(origen);
  exigir(servicios.length > 0, `No hay servicios en ${nombrePeriodo(origen)} de los que copiar.`);

  const { propuestas, resumen } = proponerMes(servicios, origen, destino);
  exigir(propuestas.length > 0,
    `No se ha encontrado nada que se repita en ${nombrePeriodo(origen)}.`);

  // Se insertan en lote: son ciento y pico filas y cada una con su reparto.
  const sentencias = [];
  for (const p of propuestas) {
    sentencias.push({
      sql: `INSERT INTO servicios
              (periodo, fecha, hora, cliente_id, horas, valor, pago_colab,
               transporte, borrador, origen)
            VALUES (?,?,?,?,?,?,?,?,1,?)`,
      args: [p.periodo, p.fecha, p.hora, p.clienteId, p.horas, p.valor,
        p.pagoColab, p.transporte, `recurrencia:${origen}`],
    });
  }
  await enLote(sentencias);

  // El colaborador habitual, cuando lo hay, se asigna después: hace falta el id
  // del servicio recién creado y por eso no cabe en el mismo lote.
  const creados = await consultar(
    `SELECT id, fecha, cliente_id, pago_colab FROM servicios
      WHERE periodo = ? AND borrador = 1 ORDER BY fecha, id`, [destino]);

  const asignaciones = [];
  propuestas.forEach((p, i) => {
    const servicio = creados[i];
    if (!p.colaborador || !servicio) return;
    asignaciones.push({
      sql: `INSERT INTO servicio_colaborador (servicio_id, colaborador_id, pago)
            VALUES (?,?,?)`,
      args: [servicio.id, p.colaborador, p.pagoColab],
    });
  });
  if (asignaciones.length) await enLote(asignaciones);

  refrescar();
  return { ok: true, resumen: { ...resumen, asignados: asignaciones.length } };
});

/** Pasa los borradores del mes a servicios de verdad. */
export const confirmarBorradores = accion(async (periodo) => {
  exigir(/^\d{4}-\d{2}$/.test(periodo), 'Mes mal escrito.');

  const { filas } = await ejecutar(
    `UPDATE servicios SET borrador = 0, editado_en = datetime('now')
      WHERE periodo = ? AND borrador = 1`, [periodo]);

  exigir(filas > 0, 'No había borradores que confirmar.');
  refrescar();
  return { ok: true, confirmados: filas };
});

/** Tira los borradores del mes. No toca lo confirmado. */
export const descartarBorradores = accion(async (periodo) => {
  exigir(/^\d{4}-\d{2}$/.test(periodo), 'Mes mal escrito.');

  const { filas } = await ejecutar(
    'DELETE FROM servicios WHERE periodo = ? AND borrador = 1', [periodo]);

  refrescar();
  return { ok: true, descartados: filas };
});

// ── Clientes ────────────────────────────────────────────────────────────────

export const guardarCliente = accion(async (id, datos) => {
  const nombre = txt(datos.get('nombre'));
  exigir(nombre, 'El cliente necesita un nombre.');

  // Quién suele ir. Vacío es un valor legítimo —y el más común: sólo uno de
  // cada cuatro clientes ha tenido siempre a la misma persona— así que se
  // guarda NULL y no un cero, que engancharía con el colaborador nº 0.
  const colaboradorId = Number(datos.get('colaborador_id')) || null;

  const campos = [nombre, txt(datos.get('direccion')), txt(datos.get('telefono')),
    txt(datos.get('notas')), datos.get('activo') ? 1 : 0, colaboradorId];

  if (id) {
    await ejecutar(
      `UPDATE clientes SET nombre=?, direccion=?, telefono=?, notas=?, activo=?,
              colaborador_id=?, editado_en=datetime('now') WHERE id=?`,
      [...campos, Number(id)]);
    refrescar();
    return { ok: true, id: Number(id) };
  }

  // Un nombre repetido casi siempre es el mismo cliente escrito dos veces, y
  // duplicarlo parte su historial en dos. Se avisa en vez de crearlo.
  const yaEsta = await consultarUna(
    'SELECT id, nombre FROM clientes WHERE UPPER(nombre) = UPPER(?)', [nombre]);
  exigir(!yaEsta, `Ya existe un cliente llamado «${yaEsta?.nombre}». Edítalo en vez de crear otro.`);

  const { id: nuevo } = await ejecutar(
    `INSERT INTO clientes (nombre, direccion, telefono, notas, activo, colaborador_id)
     VALUES (?,?,?,?,?,?)`, campos);
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

  const campos = [nombre, txt(datos.get('telefono')),
    txt(datos.get('direccion')), txt(datos.get('barrio')), txt(datos.get('provincia')),
    txt(datos.get('notas')), datos.get('activo') ? 1 : 0];

  if (id) {
    await ejecutar(
      `UPDATE colaboradores SET nombre=?, telefono=?, direccion=?, barrio=?, provincia=?,
              notas=?, activo=?, editado_en=datetime('now') WHERE id=?`,
      [...campos, Number(id)]);
    refrescar();
    return { ok: true, id: Number(id) };
  }

  const yaEsta = await consultarUna(
    'SELECT id, nombre FROM colaboradores WHERE UPPER(nombre) = UPPER(?)', [nombre]);
  exigir(!yaEsta, `Ya existe un colaborador llamado «${yaEsta?.nombre}».`);

  const { id: nuevo } = await ejecutar(
    `INSERT INTO colaboradores (nombre, telefono, direccion, barrio, provincia, notas, activo)
     VALUES (?,?,?,?,?,?,?)`, campos);
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
      // Si las dos personas ya estaban en el mismo servicio, la clave primaria
      // compuesta chocaría. El pago del que se absorbe se SUMA al del que se
      // queda antes de borrar su fila: descartarla sin más perdería ese dinero
      // y el reparto dejaría de cuadrar con `pago_colab`. Pasó de verdad —
      // servicio 297, 40 € evaporados al aceptar una fusión.
      await ejecutar(
        `UPDATE servicio_colaborador
            SET pago = ROUND(pago + COALESCE(
                  (SELECT o.pago FROM servicio_colaborador o
                    WHERE o.colaborador_id = ?
                      AND o.servicio_id = servicio_colaborador.servicio_id), 0), 2)
          WHERE colaborador_id = ?
            AND servicio_id IN (SELECT servicio_id FROM servicio_colaborador
                                 WHERE colaborador_id = ?)`,
        [origen.id, destino.id, origen.id]);
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
