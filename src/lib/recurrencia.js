/**
 * Detección de lo que se repite cada semana, para adelantar el mes siguiente.
 *
 * El negocio es rutinario: una limpiadora va a casa de un cliente todos los
 * lunes, y el mes que viene irá otra vez todos los lunes. Frank lleva dos años
 * reescribiendo eso a mano, fila por fila. Esto lo propone y él lo corrige.
 *
 * Cómo se decide qué es recurrente, mirando el mes de origen:
 *
 *   1. Se agrupa por cliente y día de la semana.
 *   2. Se cuenta cuántas veces cae ese día en el mes (los meses tienen 4 o 5
 *      viernes, y eso cambia el resultado).
 *   3. `repeticiones = redondeo(servicios / veces que cae el día)`. Así un
 *      cliente con 13 servicios en viernes sobre 5 viernes genera 3 por viernes,
 *      que es lo que de verdad pasa en una finca con varios portales.
 *   4. Se descarta lo que sólo ocurrió una vez: un servicio suelto no es una
 *      rutina, y proponerlo es meterle basura que tiene que borrar.
 *
 * Qué se copia y qué NO:
 *
 *   · Importe, horas y hora del servicio: el valor más repetido. Si el cliente
 *     paga 55 € casi siempre, se propone 55 €.
 *
 *   · Quién lo hizo: **sólo si hay una persona claramente habitual**. En los
 *     datos reales un mismo cliente rota entre tres y cinco personas distintas
 *     en un mes; rellenarlo a ciegas sería adivinar mal la mayoría de las veces,
 *     y corregir es más trabajo que escribir. Cuando no hay una clara, la fila
 *     sale sin asignar y él pone a quien toque.
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Día de la semana de '2026-08-14', sin líos de zona horaria. */
export function diaSemana(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export const nombreDia = (n) => DIAS[n] ?? '?';

/** Todas las fechas de un mes ('2026-09') como ['2026-09-01', …]. */
export function fechasDelMes(periodo) {
  const [a, m] = String(periodo).split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: ultimo }, (_, i) =>
    `${a}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}

/** Cuántas veces cae cada día de la semana en ese mes. */
export function vecesPorDia(periodo) {
  const cuenta = new Array(7).fill(0);
  for (const f of fechasDelMes(periodo)) cuenta[diaSemana(f)]++;
  return cuenta;
}

/** Valor más repetido de una lista; a empate, el mayor. Ignora null. */
function moda(valores) {
  const cuenta = new Map();
  for (const v of valores) {
    if (v == null || v === '') continue;
    cuenta.set(v, (cuenta.get(v) || 0) + 1);
  }
  if (!cuenta.size) return null;
  return [...cuenta].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0][0];
}

/**
 * Persona habitual de un grupo de servicios, o null si no hay una clara.
 *
 * Exige mayoría amplia y al menos dos apariciones: con menos, proponer un
 * nombre es adivinar.
 */
function colaboradorHabitual(listas) {
  const conAlguien = listas.filter((l) => l.length > 0);
  if (conAlguien.length < 2) return null;

  // Sólo se propone cuando el servicio lo hace una persona sola: si suelen ir
  // dos, cuáles son las dos es justo lo que cambia cada semana.
  const individuales = conAlguien.filter((l) => l.length === 1);
  if (individuales.length < conAlguien.length * 0.6) return null;

  const cuenta = new Map();
  for (const [id] of individuales) cuenta.set(id, (cuenta.get(id) || 0) + 1);
  const [mejorId, veces] = [...cuenta].sort((a, b) => b[1] - a[1])[0];

  return veces >= 2 && veces >= individuales.length * 0.6 ? mejorId : null;
}

/**
 * Analiza un mes y propone los servicios del siguiente.
 *
 * @param {Array} servicios  del mes de origen: { clienteId, cliente, fecha,
 *                           horas, valor, pagoColab, transporte, hora,
 *                           colaboradores: number[] }
 * @param {string} origen    '2026-08'
 * @param {string} destino   '2026-09'
 * @returns {{propuestas: Array, pautas: Array, descartados: Array, resumen: object}}
 */
export function proponerMes(servicios, origen, destino) {
  const vecesOrigen = vecesPorDia(origen);

  // ── Agrupar por cliente + día de la semana ────────────────────────────────
  const grupos = new Map();
  for (const s of servicios) {
    if (!s.fecha || !s.fecha.startsWith(origen)) continue;
    const dia = diaSemana(s.fecha);
    const clave = `${s.clienteId}|${dia}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, { clienteId: s.clienteId, cliente: s.cliente, dia, servicios: [] });
    }
    grupos.get(clave).servicios.push(s);
  }

  const pautas = [];
  const descartados = [];

  for (const g of grupos.values()) {
    const n = g.servicios.length;

    if (n < 2) {
      descartados.push({
        cliente: g.cliente,
        dia: nombreDia(g.dia),
        motivo: 'ocurrió una sola vez: no parece una rutina',
      });
      continue;
    }

    const caidas = vecesOrigen[g.dia] || 1;
    const repeticiones = Math.max(1, Math.round(n / caidas));

    pautas.push({
      clienteId: g.clienteId,
      cliente: g.cliente,
      dia: g.dia,
      nombreDia: nombreDia(g.dia),
      repeticiones,
      vecesEnOrigen: n,
      // «4 de 4 viernes» es una rutina firme; «3 de 5» es irregular y conviene
      // que lo mire.
      firme: n >= caidas * repeticiones,
      valor: Number(moda(g.servicios.map((s) => s.valor))) || 0,
      horas: Number(moda(g.servicios.map((s) => s.horas))) || 0,
      pagoColab: Number(moda(g.servicios.map((s) => s.pagoColab))) || 0,
      transporte: Number(moda(g.servicios.map((s) => s.transporte))) || 0,
      hora: moda(g.servicios.map((s) => s.hora)) || '',
      colaborador: colaboradorHabitual(g.servicios.map((s) => s.colaboradores ?? [])),
    });
  }

  // ── Proyectar sobre el mes destino ────────────────────────────────────────
  const propuestas = [];
  for (const fecha of fechasDelMes(destino)) {
    const dia = diaSemana(fecha);
    for (const p of pautas) {
      if (p.dia !== dia) continue;
      for (let i = 0; i < p.repeticiones; i++) {
        propuestas.push({
          periodo: destino,
          fecha,
          hora: p.hora,
          clienteId: p.clienteId,
          cliente: p.cliente,
          horas: p.horas,
          valor: p.valor,
          pagoColab: p.pagoColab,
          transporte: p.transporte,
          colaborador: p.colaborador,
          // Se arrastra para poder enseñar en la revisión de qué pauta sale
          // cada fila. NO se marca `revisar`: la fila ya es un borrador, y
          // ensuciar esa marca dejaría medio mes señalado para siempre después
          // de confirmarlo.
          firme: p.firme,
          vecesEnOrigen: p.vecesEnOrigen,
        });
      }
    }
  }

  propuestas.sort((a, b) => a.fecha.localeCompare(b.fecha)
    || a.cliente.localeCompare(b.cliente, 'es'));

  return {
    propuestas,
    pautas: pautas.sort((a, b) => a.dia - b.dia
      || a.cliente.localeCompare(b.cliente, 'es')),
    descartados,
    resumen: {
      origen,
      destino,
      serviciosOrigen: servicios.filter((s) => s.fecha?.startsWith(origen)).length,
      pautas: pautas.length,
      irregulares: pautas.filter((p) => !p.firme).length,
      conColaborador: pautas.filter((p) => p.colaborador).length,
      descartados: descartados.length,
      propuestas: propuestas.length,
      valor: Math.round(propuestas.reduce((a, p) => a + p.valor, 0) * 100) / 100,
    },
  };
}
