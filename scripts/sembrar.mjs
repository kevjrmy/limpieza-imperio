/**
 * Siembra la base a partir del libro modelo .ods.
 *
 *   npm run sembrar -- "docs/modelo limpiezas el imperio 2026.ods"
 *   npm run sembrar -- "…ods" --rehacer     (vacía las tablas antes)
 *
 * Sin `--rehacer` se niega a sembrar sobre una base que ya tiene servicios: no
 * hay nada peor que duplicar un año entero de contabilidad por ejecutar dos
 * veces el mismo comando.
 *
 * Al terminar contrasta lo insertado contra el propio .ods y contra las sumas
 * que el modelo trae calculadas. Si algo no cuadra, sale con error: una siembra
 * a medias es peor que ninguna.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';

import { cargarEntorno } from './entorno.mjs';
import { repartir } from '../src/lib/metricas.js';

cargarEntorno();

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const { db, urlBase, consultar, ejecutar, enLote } = await import('../src/lib/db.js');

/**
 * Ejecuta muchas sentencias en transacciones de 500.
 *
 * Una a una son 3.400 escrituras con su propio fsync, y sobre el archivo local
 * eso tarda minutos. En lote es cuestión de segundos, y además cada tanda entra
 * entera o no entra: no se queda a medias.
 */
async function insertar(sentencias, tam = 500) {
  for (let i = 0; i < sentencias.length; i += tam) {
    await enLote(sentencias.slice(i, i + tam));
  }
  return sentencias.length;
}

// ─────────────────────────────────────────────────────────────────────────────

const argumentos = process.argv.slice(2);
const rehacer = argumentos.includes('--rehacer');
const ruta = argumentos.find((a) => !a.startsWith('--'))
  ?? 'docs/modelo limpiezas el imperio 2026.ods';

if (!fs.existsSync(ruta)) {
  console.error(`No existe «${ruta}».`);
  console.error('Genéralo antes con:  npm run modelo -- "docs/<libro real>.xlsx"');
  process.exit(2);
}

const libro = XLSX.read(fs.readFileSync(ruta), { type: 'buffer' });
const hoja = (nombre) => {
  if (!libro.Sheets[nombre]) {
    console.error(`El .ods no tiene la hoja «${nombre}». ¿Es el libro modelo?`);
    process.exit(2);
  }
  return XLSX.utils.sheet_to_json(libro.Sheets[nombre], { defval: '' });
};

const num = (v) => (v === '' || v == null ? 0 : Number(v) || 0);
const txt = (v) => String(v ?? '').trim();
const dos = (n) => Math.round(n * 100) / 100;

// ── Salvaguarda contra la doble siembra ──────────────────────────────────────

const [{ n: yaHay }] = await consultar('SELECT COUNT(*) AS n FROM servicios');
if (yaHay > 0 && !rehacer) {
  console.error(`La base ya tiene ${yaHay} servicios. No se siembra encima.`);
  console.error('Si de verdad quieres reemplazarlos, repite con --rehacer.');
  process.exit(1);
}

const TABLAS = ['servicio_colaborador', 'servicios', 'gastos', 'costes_fijos',
  'cierres', 'avisos', 'fusiones', 'clientes', 'colaboradores'];

if (rehacer) {
  for (const t of TABLAS) await ejecutar(`DELETE FROM ${t}`);
  await ejecutar("DELETE FROM sqlite_sequence WHERE name IN " +
    `(${TABLAS.map(() => '?').join(',')})`, TABLAS);
  console.log(`Vaciadas ${TABLAS.length} tablas.`);
}

// ── Clientes y colaboradores ────────────────────────────────────────────────
// Van primero porque los servicios los referencian. No hace falta leer de
// vuelta los id que genera SQLite: cada fila conserva su `ref` del modelo
// (CLI-001) y las referencias se resuelven con una subconsulta sobre esa
// columna, que además es UNIQUE.

console.log(`\nSembrando ${urlBase()} desde «${ruta}»\n`);

const clientes = hoja('CLIENTES');
await insertar(clientes.map((f) => ({
  sql: 'INSERT INTO clientes (ref, nombre, direccion, telefono, notas) VALUES (?,?,?,?,?)',
  args: [txt(f.id), txt(f.nombre), txt(f.direccion), txt(f.telefono),
    txt(f.variantes) ? `También escrito: ${txt(f.variantes)}` : ''],
})));
console.log(`  clientes       ${clientes.length}`);

const colaboradores = hoja('COLABORADORES');
await insertar(colaboradores.map((f) => ({
  sql: 'INSERT INTO colaboradores (ref, nombre, notas) VALUES (?,?,?)',
  args: [txt(f.id), txt(f.nombre),
    txt(f.variantes) ? `También escrito: ${txt(f.variantes)}` : ''],
})));
console.log(`  colaboradores  ${colaboradores.length}`);

// ── Servicios ───────────────────────────────────────────────────────────────

const servicios = hoja('SERVICIOS');

const sinCliente = servicios.filter((f) => !clientes.some((c) => txt(c.id) === txt(f.cliente_id)));
if (sinCliente.length) {
  console.error(`${sinCliente.length} servicio(s) apuntan a un cliente que no está en la hoja CLIENTES, p. ej. ${txt(sinCliente[0].id)} → «${txt(sinCliente[0].cliente_id)}».`);
  process.exit(1);
}

await insertar(servicios.map((f) => ({
  sql: `INSERT INTO servicios
          (ref, periodo, fecha, hora, cliente_id, horas, personas, valor,
           pago_colab, transporte, pagado, revisar, origen)
        VALUES (?,?,?,?,(SELECT id FROM clientes WHERE ref = ?),?,?,?,?,?,?,?,?)`,
  args: [
    txt(f.id), txt(f.periodo), txt(f.fecha), txt(f.hora), txt(f.cliente_id),
    num(f.horas), f.personas === '' ? null : num(f.personas), num(f.valor),
    num(f.pago_colab), num(f.transporte),
    txt(f.pagado) === 'SI' ? 1 : 0,
    txt(f.revisar) === 'SI' ? 1 : 0,
    txt(f.origen),
  ],
})));
console.log(`  servicios      ${servicios.length}`);

// ── Quién hizo cada servicio ────────────────────────────────────────────────
// El .ods ya trae el reparto calculado, pero se recalcula aquí desde el pago
// del servicio en vez de copiarlo: así la tabla no depende de que esa columna
// del .ods estuviera bien.

const enlaces = hoja('SERVICIO_COLABORADOR');
const porServicio = new Map();
for (const e of enlaces) {
  const s = txt(e.servicio_id);
  if (!porServicio.has(s)) porServicio.set(s, []);
  porServicio.get(s).push(txt(e.colaborador_id));
}

const pagoDe = new Map(servicios.map((f) => [txt(f.id), num(f.pago_colab)]));
const sentenciasEnlace = [];
for (const [refServicio, refsColab] of porServicio) {
  const partes = repartir(pagoDe.get(refServicio) ?? 0, refsColab.length);
  refsColab.forEach((refColab, i) => {
    sentenciasEnlace.push({
      sql: `INSERT INTO servicio_colaborador (servicio_id, colaborador_id, pago)
            VALUES ((SELECT id FROM servicios WHERE ref = ?),
                    (SELECT id FROM colaboradores WHERE ref = ?), ?)`,
      args: [refServicio, refColab, partes[i]],
    });
  });
}
await insertar(sentenciasEnlace);
console.log(`  asignaciones   ${sentenciasEnlace.length}`);

// ── Gastos, costes fijos, cierres, avisos y fusiones ────────────────────────

const gastos = hoja('GASTOS');
await insertar(gastos.map((f) => ({
  sql: 'INSERT INTO gastos (ref, periodo, comercio, importe, origen) VALUES (?,?,?,?,?)',
  args: [txt(f.id), txt(f.periodo), txt(f.comercio), num(f.importe), txt(f.origen)],
})));
console.log(`  gastos         ${gastos.length}`);

const fijos = hoja('COSTES_FIJOS');
await insertar(fijos.map((f) => ({
  sql: 'INSERT INTO costes_fijos (ref, periodo, concepto, importe, origen) VALUES (?,?,?,?,?)',
  args: [txt(f.id), txt(f.periodo), txt(f.concepto), num(f.importe), txt(f.origen)],
})));
console.log(`  costes_fijos   ${fijos.length}`);

const meses = hoja('MESES');
await insertar(meses.map((f) => ({
  sql: `INSERT INTO cierres (periodo, seg_soc, gestoria, iva_irpf, facturado_libro, resultado_libro)
        VALUES (?,?,?,?,?,?)`,
  args: [txt(f.periodo), num(f.seg_soc), num(f.gestoria), num(f.iva_irpf),
    f.facturado_libro === '' ? null : num(f.facturado_libro),
    f.resultado_libro === '' ? null : num(f.resultado_libro)],
})));
console.log(`  cierres        ${meses.length}`);

const listaAvisos = hoja('AVISOS');
await insertar(listaAvisos.map((f) => ({
  sql: 'INSERT INTO avisos (ref, tipo, periodo, origen, detalle) VALUES (?,?,?,?,?)',
  args: [txt(f.id), txt(f.tipo), txt(f.periodo), txt(f.origen), txt(f.detalle)],
})));
console.log(`  avisos         ${listaAvisos.length}`);

const listaFusiones = hoja('FUSIONES_PROPUESTAS');
await insertar(listaFusiones.map((f) => ({
  sql: `INSERT INTO fusiones (ref, tabla, confianza, motivo, quedaria, absorberia, usos, ojo)
        VALUES (?,?,?,?,?,?,?,?)`,
  args: [txt(f.id), txt(f.tabla).toLowerCase(), txt(f.confianza), txt(f.motivo),
    txt(f.quedaria_como), txt(f.absorberia), num(f.usos), txt(f.ojo)],
})));
console.log(`  fusiones       ${listaFusiones.length}`);

// ── Contraste ───────────────────────────────────────────────────────────────
// Sembrar sin comprobar es sembrar a ciegas. Se contrasta lo que hay en la base
// contra lo que dice el .ods, no contra lo que este script creía estar haciendo.

const esperado = {
  clientes: clientes.length,
  colaboradores: colaboradores.length,
  servicios: servicios.length,
  facturado: dos(servicios.reduce((a, f) => a + num(f.valor), 0)),
  pagoColab: dos(servicios.reduce((a, f) => a + num(f.pago_colab), 0)),
  // Se recalcula desde las columnas que lo componen en vez de sumar la columna
  // `margen` del .ods. Esa viene redondeada a céntimos fila a fila; la base la
  // calcula exacta y luego redondea al enseñarla. Las dos salen de los mismos
  // importes, pero difieren en 0,15 € al año — y comparar contra la redondeada
  // haría fallar una siembra que está bien.
  margen: dos(servicios.reduce(
    (a, f) => a + num(f.valor) - num(f.pago_colab) - num(f.transporte), 0)),
  gastos: dos(gastos.reduce((a, f) => a + num(f.importe), 0)),
};

const [obtenido] = await consultar(`
  SELECT (SELECT COUNT(*) FROM clientes)              AS clientes,
         (SELECT COUNT(*) FROM colaboradores)         AS colaboradores,
         (SELECT COUNT(*) FROM servicios)             AS servicios,
         (SELECT ROUND(SUM(valor), 2) FROM servicios) AS facturado,
         (SELECT ROUND(SUM(pago_colab), 2) FROM servicios) AS pagoColab,
         (SELECT ROUND(SUM(margen), 2) FROM servicios)     AS margen,
         (SELECT ROUND(COALESCE(SUM(importe), 0), 2) FROM gastos) AS gastos`);

// El reparto tiene que cuadrar al céntimo con el pago de los servicios que
// llevan a alguien asignado.
const [rep] = await consultar(`
  SELECT ROUND((SELECT COALESCE(SUM(pago), 0) FROM servicio_colaborador), 2) AS repartido,
         ROUND((SELECT COALESCE(SUM(s.pago_colab), 0) FROM servicios s
                 WHERE EXISTS (SELECT 1 FROM servicio_colaborador x
                                WHERE x.servicio_id = s.id)), 2) AS asignado`);

console.log('\nCONTRASTE contra el .ods');
let fallos = 0;
for (const [campo, ref] of Object.entries(esperado)) {
  const val = Number(obtenido[campo]);
  const ok = Math.abs(val - ref) < 0.005;
  if (!ok) fallos++;
  console.log(`  ${ok ? 'ok  ' : 'FALLA'} │ ${campo.padEnd(14)} ${String(val).padStart(12)}   .ods ${ref}`);
}

const repartoOk = Math.abs(Number(rep.repartido) - Number(rep.asignado)) < 0.005;
if (!repartoOk) fallos++;
console.log(`  ${repartoOk ? 'ok  ' : 'FALLA'} │ ${'reparto'.padEnd(14)} ${String(rep.repartido).padStart(12)}   pago con colaborador ${rep.asignado}`);

if (fallos) {
  console.error(`\n${fallos} comprobación(es) no cuadran. La siembra NO es de fiar.`);
  process.exit(1);
}

console.log('\nTodo cuadra.\n');
await db().close?.();
