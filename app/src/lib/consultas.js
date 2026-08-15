/**
 * Los mismos agregados del panel, pero calculados en SQL.
 *
 * Sirven para retomar una importación anterior sin volver a pedir el archivo, y
 * de paso demuestran para qué está la base: el margen es una consulta, no un
 * bucle en memoria, y el criterio vive en un solo sitio.
 *
 *     margen = valor − (pago_colab + transporte + gasto)
 */

import { consultar } from './db.js';
import { nombrePeriodo } from './metricas.js';

/** Expresión del margen, escrita una vez y reutilizada en cada consulta. */
const MARGEN = '(s.valor - (s.pago_colab + s.transporte + s.gasto))';

export async function hayImportacion() {
  try {
    const filas = await consultar('SELECT COUNT(*) AS n FROM servicios');
    return (filas?.[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Reconstruye la misma estructura que `construirMetricas`, desde SQLite. */
export async function metricasDesdeSQL() {
  const [tot] = await consultar(`
    SELECT COUNT(*) AS servicios, COALESCE(SUM(s.valor),0) AS valor,
           COALESCE(SUM(s.pago_colab),0) AS pagoColab,
           COALESCE(SUM(s.transporte),0) AS transporte,
           COALESCE(SUM(s.gasto),0) AS gasto,
           COALESCE(SUM(s.horas),0) AS horas,
           COALESCE(SUM(${MARGEN}),0) AS margen
      FROM servicios s`);

  const porPeriodo = (await consultar(`
    SELECT s.periodo AS periodo, COUNT(*) AS servicios,
           SUM(s.valor) AS valor, SUM(s.pago_colab) AS pagoColab,
           SUM(s.transporte) AS transporte, SUM(s.gasto) AS gasto,
           SUM(s.horas) AS horas, SUM(${MARGEN}) AS margen
      FROM servicios s
     GROUP BY s.periodo
     ORDER BY s.periodo`)).map((p) => ({ ...p, etiqueta: nombrePeriodo(p.periodo) }));

  const porCliente = await consultar(`
    SELECT c.nombre AS cliente, COUNT(*) AS servicios,
           SUM(s.valor) AS valor, SUM(s.pago_colab) AS pagoColab,
           SUM(s.transporte) AS transporte, SUM(s.gasto) AS gasto,
           SUM(s.horas) AS horas, SUM(${MARGEN}) AS margen,
           MAX(s.fecha) AS ultimaFecha
      FROM servicios s
      JOIN clientes c ON c.id = s.cliente_id
     GROUP BY c.id
     ORDER BY margen DESC, c.nombre`);

  // El reparto ya está materializado en la tabla de unión: cada fila lleva la
  // parte que le tocó a esa persona en ese servicio.
  const porColaborador = await consultar(`
    SELECT t.nombre AS colaborador, COUNT(*) AS servicios,
           SUM(st.pago) AS pago,
           SUM(s.horas / (SELECT COUNT(*) FROM servicio_trabajador x WHERE x.servicio_id = s.id)) AS horas,
           SUM(s.valor / (SELECT COUNT(*) FROM servicio_trabajador x WHERE x.servicio_id = s.id)) AS valorGenerado,
           MAX(s.fecha) AS ultimaFecha
      FROM servicio_trabajador st
      JOIN trabajadores t ON t.id = st.trabajador_id
      JOIN servicios s    ON s.id = st.servicio_id
     GROUP BY t.id
     ORDER BY pago DESC, t.nombre`);

  const [rep] = await consultar(`
    SELECT
      (SELECT COALESCE(SUM(s.pago_colab),0) FROM servicios s
        WHERE EXISTS (SELECT 1 FROM servicio_trabajador x WHERE x.servicio_id = s.id)) AS asignado,
      (SELECT COALESCE(SUM(pago),0) FROM servicio_trabajador) AS repartido,
      (SELECT COUNT(*) FROM servicios s
        WHERE NOT EXISTS (SELECT 1 FROM servicio_trabajador x WHERE x.servicio_id = s.id)) AS sinColaborador,
      (SELECT COALESCE(SUM(s.pago_colab),0) FROM servicios s
        WHERE NOT EXISTS (SELECT 1 FROM servicio_trabajador x WHERE x.servicio_id = s.id)) AS pagoSinColaborador`);

  return {
    totales: tot,
    porPeriodo,
    porCliente,
    clientesEnPerdida: porCliente.filter((c) => c.margen < 0)
      .sort((a, b) => a.margen - b.margen),
    porColaborador,
    reparto: rep,
  };
}

/** Hojas guardadas, para poder rehacer la sección de trazabilidad. */
export async function hojasGuardadas() {
  return consultar(`SELECT nombre, estado, maquetacion, motivo, servicios,
                           columnas_faltantes AS columnasFaltantes
                      FROM hojas ORDER BY estado, nombre`);
}

export async function conteosBase() {
  const [f] = await consultar(`SELECT
      (SELECT COUNT(*) FROM clientes) AS clientes,
      (SELECT COUNT(*) FROM trabajadores) AS trabajadores,
      (SELECT COUNT(*) FROM servicios) AS servicios,
      (SELECT COUNT(*) FROM servicio_trabajador) AS asignaciones`);
  return f;
}
