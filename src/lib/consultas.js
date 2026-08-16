/**
 * Todas las lecturas de la aplicación, en SQL.
 *
 * El margen NO se calcula aquí: es una columna generada de la tabla
 * `servicios` (ver esquema.sql). Este módulo la suma, nunca la reproduce. Así
 * no puede haber dos criterios distintos de margen conviviendo.
 *
 * TODA función exportada de aquí exige sesión, y no por costumbre: comprobar
 * sólo en el layout NO basta. Next renderiza la página aparte del layout, así
 * que un layout que decide no pintar `children` igualmente ha ejecutado la
 * página y ha serializado su resultado. Se comprobó, y por esa vía se escapaban
 * nombres y direcciones de clientes en /servicios. La única barrera que no se
 * puede esquivar es la que está pegada a los datos.
 *
 * Los scripts de línea de comandos hablan con `db.js` directamente, así que no
 * les afecta.
 */

import { consultar, consultarUna } from './db.js';
import { exigirSesion } from './sesion.js';
import { proponerMes } from './recurrencia.js';

/** Envuelve una lectura para que no se ejecute sin sesión válida. */
function protegida(fn) {
  return async (...args) => {
    await exigirSesion();
    return fn(...args);
  };
}

// Se exportan envueltas: ninguna lectura llega a la base sin sesión.
export const totales = protegida(_totales);
export const porMes = protegida(_porMes);
export const periodos = protegida(_periodos);
export const clientes = protegida(_clientes);
export const cliente = protegida(_cliente);
export const serviciosDeCliente = protegida(_serviciosDeCliente);
export const colaboradores = protegida(_colaboradores);
export const servicios = protegida(_servicios);
export const contarServicios = protegida(_contarServicios);
export const servicio = protegida(_servicio);
export const gastos = protegida(_gastos);
export const costesFijos = protegida(_costesFijos);
export const cierre = protegida(_cierre);
export const avisos = protegida(_avisos);
export const resumenAvisos = protegida(_resumenAvisos);
export const fusiones = protegida(_fusiones);
export const pendientes = protegida(_pendientes);
export const estadoDelMes = protegida(_estadoDelMes);
export const mesesConBorradores = protegida(_mesesConBorradores);
export const mesAnteriorCon = protegida(_mesAnteriorCon);
export const serviciosParaRecurrencia = protegida(_serviciosParaRecurrencia);
export const analizarRecurrencia = protegida(_analizarRecurrencia);

// ── Resumen ─────────────────────────────────────────────────────────────────

async function _totales() {
  return consultarUna(`
    SELECT COUNT(*)                        AS servicios,
           COALESCE(SUM(valor), 0)         AS facturado,
           COALESCE(SUM(pago_colab), 0)    AS pagoColab,
           COALESCE(SUM(transporte), 0)    AS transporte,
           COALESCE(SUM(margen), 0)        AS margen,
           COALESCE(SUM(horas), 0)         AS horas
      FROM v_servicios`);
}

/**
 * Cierre de cada mes: lo que sale de sumar los servicios, menos los gastos de
 * empresa, los costes fijos y lo que él apunta aparte (seguridad social,
 * gestoría, retenciones).
 */
async function _porMes() {
  return consultar(`
    SELECT s.periodo                                AS periodo,
           COUNT(*)                                 AS servicios,
           SUM(s.horas)                             AS horas,
           SUM(s.valor)                             AS facturado,
           SUM(s.pago_colab)                        AS pagoColab,
           SUM(s.transporte)                        AS transporte,
           SUM(s.margen)                            AS margen,
           COALESCE(g.gastos, 0)                    AS gastos,
           COALESCE(f.fijos, 0)                     AS fijos,
           COALESCE(c.seg_soc, 0)                   AS segSoc,
           COALESCE(c.gestoria, 0)                  AS gestoria,
           COALESCE(c.iva_irpf, 0)                  AS ivaIrpf,
           SUM(s.margen) - COALESCE(g.gastos, 0) - COALESCE(f.fijos, 0)
             - COALESCE(c.seg_soc, 0) - COALESCE(c.gestoria, 0)
             - COALESCE(c.iva_irpf, 0)              AS resultado,
           c.facturado_libro                        AS facturadoLibro
      FROM v_servicios s
      LEFT JOIN (SELECT periodo, SUM(importe) AS gastos FROM gastos GROUP BY periodo) g
             ON g.periodo = s.periodo
      LEFT JOIN (SELECT periodo, SUM(importe) AS fijos FROM costes_fijos GROUP BY periodo) f
             ON f.periodo = s.periodo
      LEFT JOIN cierres c ON c.periodo = s.periodo
     GROUP BY s.periodo
     ORDER BY s.periodo DESC`);
}

async function _periodos() {
  const filas = await consultar(
    'SELECT DISTINCT periodo FROM v_servicios ORDER BY periodo DESC');
  return filas.map((f) => f.periodo);
}

// ── Clientes ────────────────────────────────────────────────────────────────

// Los filtros opcionales van como parámetro con centinela ('' = sin filtro) en
// vez de armando el SQL con trozos de cadena. La consulta es siempre la misma,
// así que se puede leer entera aquí y no hay forma de colar texto en ella.
async function _clientes({ busqueda = '', periodo = '' } = {}) {
  return consultar(`
    SELECT c.id, c.nombre, c.direccion, c.telefono, c.notas,
           COUNT(s.id)                       AS servicios,
           COALESCE(SUM(s.horas), 0)         AS horas,
           COALESCE(SUM(s.valor), 0)         AS facturado,
           COALESCE(SUM(s.margen), 0)        AS margen,
           MAX(s.fecha)                      AS ultimo
      FROM clientes c
      LEFT JOIN v_servicios s
             ON s.cliente_id = c.id
            AND (?1 = '' OR s.periodo = ?1)
     WHERE (?2 = '' OR c.nombre LIKE '%' || ?2 || '%')
     GROUP BY c.id
     ORDER BY margen DESC, c.nombre`, [periodo, busqueda]);
}

async function _cliente(id) {
  return consultarUna('SELECT * FROM clientes WHERE id = ?', [id]);
}

async function _serviciosDeCliente(id) {
  return consultar(`
    SELECT s.*, (SELECT GROUP_CONCAT(co.nombre, ', ')
                   FROM servicio_colaborador sc
                   JOIN colaboradores co ON co.id = sc.colaborador_id
                  WHERE sc.servicio_id = s.id) AS colaboradores
      FROM v_servicios s
     WHERE s.cliente_id = ?
     ORDER BY s.periodo DESC, s.fecha DESC`, [id]);
}

// ── Colaboradores ───────────────────────────────────────────────────────────

async function _colaboradores({ periodo = '' } = {}) {
  return consultar(`
    SELECT co.id, co.nombre, co.telefono, co.notas,
           COUNT(s.id)                               AS servicios,
           COALESCE(SUM(sc.pago), 0)                 AS pago,
           COALESCE(SUM(s.horas / (SELECT COUNT(*) FROM servicio_colaborador x
                                    WHERE x.servicio_id = s.id)), 0) AS horas,
           MAX(s.fecha)                              AS ultimo
      FROM colaboradores co
      LEFT JOIN servicio_colaborador sc ON sc.colaborador_id = co.id
      LEFT JOIN v_servicios s
             ON s.id = sc.servicio_id
            AND (?1 = '' OR s.periodo = ?1)
     GROUP BY co.id
     ORDER BY pago DESC, co.nombre`, [periodo]);
}

// ── Servicios ───────────────────────────────────────────────────────────────

/**
 * Lista de servicios. Es la única lectura que va contra la tabla y no contra la
 * vista: aquí es donde revisa los borradores, así que aquí tienen que verse.
 *
 * `borrador`: 'no' (por defecto) sólo confirmados · 'si' sólo borradores ·
 * 'todos' las dos cosas.
 */
async function _servicios({ periodo = '', clienteId = '', revisar = false,
  borrador = 'no', limite = 200, desde = 0 } = {}) {
  const filtro = [];
  const args = [];
  if (periodo) { filtro.push('s.periodo = ?'); args.push(periodo); }
  if (clienteId) { filtro.push('s.cliente_id = ?'); args.push(clienteId); }
  if (revisar) filtro.push('s.revisar = 1');
  if (borrador === 'si') filtro.push('s.borrador = 1');
  else if (borrador !== 'todos') filtro.push('s.borrador = 0');

  // Los nombres son para leer la tabla; los id, para que el formulario de
  // edición pueda preseleccionar a quién estaba asignado sin otra consulta.
  return consultar(`
    SELECT s.*, c.nombre AS cliente,
           (SELECT GROUP_CONCAT(co.nombre, ', ')
              FROM servicio_colaborador sc
              JOIN colaboradores co ON co.id = sc.colaborador_id
             WHERE sc.servicio_id = s.id) AS colaboradores,
           (SELECT GROUP_CONCAT(sc.colaborador_id, ',')
              FROM servicio_colaborador sc
             WHERE sc.servicio_id = s.id) AS colaboradorIds
      FROM servicios s
      JOIN clientes c ON c.id = s.cliente_id
      ${filtro.length ? `WHERE ${filtro.join(' AND ')}` : ''}
     ORDER BY s.fecha DESC, s.id DESC
     LIMIT ? OFFSET ?`, [...args, limite, desde]);
}

async function _contarServicios({ periodo = '', clienteId = '', revisar = false,
  borrador = 'no' } = {}) {
  const filtro = [];
  const args = [];
  if (periodo) { filtro.push('periodo = ?'); args.push(periodo); }
  if (clienteId) { filtro.push('cliente_id = ?'); args.push(clienteId); }
  if (revisar) filtro.push('revisar = 1');
  if (borrador === 'si') filtro.push('borrador = 1');
  else if (borrador !== 'todos') filtro.push('borrador = 0');
  const f = await consultarUna(
    `SELECT COUNT(*) AS n FROM servicios ${filtro.length ? `WHERE ${filtro.join(' AND ')}` : ''}`,
    args);
  return f?.n ?? 0;
}

async function _servicio(id) {
  const s = await consultarUna(`
    SELECT s.*, c.nombre AS cliente FROM servicios s
      JOIN clientes c ON c.id = s.cliente_id WHERE s.id = ?`, [id]);
  if (!s) return null;
  s.colaboradores = await consultar(
    'SELECT colaborador_id AS id, pago FROM servicio_colaborador WHERE servicio_id = ?', [id]);
  return s;
}

// ── Preparar el mes ─────────────────────────────────────────────────────────

/**
 * Servicios confirmados de un mes con sus colaboradores, tal y como los
 * necesita el análisis de recurrencia. Lo usan la vista previa y el generador,
 * para que los dos miren exactamente lo mismo.
 */
async function _serviciosParaRecurrencia(periodo) {
  const servicios = await consultar(
    `SELECT s.id, s.cliente_id AS clienteId, c.nombre AS cliente, s.fecha,
            s.hora, s.horas, s.valor, s.pago_colab AS pagoColab, s.transporte
       FROM v_servicios s
       JOIN clientes c ON c.id = s.cliente_id
      WHERE s.periodo = ?`, [periodo]);

  const enlaces = await consultar(
    `SELECT sc.servicio_id AS servicio, sc.colaborador_id AS colaborador
       FROM servicio_colaborador sc
       JOIN v_servicios s ON s.id = sc.servicio_id
      WHERE s.periodo = ?`, [periodo]);

  const porServicio = new Map();
  for (const e of enlaces) {
    if (!porServicio.has(e.servicio)) porServicio.set(e.servicio, []);
    porServicio.get(e.servicio).push(e.colaborador);
  }
  for (const s of servicios) s.colaboradores = porServicio.get(s.id) ?? [];

  return servicios;
}

/**
 * Vista previa: qué se propondría para `destino` copiando de `origen`, sin
 * escribir nada. Es lo que ve antes de decidir si lo genera.
 */
async function _analizarRecurrencia(origen, destino) {
  const servicios = await _serviciosParaRecurrencia(origen);
  if (!servicios.length) return null;
  return proponerMes(servicios, origen, destino);
}

/** Cuántos borradores y cuántos confirmados tiene un mes. */
async function _estadoDelMes(periodo) {
  return consultarUna(
    `SELECT (SELECT COUNT(*) FROM servicios WHERE periodo = ? AND borrador = 0) AS confirmados,
            (SELECT COUNT(*) FROM servicios WHERE periodo = ? AND borrador = 1) AS borradores,
            (SELECT COALESCE(SUM(valor), 0) FROM servicios
              WHERE periodo = ? AND borrador = 1)                                AS valorBorradores`,
    [periodo, periodo, periodo]);
}

/** Meses que tienen borradores pendientes de confirmar. */
async function _mesesConBorradores() {
  return consultar(
    `SELECT periodo, COUNT(*) AS n FROM servicios WHERE borrador = 1
      GROUP BY periodo ORDER BY periodo`);
}

/**
 * El mes anterior con servicios confirmados, que es del que se copia.
 * No es siempre «el mes de antes»: puede haber huecos.
 */
async function _mesAnteriorCon(periodo) {
  const f = await consultarUna(
    'SELECT periodo FROM v_servicios WHERE periodo < ? ORDER BY periodo DESC LIMIT 1',
    [periodo]);
  return f?.periodo ?? null;
}

// ── Gastos y costes fijos ───────────────────────────────────────────────────

async function _gastos({ periodo = '' } = {}) {
  return consultar(`
    SELECT * FROM gastos ${periodo ? 'WHERE periodo = ?' : ''}
     ORDER BY periodo DESC, id DESC`, periodo ? [periodo] : []);
}

async function _costesFijos({ periodo = '' } = {}) {
  return consultar(`
    SELECT * FROM costes_fijos ${periodo ? 'WHERE periodo = ?' : ''}
     ORDER BY periodo DESC, concepto`, periodo ? [periodo] : []);
}

async function _cierre(periodo) {
  return consultarUna('SELECT * FROM cierres WHERE periodo = ?', [periodo]);
}

// ── Cosas que revisar ───────────────────────────────────────────────────────

async function _avisos({ resueltos = false } = {}) {
  return consultar(`
    SELECT * FROM avisos WHERE resuelto = ?
     ORDER BY tipo, periodo, id`, [resueltos ? 1 : 0]);
}

async function _resumenAvisos() {
  return consultar(`
    SELECT tipo, COUNT(*) AS n FROM avisos WHERE resuelto = 0
     GROUP BY tipo ORDER BY n DESC`);
}

async function _fusiones({ estado = 'pendiente' } = {}) {
  return consultar(`
    SELECT * FROM fusiones WHERE estado = ?
     ORDER BY CASE confianza WHEN 'baja' THEN 0 ELSE 1 END, usos DESC`, [estado]);
}

/** Contadores para el aviso del menú. */
async function _pendientes() {
  return consultarUna(`
    SELECT (SELECT COUNT(*) FROM avisos WHERE resuelto = 0)        AS avisos,
           (SELECT COUNT(*) FROM fusiones WHERE estado = 'pendiente') AS fusiones,
           (SELECT COUNT(*) FROM v_servicios WHERE revisar = 1)   AS servicios,
           (SELECT COUNT(*) FROM servicios WHERE borrador = 1)     AS borradores`);
}
