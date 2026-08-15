/**
 * Contraste del parser contra el libro real, fuera del navegador.
 *
 *   node scripts/verificar.mjs "../docs/contabilidad ... .xlsx"
 *
 * Usa exactamente los mismos módulos que la aplicación, así que si esto cuadra,
 * la pantalla cuadra. El archivo del cliente nunca se copia ni se versiona: se
 * lee de la ruta que se le pase.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { analizarLibro } from '../src/lib/parser.js';
import { agrupar } from '../src/lib/agrupar.js';
import { construirMetricas } from '../src/lib/metricas.js';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node scripts/verificar.mjs <ruta-al-xlsx> [--nombres]');
  process.exit(1);
}

/**
 * Los clientes contra los que se contrastan los márgenes son nombres reales del
 * libro, así que no viven en el repositorio. Se leen de un archivo local que
 * .gitignore excluye; si no existe, esa comprobación simplemente no se ejecuta.
 *
 *   app/scripts/referencia.local.json → { "clientes": ["...", "..."] }
 */
function clientesDeReferencia() {
  const local = new URL('./referencia.local.json', import.meta.url);
  try {
    return JSON.parse(fs.readFileSync(local, 'utf8')).clientes ?? [];
  } catch {
    return [];
  }
}

const eur = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const esperado = {
  servicios: 901,
  hojasImportadas: 7,
  hojasOmitidas: 14,
  facturado: 75262.60,
  clientesBrutos: 151,
  clientesClusters: 129,
  clientesRevision: 18,
  colabBrutos: 157,
  colabClusters: 92,
  colabRevision: 29,
  avisosAnio: 67,
  pagoColabConAsignacion: 43244,
};

const fallos = [];
const desvios = [];

/**
 * `estricto` marca las cifras que DEBEN cuadrar al céntimo: son las que salen
 * del libro sin criterio interpretable de por medio. Las de agrupación se
 * contrastan igual, pero una diferencia ahí es una decisión distinta sobre
 * nombres ambiguos, no un fallo de lectura.
 */
function comprobar(etiqueta, obtenido, esperadoVal, tolerancia = 0, estricto = true) {
  const num = typeof obtenido === 'number';
  const ok = num ? Math.abs(obtenido - esperadoVal) <= tolerancia : obtenido === esperadoVal;
  const marca = ok ? '  ok  ' : (estricto ? ' FALLA' : ' ~~~~ ');
  const fmt = (v) => (num && !Number.isInteger(v) ? v.toFixed(2) : String(v));
  const dif = ok || !num ? '' : `   (${obtenido > esperadoVal ? '+' : ''}${obtenido - esperadoVal})`;
  console.log(`${marca} │ ${etiqueta.padEnd(42)} ${fmt(obtenido).padStart(12)}   ref ${fmt(esperadoVal)}${dif}`);
  if (!ok) (estricto ? fallos : desvios).push(`${etiqueta}: ${fmt(obtenido)} frente a ${fmt(esperadoVal)}`);
}

// ── Lectura ────────────────────────────────────────────────────────────────
const datos = new Uint8Array(fs.readFileSync(path.resolve(ruta)));
const { hojas, servicios, avisos } = analizarLibro(datos, XLSX);

const importadas = hojas.filter((h) => h.estado === 'importada');
const omitidas = hojas.filter((h) => h.estado === 'omitida');

console.log('\n── HOJAS ──────────────────────────────────────────────────────────');
for (const h of importadas) {
  console.log(`  importada  ${h.nombre.padEnd(28)} ${String(h.servicios).padStart(4)} servicios` +
    `  cab.fila ${h.filaCabecera}` +
    (h.columnasFaltantes.length ? `  ·  sin columna: ${h.columnasFaltantes.join(', ')}` : ''));
}
for (const h of omitidas) {
  console.log(`  omitida    ${h.nombre.padEnd(28)} ${h.motivo}`);
}

// ── Agrupación ─────────────────────────────────────────────────────────────
const agClientes = agrupar(servicios.map((s) => s.cliente));
const agColab = agrupar(servicios.flatMap((s) => s.colaboradores));

// Por defecto, toda propuesta viene aceptada: es más barato desmarcar que marcar.
const aceptClientes = new Set(agClientes.propuestas.map((p) => p.id));
const aceptColab = new Set(agColab.propuestas.map((p) => p.id));

const resClientes = agClientes.aplicar(aceptClientes);
const resColab = agColab.aplicar(aceptColab);

const metricas = construirMetricas(servicios, resClientes.mapa, resColab.mapa);

// ── Contraste ──────────────────────────────────────────────────────────────
console.log('\n── LECTURA DEL LIBRO (debe cuadrar exactamente) ───────────────────');
comprobar('hojas importadas', importadas.length, esperado.hojasImportadas);
comprobar('hojas omitidas', omitidas.length, esperado.hojasOmitidas);
comprobar('servicios', servicios.length, esperado.servicios);
comprobar('total facturado', metricas.totales.valor, esperado.facturado, 0.01);
comprobar('avisos de año discrepante',
  avisos.filter((a) => a.tipo === 'anio_discrepante').length, esperado.avisosAnio);

// ── Cuadre del reparto de pagos ────────────────────────────────────────────
console.log('  ─');
const pagoConAsignacion = servicios
  .filter((s) => s.colaboradores.length > 0)
  .reduce((a, s) => a + s.pagoColab, 0);
const sumaReparto = metricas.porColaborador.reduce((a, t) => a + t.pago, 0);

comprobar('pago_colab en servicios con colaborador', pagoConAsignacion, esperado.pagoColabConAsignacion, 0.01);
comprobar('suma del reparto proporcional', sumaReparto, esperado.pagoColabConAsignacion, 0.01);
comprobar('descuadre del reparto', Math.abs(sumaReparto - pagoConAsignacion), 0, 0.005);

// ── Agrupación de nombres (criterio, no lectura) ───────────────────────────
console.log('\n── AGRUPACIÓN DE NOMBRES (criterio, no lectura) ───────────────────');
comprobar('clientes: cadenas brutas', agClientes.variantesBrutas, esperado.clientesBrutos);
comprobar('clientes: familias a revisar', agClientes.propuestas.length, esperado.clientesRevision, 0, false);
comprobar('clientes: clusters finales', resClientes.clusters.length, esperado.clientesClusters, 0, false);
console.log('  ─');
comprobar('colaboradores: cadenas brutas', agColab.variantesBrutas, esperado.colabBrutos);
comprobar('colaboradores: familias a revisar', agColab.propuestas.length, esperado.colabRevision, 0, false);
comprobar('colaboradores: clusters finales', resColab.clusters.length, esperado.colabClusters, 0, false);

// ── Comprobación de sentido sobre los márgenes ─────────────────────────────
const referencia = clientesDeReferencia();
if (referencia.length) {
  console.log('\n── MÁRGENES DE REFERENCIA ─────────────────────────────────────────');
  const buscar = (frag) => metricas.porCliente.find((c) => c.cliente.toUpperCase().includes(frag));
  for (const frag of referencia) {
    const c = buscar(String(frag).toUpperCase());
    if (!c) { console.log(`  ?  ${frag}: no encontrado`); fallos.push(`cliente ${frag} ausente`); continue; }
    const pct = c.valor ? (c.margen / c.valor) * 100 : 0;
    console.log(`  ${c.cliente.padEnd(24)} ${String(c.servicios).padStart(3)} serv  ` +
      `factura ${eur(c.valor).padStart(12)}  margen ${eur(c.margen).padStart(12)}  ${pct.toFixed(1).padStart(6)}%`);
  }
} else {
  console.log('\n── MÁRGENES DE REFERENCIA ─────────────────────────────────────────');
  console.log('  (omitido: no hay scripts/referencia.local.json con la lista de clientes)');
}

console.log('\n── TOTALES ────────────────────────────────────────────────────────');
console.log(`  facturado        ${eur(metricas.totales.valor).padStart(14)}`);
console.log(`  pago colab.      ${eur(metricas.totales.pagoColab).padStart(14)}`);
console.log(`  transporte       ${eur(metricas.totales.transporte).padStart(14)}`);
console.log(`  otros gastos     ${eur(metricas.totales.gasto).padStart(14)}`);
console.log(`  margen           ${eur(metricas.totales.margen).padStart(14)}`);

console.log('');
console.log(fallos.length
  ? `✗ LECTURA: ${fallos.length} cifra(s) sin cuadrar:\n   - ` + fallos.join('\n   - ')
  : '✓ LECTURA: todas las cifras del libro cuadran exactamente.');

console.log(desvios.length
  ? `\n~ AGRUPACIÓN: ${desvios.length} desviación(es) frente a la referencia:\n   - ` +
    desvios.join('\n   - ') +
    '\n  Son decisiones distintas sobre nombres ambiguos, no errores de lectura.' +
    '\n  Ejecuta con --nombres para ver cada familia propuesta.'
  : '\n✓ AGRUPACIÓN: coincide con la referencia.');

if (process.argv.includes('--nombres')) {
  for (const [etiqueta, ag] of [['CLIENTES', agClientes], ['COLABORADORES', agColab]]) {
    console.log(`\n── FAMILIAS PROPUESTAS · ${etiqueta} (${ag.propuestas.length}) ──`);
    for (const p of ag.propuestas) {
      console.log(`${p.confianza === 'baja' ? '  ⚠ ' : '    '}${p.canonico}  ←  ` +
        p.miembros.map((m) => `${m.nombre}(${m.usos})`).join('  ·  ') +
        `   [${p.motivos.join('+')}]`);
    }
  }
}

console.log('');
process.exit(fallos.length ? 1 : 0);
