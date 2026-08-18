import { aCSV, respuestaCSV } from '../../../../lib/csv.js';
import { consultar } from '../../../../lib/db.js';
import { exigirSesion } from '../../../../lib/sesion.js';

export const dynamic = 'force-dynamic';

/**
 * Descarga de cada tabla en CSV.
 *
 *   /api/exportar/servicios
 *   /api/exportar/servicios?periodo=2026-08
 *
 * Las consultas están escritas una a una en vez de generarse a partir del
 * nombre de la tabla: así se elige qué columnas salen y con qué título, se
 * resuelven los id a nombres —un CSV con «cliente_id: 47» no le sirve a nadie—
 * y no hay forma de que llegue a la base un nombre de tabla venido de la URL.
 *
 * Todas leen de `v_servicios`, NUNCA de `servicios`. Un borrador es una
 * propuesta que él no ha validado y no cuenta para nada hasta que la confirma;
 * exportarlo mete facturación inventada en un archivo que se abre en Excel y ya
 * no recuerda de dónde salió. Aquí se leía la tabla a pelo y por ahí se colaban.
 */
const TABLAS = {
  servicios: {
    archivo: 'servicios',
    columnas: [
      { campo: 'periodo', titulo: 'Mes' },
      { campo: 'fecha', titulo: 'Fecha' },
      { campo: 'hora', titulo: 'Hora' },
      { campo: 'cliente_id', titulo: 'Nº cliente' },
      { campo: 'cliente', titulo: 'Cliente' },
      { campo: 'direccion', titulo: 'Dirección' },
      { campo: 'colaboradores', titulo: 'Colaboradores' },
      { campo: 'horas', titulo: 'Horas' },
      { campo: 'personas', titulo: 'Personas' },
      { campo: 'valor', titulo: 'Valor' },
      { campo: 'pago_colab', titulo: 'Pago colaboradores' },
      { campo: 'transporte', titulo: 'Transporte' },
      { campo: 'margen', titulo: 'Margen' },
      { campo: 'pagado', titulo: 'Pagado' },
      { campo: 'notas', titulo: 'Notas' },
      { campo: 'origen', titulo: 'Origen en el Excel' },
    ],
    sql: `
      SELECT s.periodo, s.fecha, s.hora, s.cliente_id, c.nombre AS cliente, c.direccion,
             (SELECT GROUP_CONCAT(co.nombre, ', ') FROM servicio_colaborador sc
                JOIN colaboradores co ON co.id = sc.colaborador_id
               WHERE sc.servicio_id = s.id) AS colaboradores,
             s.horas, s.personas, s.valor, s.pago_colab, s.transporte, s.margen,
             CASE s.pagado WHEN 1 THEN 'sí' ELSE 'no' END AS pagado,
             s.notas, s.origen
        FROM v_servicios s
        JOIN clientes c ON c.id = s.cliente_id
       WHERE (?1 = '' OR s.periodo = ?1)
       ORDER BY s.periodo, s.fecha, s.id`,
  },

  clientes: {
    archivo: 'clientes',
    columnas: [
      { campo: 'id', titulo: 'Nº' },
      { campo: 'nombre', titulo: 'Cliente' },
      { campo: 'direccion', titulo: 'Dirección' },
      { campo: 'telefono', titulo: 'Teléfono' },
      { campo: 'servicios', titulo: 'Servicios' },
      { campo: 'horas', titulo: 'Horas' },
      { campo: 'facturado', titulo: 'Facturado' },
      { campo: 'margen', titulo: 'Margen' },
      { campo: 'ultimo', titulo: 'Último servicio' },
      { campo: 'notas', titulo: 'Notas' },
    ],
    sql: `
      SELECT c.id, c.nombre, c.direccion, c.telefono, c.notas,
             COUNT(s.id) AS servicios,
             COALESCE(SUM(s.horas), 0)  AS horas,
             COALESCE(SUM(s.valor), 0)  AS facturado,
             COALESCE(SUM(s.margen), 0) AS margen,
             MAX(s.fecha) AS ultimo
        FROM clientes c
        LEFT JOIN v_servicios s ON s.cliente_id = c.id AND (?1 = '' OR s.periodo = ?1)
       GROUP BY c.id
       ORDER BY margen DESC, c.nombre`,
  },

  colaboradores: {
    archivo: 'colaboradores',
    columnas: [
      { campo: 'id', titulo: 'Nº' },
      { campo: 'nombre', titulo: 'Colaborador' },
      { campo: 'telefono', titulo: 'Teléfono' },
      { campo: 'servicios', titulo: 'Servicios' },
      { campo: 'horas', titulo: 'Horas' },
      { campo: 'pago', titulo: 'Pagado' },
      { campo: 'ultimo', titulo: 'Último servicio' },
    ],
    sql: `
      SELECT co.id, co.nombre, co.telefono,
             COUNT(s.id) AS servicios,
             COALESCE(SUM(s.horas / (SELECT COUNT(*) FROM servicio_colaborador x
                                      WHERE x.servicio_id = s.id)), 0) AS horas,
             -- El pago cuelga de servicio_colaborador, que el filtro de mes NO
             -- toca: va en el JOIN con los servicios. Sumar sc.pago a secas
             -- daba lo cobrado en TODOS los meses junto a los de uno solo.
             COALESCE(SUM(CASE WHEN s.id IS NULL THEN 0 ELSE sc.pago END), 0) AS pago,
             MAX(s.fecha) AS ultimo
        FROM colaboradores co
        LEFT JOIN servicio_colaborador sc ON sc.colaborador_id = co.id
        LEFT JOIN v_servicios s ON s.id = sc.servicio_id AND (?1 = '' OR s.periodo = ?1)
       GROUP BY co.id
       ORDER BY pago DESC, co.nombre`,
  },

  gastos: {
    archivo: 'gastos',
    columnas: [
      { campo: 'periodo', titulo: 'Mes' },
      { campo: 'fecha', titulo: 'Fecha' },
      { campo: 'comercio', titulo: 'Comercio' },
      { campo: 'concepto', titulo: 'Concepto' },
      { campo: 'importe', titulo: 'Importe' },
    ],
    sql: `
      SELECT periodo, fecha, comercio, concepto, importe
        FROM gastos
       WHERE (?1 = '' OR periodo = ?1)
       ORDER BY periodo, id`,
  },

  meses: {
    archivo: 'meses',
    columnas: [
      { campo: 'periodo', titulo: 'Mes' },
      { campo: 'servicios', titulo: 'Servicios' },
      { campo: 'horas', titulo: 'Horas' },
      { campo: 'facturado', titulo: 'Facturado' },
      { campo: 'pagoColab', titulo: 'Pago colaboradores' },
      { campo: 'transporte', titulo: 'Transporte' },
      { campo: 'margen', titulo: 'Margen' },
      { campo: 'gastos', titulo: 'Gastos' },
      { campo: 'fijos', titulo: 'Costes fijos' },
      { campo: 'segSoc', titulo: 'Seguridad social' },
      { campo: 'gestoria', titulo: 'Gestoría' },
      { campo: 'ivaIrpf', titulo: 'IVA/IRPF' },
      { campo: 'resultado', titulo: 'Resultado' },
    ],
    sql: `
      SELECT s.periodo, COUNT(*) AS servicios, SUM(s.horas) AS horas,
             SUM(s.valor) AS facturado, SUM(s.pago_colab) AS pagoColab,
             SUM(s.transporte) AS transporte, SUM(s.margen) AS margen,
             COALESCE(g.gastos, 0) AS gastos, COALESCE(f.fijos, 0) AS fijos,
             COALESCE(c.seg_soc, 0) AS segSoc, COALESCE(c.gestoria, 0) AS gestoria,
             COALESCE(c.iva_irpf, 0) AS ivaIrpf,
             SUM(s.margen) - COALESCE(g.gastos, 0) - COALESCE(f.fijos, 0)
               - COALESCE(c.seg_soc, 0) - COALESCE(c.gestoria, 0)
               - COALESCE(c.iva_irpf, 0) AS resultado
        FROM v_servicios s
        LEFT JOIN (SELECT periodo, SUM(importe) AS gastos FROM gastos GROUP BY periodo) g
               ON g.periodo = s.periodo
        LEFT JOIN (SELECT periodo, SUM(importe) AS fijos FROM costes_fijos GROUP BY periodo) f
               ON f.periodo = s.periodo
        LEFT JOIN cierres c ON c.periodo = s.periodo
       WHERE (?1 = '' OR s.periodo = ?1)
       GROUP BY s.periodo
       ORDER BY s.periodo`,
  },
};

export async function GET(peticion, { params }) {
  await exigirSesion();

  const { tabla } = await params;
  const def = TABLAS[tabla];
  if (!def) {
    return new Response(
      `No se exporta «${tabla}». Disponibles: ${Object.keys(TABLAS).join(', ')}.`,
      { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const periodo = new URL(peticion.url).searchParams.get('periodo') ?? '';
  if (periodo && !/^\d{4}-\d{2}$/.test(periodo)) {
    return new Response('El mes tiene que ir como 2026-08.',
      { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const filas = await consultar(def.sql, [periodo]);
  const nombre = `${def.archivo}${periodo ? `-${periodo}` : ''}.csv`;

  return respuestaCSV(aCSV(filas, def.columnas), nombre);
}
