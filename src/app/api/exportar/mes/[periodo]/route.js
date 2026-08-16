import { aCSV, respuestaCSV, bloquesCSV } from '../../../../../lib/csv.js';
import { consultar, consultarUna } from '../../../../../lib/db.js';
import { exigirSesion } from '../../../../../lib/sesion.js';
import { nombrePeriodo } from '../../../../../lib/formato.js';

export const dynamic = 'force-dynamic';

/**
 * El mes entero en un solo archivo.
 *
 *   /api/exportar/mes/2026-08
 *
 * Un CSV es una tabla y aquí hay cuatro cosas —servicios, quién cobró qué,
 * gastos y el cierre—, así que van en bloques uno debajo de otro separados por
 * una línea en blanco, con su título encima. Es exactamente como estaba montada
 * su hoja de Excel: la tabla y, debajo, el bloque de totales. Al abrirlo en
 * Excel se ve igual que lo que ya conoce.
 *
 * Los borradores no salen: se exporta lo confirmado.
 */
export async function GET(peticion, { params }) {
  await exigirSesion();

  const { periodo } = await params;
  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    return new Response('El mes tiene que ir como 2026-08.',
      { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const servicios = await consultar(`
    SELECT s.fecha, s.hora, c.nombre AS cliente, c.direccion, c.telefono,
           (SELECT GROUP_CONCAT(co.nombre, ', ') FROM servicio_colaborador sc
              JOIN colaboradores co ON co.id = sc.colaborador_id
             WHERE sc.servicio_id = s.id) AS colaboradores,
           s.horas, s.personas, s.valor, s.pago_colab, s.transporte, s.margen,
           CASE s.pagado WHEN 1 THEN 'sí' ELSE 'no' END AS pagado, s.notas
      FROM v_servicios s
      JOIN clientes c ON c.id = s.cliente_id
     WHERE s.periodo = ?
     ORDER BY s.fecha, c.nombre`, [periodo]);

  const porColaborador = await consultar(`
    SELECT co.nombre AS colaborador, COUNT(*) AS servicios,
           ROUND(SUM(s.horas / (SELECT COUNT(*) FROM servicio_colaborador x
                                 WHERE x.servicio_id = s.id)), 2) AS horas,
           SUM(sc.pago) AS pago
      FROM servicio_colaborador sc
      JOIN v_servicios s   ON s.id = sc.servicio_id
      JOIN colaboradores co ON co.id = sc.colaborador_id
     WHERE s.periodo = ?
     GROUP BY co.id
     ORDER BY pago DESC, co.nombre`, [periodo]);

  const porCliente = await consultar(`
    SELECT c.nombre AS cliente, COUNT(*) AS servicios, SUM(s.horas) AS horas,
           SUM(s.valor) AS facturado, SUM(s.margen) AS margen
      FROM v_servicios s
      JOIN clientes c ON c.id = s.cliente_id
     WHERE s.periodo = ?
     GROUP BY c.id
     ORDER BY margen DESC, c.nombre`, [periodo]);

  const gastos = await consultar(
    `SELECT fecha, comercio, concepto, importe FROM gastos
      WHERE periodo = ? ORDER BY fecha, id`, [periodo]);

  const fijos = await consultar(
    `SELECT concepto, importe FROM costes_fijos WHERE periodo = ? ORDER BY concepto`,
    [periodo]);

  const t = await consultarUna(`
    SELECT COUNT(*) AS servicios, COALESCE(SUM(horas), 0) AS horas,
           COALESCE(SUM(valor), 0) AS facturado,
           COALESCE(SUM(pago_colab), 0) AS pagoColab,
           COALESCE(SUM(transporte), 0) AS transporte,
           COALESCE(SUM(margen), 0) AS margen
      FROM v_servicios WHERE periodo = ?`, [periodo]);

  const c = await consultarUna('SELECT * FROM cierres WHERE periodo = ?', [periodo]);

  const sumaGastos = gastos.reduce((a, g) => a + g.importe, 0);
  const sumaFijos = fijos.reduce((a, f) => a + f.importe, 0);
  const segSoc = c?.seg_soc ?? 0;
  const gestoria = c?.gestoria ?? 0;
  const ivaIrpf = c?.iva_irpf ?? 0;
  const resultado = t.margen - sumaGastos - sumaFijos - segSoc - gestoria - ivaIrpf;

  // El cierre, en el orden en que se resta: de lo facturado al resultado.
  const cierre = [
    { concepto: 'Facturado', importe: t.facturado },
    { concepto: 'Pago a colaboradores', importe: -t.pagoColab },
    { concepto: 'Transporte', importe: -t.transporte },
    { concepto: 'MARGEN DE LOS SERVICIOS', importe: t.margen },
    { concepto: 'Gastos de empresa', importe: -sumaGastos },
    { concepto: 'Costes fijos', importe: -sumaFijos },
    { concepto: 'Seguridad social', importe: -segSoc },
    { concepto: 'Gestoría', importe: -gestoria },
    { concepto: 'IVA / IRPF', importe: -ivaIrpf },
    { concepto: 'RESULTADO DEL MES', importe: resultado },
  ];

  const texto = bloquesCSV([
    { titulo: `LIMPIEZAS EL IMPERIO — ${nombrePeriodo(periodo).toUpperCase()}`, filas: [] },
    {
      titulo: 'SERVICIOS',
      filas: servicios,
      columnas: [
        { campo: 'fecha', titulo: 'Fecha' },
        { campo: 'hora', titulo: 'Hora' },
        { campo: 'cliente', titulo: 'Cliente' },
        { campo: 'direccion', titulo: 'Dirección' },
        { campo: 'telefono', titulo: 'Teléfono' },
        { campo: 'colaboradores', titulo: 'Quién lo hizo' },
        { campo: 'horas', titulo: 'Horas' },
        { campo: 'personas', titulo: 'Personas' },
        { campo: 'valor', titulo: 'Valor' },
        { campo: 'pago_colab', titulo: 'Pago colaboradores' },
        { campo: 'transporte', titulo: 'Transporte' },
        { campo: 'margen', titulo: 'Margen' },
        { campo: 'pagado', titulo: 'Pagado' },
        { campo: 'notas', titulo: 'Notas' },
      ],
    },
    {
      titulo: 'POR CLIENTE',
      filas: porCliente,
      columnas: [
        { campo: 'cliente', titulo: 'Cliente' },
        { campo: 'servicios', titulo: 'Servicios' },
        { campo: 'horas', titulo: 'Horas' },
        { campo: 'facturado', titulo: 'Facturado' },
        { campo: 'margen', titulo: 'Margen' },
      ],
    },
    {
      titulo: 'POR COLABORADOR',
      filas: porColaborador,
      columnas: [
        { campo: 'colaborador', titulo: 'Colaborador' },
        { campo: 'servicios', titulo: 'Servicios' },
        { campo: 'horas', titulo: 'Horas' },
        { campo: 'pago', titulo: 'Pagado' },
      ],
    },
    {
      titulo: 'GASTOS DE EMPRESA',
      filas: gastos,
      columnas: [
        { campo: 'fecha', titulo: 'Fecha' },
        { campo: 'comercio', titulo: 'Comercio' },
        { campo: 'concepto', titulo: 'Concepto' },
        { campo: 'importe', titulo: 'Importe' },
      ],
    },
    {
      titulo: 'COSTES FIJOS',
      filas: fijos,
      columnas: [
        { campo: 'concepto', titulo: 'Concepto' },
        { campo: 'importe', titulo: 'Importe' },
      ],
    },
    {
      titulo: 'CIERRE DEL MES',
      filas: cierre,
      columnas: [
        { campo: 'concepto', titulo: 'Concepto' },
        { campo: 'importe', titulo: 'Importe' },
      ],
    },
  ]);

  return respuestaCSV(texto, `limpiezas-el-imperio-${periodo}.csv`);
}
