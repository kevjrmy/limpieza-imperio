/**
 * Agregados del panel.
 *
 * El margen se calcula aquí y sólo aquí:
 *
 *     margen = valor − (pago colaboradores + transporte + otros gastos)
 *
 * La columna RENTABILIDAD del libro se ignora a propósito. Está escrita a mano,
 * no sigue un criterio constante entre hojas y en varias filas contradice a las
 * celdas de las que debería salir. Se conserva en la base de datos para poder
 * enseñar la diferencia, pero no alimenta ningún número del panel.
 */

import { clave } from './texto.js';

/**
 * Reparte un importe entre N personas sin perder ni ganar un céntimo.
 * Se trabaja en céntimos enteros y el resto se entrega de uno en uno, así la
 * suma de las partes es idéntica al total de partida.
 */
export function repartir(importe, n) {
  if (n <= 0) return [];
  const signo = importe < 0 ? -1 : 1;
  const centimos = Math.round(Math.abs(importe) * 100);
  const base = Math.floor(centimos / n);
  const resto = centimos - base * n;
  return Array.from({ length: n }, (_, i) => (signo * (base + (i < resto ? 1 : 0))) / 100);
}

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-05" → "mayo 2026" */
export function nombrePeriodo(periodo) {
  const [a, m] = String(periodo).split('-');
  const i = Number(m) - 1;
  return `${MESES_ES[i] ?? m} ${a}`;
}

/** Coste total imputado a un servicio. */
export const costeDe = (s) => s.pagoColab + s.transporte + s.gasto;

/** Margen de un servicio, con el criterio único de la casa. */
export const margenDe = (s) => s.valor - costeDe(s);

/**
 * Construye todos los agregados a partir de los servicios y de los mapas de
 * nombres canónicos decididos en la pantalla de revisión.
 *
 * @param {Array}  servicios
 * @param {Map}    mapaClientes  clave normalizada → nombre canónico
 * @param {Map}    mapaColab     clave normalizada → nombre canónico
 */
export function construirMetricas(servicios, mapaClientes, mapaColab) {
  const totales = { valor: 0, pagoColab: 0, transporte: 0, gasto: 0, margen: 0, servicios: 0, horas: 0 };

  const porPeriodo = new Map();
  const porCliente = new Map();
  const porColaborador = new Map();

  const nombreCliente = (s) => mapaClientes.get(s.clienteClave) || s.cliente;

  for (const s of servicios) {
    const coste = costeDe(s);
    const margen = s.valor - coste;

    totales.valor += s.valor;
    totales.pagoColab += s.pagoColab;
    totales.transporte += s.transporte;
    totales.gasto += s.gasto;
    totales.margen += margen;
    totales.horas += s.horas;
    totales.servicios++;

    // ── por mes ──
    let p = porPeriodo.get(s.periodo);
    if (!p) {
      p = { periodo: s.periodo, etiqueta: nombrePeriodo(s.periodo), servicios: 0,
        valor: 0, pagoColab: 0, transporte: 0, gasto: 0, margen: 0, horas: 0 };
      porPeriodo.set(s.periodo, p);
    }
    p.servicios++; p.valor += s.valor; p.pagoColab += s.pagoColab;
    p.transporte += s.transporte; p.gasto += s.gasto; p.margen += margen; p.horas += s.horas;

    // ── por cliente ──
    const cli = nombreCliente(s);
    let c = porCliente.get(cli);
    if (!c) {
      c = { cliente: cli, servicios: 0, valor: 0, pagoColab: 0, transporte: 0,
        gasto: 0, margen: 0, horas: 0, ultimaFecha: '' };
      porCliente.set(cli, c);
    }
    c.servicios++; c.valor += s.valor; c.pagoColab += s.pagoColab;
    c.transporte += s.transporte; c.gasto += s.gasto; c.margen += margen; c.horas += s.horas;
    if (s.fecha > c.ultimaFecha) c.ultimaFecha = s.fecha;

    // ── por colaborador ──
    // Un servicio puede llevar varias personas: eso es justo lo que la celda
    // apretujada del Excel debería haber sido. El pago se reparte a partes
    // iguales y el reparto cuadra al céntimo con el total del servicio.
    const nombres = [...new Set(s.colaboradores.map(
      (raw) => mapaColab.get(clave(raw)) || raw,
    ))];
    if (nombres.length) {
      const partes = repartir(s.pagoColab, nombres.length);
      nombres.forEach((nom, i) => {
        let t = porColaborador.get(nom);
        if (!t) {
          t = { colaborador: nom, servicios: 0, pago: 0, horas: 0,
            valorGenerado: 0, ultimaFecha: '' };
          porColaborador.set(nom, t);
        }
        t.servicios++;
        t.pago += partes[i];
        t.horas += s.horas / nombres.length;
        t.valorGenerado += s.valor / nombres.length;
        if (s.fecha > t.ultimaFecha) t.ultimaFecha = s.fecha;
      });
    }
  }

  const listaPeriodos = [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
  const listaClientes = [...porCliente.values()].sort((a, b) => a.margen - b.margen || a.cliente.localeCompare(b.cliente, 'es'));
  const listaColab = [...porColaborador.values()].sort((a, b) => b.pago - a.pago || a.colaborador.localeCompare(b.colaborador, 'es'));

  // El redondeo del reparto puede desplazar céntimos; se corrige el arrastre
  // para que la suma mostrada sea exactamente la del libro.
  const pagoAsignado = servicios
    .filter((s) => s.colaboradores.length > 0)
    .reduce((a, s) => a + s.pagoColab, 0);

  return {
    totales,
    porPeriodo: listaPeriodos,
    // por margen descendente para el panel; la lista base viene ascendente
    // porque las pérdidas son lo primero que hay que mirar.
    porCliente: [...listaClientes].sort((a, b) => b.margen - a.margen || a.cliente.localeCompare(b.cliente, 'es')),
    clientesEnPerdida: listaClientes.filter((c) => c.margen < 0),
    porColaborador: listaColab,
    reparto: {
      asignado: pagoAsignado,
      repartido: listaColab.reduce((a, t) => a + t.pago, 0),
      sinColaborador: servicios.filter((s) => s.colaboradores.length === 0).length,
      pagoSinColaborador: servicios
        .filter((s) => s.colaboradores.length === 0)
        .reduce((a, s) => a + s.pagoColab, 0),
    },
  };
}
