/**
 * Construye el libro modelo de 2026 en formato .ods a partir del libro real.
 *
 *   node scripts/modelo-2026.mjs "docs/<libro real>.xlsx" [salida.ods]
 *
 * El libro real son 85 pestañas de dos años, con dos maquetaciones, hojas por
 * colaborador, plantillas y siete hojas vacías. Este script se queda sólo con
 * 2026 y lo reescribe como una base de datos: una tabla de servicios, tablas de
 * clientes y colaboradores, y los gastos y los cierres de mes separados en sus
 * propias hojas en vez de apretujados dentro de las filas de servicio.
 *
 * Tres reglas gobiernan lo que hace y lo que NO hace:
 *
 *  1. No inventa ni corrige en silencio. Todo lo que no cuadra sale en la hoja
 *     AVISOS y queda marcado en la fila de origen. Cada fila conserva de dónde
 *     viene (hoja y número de fila del .xlsx) para poder volver al original.
 *
 *  2. No fusiona nombres por su cuenta. Los identificadores de cliente y de
 *     colaborador agrupan sólo lo idéntico al normalizar. Lo que "se parece" va
 *     a FUSIONES_PROPUESTAS para que una persona decida: agrupar de menos se
 *     arregla en pantalla, agrupar de más destruye datos.
 *
 *  3. No toca los importes tal y como se escribieron. Los valores de las celdas
 *     se copian como están; sólo los agregados que calcula este script se
 *     redondean a dos decimales.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { clave } from '../src/lib/texto.js';
import { agrupar } from '../src/lib/agrupar.js';
import { separarColaboradores } from '../src/lib/parser.js';
import { repartir } from '../src/lib/metricas.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────

const ANIO = 2026;

/** Cabecera que ancla la fila de títulos dentro de las primeras filas. */
const ANCLA = 'NOMBRE DEL CLIENTE';
const FILAS_ESCANEO = 20;

/**
 * Las dos maquetaciones que conviven en el libro, resueltas por texto de
 * cabecera. Nunca por índice: las columnas se mueven de una hoja a otra.
 *
 * `hora` no apunta a la cabecera HORA DEL SERVICIO por capricho: en la
 * maquetación de 2026 los valores van corridos una columna respecto a sus
 * títulos a partir de PAGADO, y la hora acaba bajo «PAGO DEL CLIENTE». Se toma
 * la columna cuyo CONTENIDO es una hora, y se deja constancia aquí.
 */
const MAQUETACIONES = {
  2026: {
    marcadores: ['VALOR DEL SERVICIO', 'COLABORADORES'],
    campos: {
      cliente: 'NOMBRE DEL CLIENTE',
      direccion: 'DIRECCION CLIENTE',
      telefono: 'TELEFONO',
      dia: 'DIA', mes: 'MES', anio: 'ANO',
      horas: 'NUMERO HORAS',
      personas: 'NUMERO PERSONAS',
      valor: 'VALOR DEL SERVICIO',
      rentabilidadLibro: 'RENTABILIDAD',
      colaboradores: 'COLABORADORES',
      pagado: 'DESCRIPCION DEL SERVICIO',   // contiene OK / PTE
      hora: 'PAGO DEL CLIENTE',             // contiene la hora del servicio
      pagoColab: 'PAGO COLABORADORES',
      transporte: 'TRANSPORTE',
      gasto: 'VALOR',                       // gasto de empresa, no del servicio
      comercio: 'COMERCIO',
    },
  },
  antigua: {
    marcadores: ['VALOR', 'HORAS', 'RESPONSABLE LIMPIEZA'],
    campos: {
      cliente: 'NOMBRE DEL CLIENTE',
      direccion: 'DIRECCION CLIENTE',
      telefono: 'TELEFONO',
      dia: 'DIA', mes: 'MES', anio: 'ANO',
      horas: 'HORAS',
      valor: 'VALOR',
      colaboradores: 'RESPONSABLE LIMPIEZA',
      pagado: 'PAGADO',
      hora: 'HORA',
      pagoColab: 'DINERO PAGADO',
      transporte: 'TRANSPORTE',
    },
  },
};

const MESES = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7,
  AGOSTO: 8, SEPTIEMBRE: 9, SEPT: 9, OCTUBRE: 10, NOVIEMBRE: 11, NOV: 11,
  DICIEMBRE: 12, DIC: 12,
};

const NOMBRE_MES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Etiquetas del bloque de cierre escrito a mano bajo la tabla. */
const ETIQUETAS_CIERRE = ['IVA-IRPF', 'SEG-SOC', 'GESTORIA', 'GASTOS', 'PAGOS'];

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

const texto = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());

/** Número tal y como está en la celda, o null si la celda no tiene número. */
function numero(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim().replace(/[€\s]/g, '').replace(',', '.');
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

const dos = (n) => Math.round(n * 100) / 100;

/**
 * Fracción de día de Excel → "HH:MM".
 * Devuelve null para lo que no es una hora: la columna arrastra números sueltos
 * ("55", "1500") y horas escritas a mano con punto y coma ("09;30").
 */
function comoHora(v) {
  const n = numero(v);
  if (n == null || n <= 0 || n >= 1) return null;
  const minutos = Math.round(n * 24 * 60);
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function periodoDeHoja(nombre) {
  const k = clave(nombre);
  const anio = (k.match(/\b(20\d{2})\b/) || [])[1];
  let mes = null;
  for (const [t, n] of Object.entries(MESES)) {
    if (new RegExp(`\\b${t}\\b`).test(k)) { mes = n; break; }
  }
  return { mes, anio: anio ? Number(anio) : null };
}

function buscarCabecera(filas) {
  for (let i = 0; i < Math.min(FILAS_ESCANEO, filas.length); i++) {
    for (const celda of filas[i] || []) if (clave(celda) === ANCLA) return i;
  }
  return -1;
}

function mapaColumnas(fila) {
  const mapa = new Map();
  (fila || []).forEach((celda, i) => {
    const k = clave(celda);
    if (k && !mapa.has(k)) mapa.set(k, i);
  });
  return mapa;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura
// ─────────────────────────────────────────────────────────────────────────────

const avisos = [];
const anotar = (tipo, periodo, origen, detalle) =>
  avisos.push({ tipo, periodo, origen, detalle });

/**
 * Lee el bloque escrito a mano que hay bajo la tabla: horas y facturación
 * totales, retenciones, seguridad social, gestoría, gastos y pagos del mes.
 * Es la contabilidad que él ya lleva; se conserva para poder contrastar contra
 * lo que sale de sumar las filas.
 */
function leerCierre(filas, desde, cols) {
  const cierre = {};
  const iHoras = cols.get('NUMERO HORAS') ?? cols.get('HORAS');
  const iValor = cols.get('VALOR DEL SERVICIO') ?? cols.get('VALOR');
  const totales = [];

  for (let r = desde; r < filas.length; r++) {
    const fila = filas[r] || [];
    for (let c = 0; c < fila.length; c++) {
      const k = clave(fila[c]);
      if (!k) continue;

      if (k === 'TOTAL HORAS') {
        cierre.horasLibro = numero(fila[iHoras]);
        cierre.facturadoLibro = numero(fila[iValor]);
        cierre.celdaFacturado = XLSX.utils.encode_cell({ r, c: iValor });
        continue;
      }
      if (ETIQUETAS_CIERRE.includes(k)) {
        for (let d = c + 1; d < fila.length; d++) {
          const n = numero(fila[d]);
          if (n != null) { cierre[k] = n; break; }
        }
        continue;
      }
      if (k === 'TOTAL') {
        for (let d = c + 1; d < fila.length; d++) {
          const n = numero(fila[d]);
          if (n != null) { totales.push(n); break; }
        }
      }
    }
  }

  // Hay dos «TOTAL» en el bloque: el primero es la facturación después de
  // retenciones y el último es el resultado del mes.
  if (totales.length) {
    cierre.netoLibro = totales[0];
    cierre.resultadoLibro = totales[totales.length - 1];
  }
  return cierre;
}

/**
 * Costes fijos anotados sueltos al pie de la hoja: un importe en la columna DIA
 * y el concepto a su derecha (161 BASURA, 123 LUZ, 800 ALQUILER). Sólo una hoja
 * los tiene, pero son gasto real de la empresa y se rescatan.
 */
function leerCostesFijos(filas, desde, cols) {
  const iDia = cols.get('DIA');
  const fijos = [];
  if (iDia == null) return fijos;

  for (let r = desde; r < filas.length; r++) {
    const fila = filas[r] || [];
    const importe = numero(fila[iDia]);
    const concepto = texto(fila[iDia + 1]);
    if (importe == null || !concepto) continue;
    if (clave(concepto).includes('TOTAL')) continue;
    fijos.push({ concepto, importe, fila: r + 1 });
  }
  return fijos;
}

/**
 * Explica por qué el total escrito en la hoja no coincide con la suma de sus
 * propias filas. Hay dos causas, y las dos son errores reales del libro:
 *
 *  · Un importe escrito como texto. Excel no lo suma y la casilla del total se
 *    queda corta sin que nada lo indique.
 *  · Un total montado a mano encadenando celdas (+Q133+Q62+Q39…) en vez de con
 *    SUM(). Basta que una referencia esté repetida para cobrar dos veces la
 *    misma fila.
 */
function explicarCierre(ws, hoja, periodo, filaCab, filaFin, iValor, celdaTotal) {
  const columna = XLSX.utils.encode_col(iValor);

  for (let r = filaCab + 1; r < filaFin; r++) {
    const celda = ws[`${columna}${r + 1}`];
    if (!celda || celda.t !== 's') continue;
    if (numero(celda.v) == null) continue;
    anotar('importe_como_texto', periodo, `${hoja}!${r + 1}`,
      `${celda.v} € escrito como texto: la hoja no lo suma en su propio total.`);
  }

  const formula = celdaTotal ? ws[celdaTotal]?.f : null;
  if (!formula || /SUM\s*\(/i.test(formula)) return;

  const refs = formula.match(new RegExp(`${columna}\\d+`, 'g')) || [];
  const cuenta = new Map();
  for (const ref of refs) cuenta.set(ref, (cuenta.get(ref) || 0) + 1);
  for (const [ref, n] of cuenta) {
    if (n < 2) continue;
    anotar('fila_contada_dos_veces', periodo, `${hoja}!${ref}`,
      `El total de la hoja suma ${ref} (${ws[ref]?.v} €) ${n} veces: está escrito encadenando celdas a mano, no con SUM().`);
  }
}

function leerLibro(ruta) {
  const libro = XLSX.read(fs.readFileSync(ruta), { type: 'buffer', cellDates: false, cellFormula: true });

  const hojas = [];
  const servicios = [];
  const gastos = [];
  const costesFijos = [];

  for (const nombreHoja of libro.SheetNames) {
    if (!clave(nombreHoja).startsWith('CLIENTES')) continue;

    const { mes: mesHoja, anio: anioHoja } = periodoDeHoja(nombreHoja);
    if (anioHoja !== ANIO) continue;

    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], {
      header: 1, raw: true, defval: null, blankrows: true,
    });

    const nombre = texto(nombreHoja);
    const filaCab = buscarCabecera(filas);
    if (filaCab === -1) {
      anotar('hoja_ilegible', null, nombre, 'No se encontró la fila de cabecera.');
      continue;
    }

    const cols = mapaColumnas(filas[filaCab]);
    const maqueta = Object.entries(MAQUETACIONES)
      .find(([, m]) => m.marcadores.every((k) => cols.has(k)));
    if (!maqueta) {
      anotar('hoja_ilegible', null, nombre, 'Maquetación no reconocida.');
      continue;
    }
    const [nombreMaqueta, { campos }] = maqueta;

    const periodo = `${anioHoja}-${String(mesHoja).padStart(2, '0')}`;
    const idx = Object.fromEntries(
      Object.entries(campos).map(([campo, cab]) => [campo, cols.get(cab) ?? null]),
    );

    for (const [campo, i] of Object.entries(idx)) {
      if (i == null) {
        anotar('columna_ausente', periodo, nombre,
          `Sin columna «${campos[campo]}» (${campo}). Se toma como vacía en toda la hoja.`);
      }
    }

    const lee = (fila, campo) => (idx[campo] == null ? null : fila[idx[campo]]);

    let filaFin = filas.length;
    for (let r = filaCab + 1; r < filas.length; r++) {
      const dia = idx.dia == null ? null : (filas[r] || [])[idx.dia];
      if (dia != null && clave(dia).includes('TOTAL')) { filaFin = r; break; }
    }

    let vacias = 0;
    for (let r = filaCab + 1; r < filaFin; r++) {
      const fila = filas[r] || [];
      const origen = `${nombre}!${r + 1}`;

      // El gasto y el comercio van escritos en las filas de servicio pero no
      // pertenecen al servicio: son las compras del mes (supermercado, ferretería,
      // gafas) apuntadas donde había sitio. Se extraen antes de nada.
      const gasto = numero(lee(fila, 'gasto'));
      const comercio = texto(lee(fila, 'comercio'));
      if ((gasto != null && gasto !== 0) || comercio) {
        gastos.push({ periodo, importe: gasto ?? 0, comercio, origen });
        if (gasto == null || gasto === 0) {
          anotar('gasto_sin_importe', periodo, origen, `«${comercio}» sin importe.`);
        }
      }

      const valor = numero(lee(fila, 'valor')) ?? 0;
      const pagoColab = numero(lee(fila, 'pagoColab')) ?? 0;
      const transporte = numero(lee(fila, 'transporte')) ?? 0;

      // Las hojas arrastran unas 180 filas de relleno con ceros y sin nombre.
      // Una fila sin nombre PERO con dinero es otra cosa: es un servicio que ha
      // perdido a su cliente. No se puede imputar a nadie, así que se queda
      // fuera de SERVICIOS, pero se avisa: la hoja original sí lo suma.
      const cliente = texto(lee(fila, 'cliente'));
      if (!cliente) {
        vacias++;
        if (valor !== 0 || pagoColab !== 0) {
          anotar('fila_sin_cliente', periodo, origen,
            `Fila con ${valor} € facturados y ${pagoColab} € pagados pero sin nombre de cliente. Queda fuera del modelo; la hoja original la suma.`);
        }
        continue;
      }

      const dia = Math.trunc(numero(lee(fila, 'dia')) ?? 0) || null;
      const mesFila = Math.trunc(numero(lee(fila, 'mes')) ?? 0) || null;
      const anioFila = Math.trunc(numero(lee(fila, 'anio')) ?? 0) || null;

      const s = {
        periodo,
        maquetacion: nombreMaqueta,
        origen,
        cliente,
        direccion: texto(lee(fila, 'direccion')),
        telefono: texto(lee(fila, 'telefono')),
        dia, mes: mesFila, anio: anioFila,
        hora: comoHora(lee(fila, 'hora')),
        horas: numero(lee(fila, 'horas')) ?? 0,
        personas: numero(lee(fila, 'personas')),
        valor,
        pagoColab,
        transporte,
        rentabilidadLibro: numero(lee(fila, 'rentabilidadLibro')),
        colaboradoresTexto: texto(lee(fila, 'colaboradores')),
        colaboradores: separarColaboradores(lee(fila, 'colaboradores')),
        pagado: clave(lee(fila, 'pagado')) === 'OK' ? 'SI' : 'NO',
        revisar: false,
      };

      // La fecha se conserva tal cual está escrita. El mes contable es el de la
      // hoja, que es el que cuadra con el cierre; si la fila dice otra cosa se
      // avisa, no se toca.
      s.fecha = dia && mesFila && anioFila
        ? `${anioFila}-${String(mesFila).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        : '';

      // `fechaFiable` es la que se puede usar para saber cuándo se atendió a un
      // cliente. Una fecha que contradice a su propia hoja no sirve para eso,
      // pero se conserva en `fecha` tal y como está escrita.
      s.fechaFiable = s.fecha;
      if (!s.fecha) {
        s.revisar = true;
        s.fechaFiable = '';
        anotar('fecha_incompleta', periodo, origen,
          `${cliente}: día/mes/año incompletos (${dia}/${mesFila}/${anioFila}).`);
      } else if (anioFila !== anioHoja || mesFila !== mesHoja) {
        s.revisar = true;
        s.fechaFiable = '';
        anotar('fecha_fuera_de_mes', periodo, origen,
          `${cliente}: fecha ${s.fecha} en la hoja de ${NOMBRE_MES[mesHoja]} ${anioHoja}. Cuenta en ${periodo}.`);
      }

      if (valor === 0) {
        s.revisar = true;
        anotar('sin_importe', periodo, origen, `${cliente}: servicio sin valor facturado.`);
      }
      if (!s.colaboradores.length && pagoColab !== 0) {
        s.revisar = true;
        anotar('pago_sin_colaborador', periodo, origen,
          `${cliente}: ${pagoColab} € pagados sin nombre de colaborador.`);
      }
      if (s.personas != null && s.personas > 0 && s.colaboradores.length
          && s.personas !== s.colaboradores.length) {
        anotar('personas_no_cuadra', periodo, origen,
          `${cliente}: NUMERO PERSONAS = ${s.personas} pero ${s.colaboradores.length} nombre(s) en COLABORADORES.`);
      }

      servicios.push(s);
    }

    const cierre = leerCierre(filas, filaFin, cols);
    explicarCierre(libro.Sheets[nombreHoja], nombre, periodo, filaCab, filaFin,
      cols.get(campos.valor), cierre.celdaFacturado);

    for (const f of leerCostesFijos(filas, filaFin + 1, cols)) {
      costesFijos.push({ periodo, concepto: f.concepto, importe: f.importe,
        origen: `${nombre}!${f.fila}` });
    }

    hojas.push({ nombre, periodo, mes: mesHoja, maquetacion: nombreMaqueta, vacias, cierre });
  }

  hojas.sort((a, b) => a.periodo.localeCompare(b.periodo));
  gastos.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.origen.localeCompare(b.origen));
  costesFijos.sort((a, b) => a.periodo.localeCompare(b.periodo));
  servicios.sort((a, b) => a.periodo.localeCompare(b.periodo)
    || (a.fecha || '9').localeCompare(b.fecha || '9')
    || a.origen.localeCompare(b.origen));

  return { hojas, servicios, gastos, costesFijos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Identidades: sólo lo idéntico al normalizar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asigna un identificador estable a cada nombre distinto.
 *
 * Sólo agrupa lo que es idéntico tras normalizar (mayúsculas, acentos,
 * espacios). Lo que "se parece" no se toca aquí: sale en FUSIONES_PROPUESTAS.
 */
function identidades(apariciones, prefijo) {
  const g = agrupar(apariciones);
  const grupos = [...g.gruposExactos]
    .sort((a, b) => b.usos - a.usos || a.clave.localeCompare(b.clave, 'es'));

  const porClave = new Map();
  grupos.forEach((grupo, i) => {
    porClave.set(grupo.clave, {
      id: `${prefijo}-${String(i + 1).padStart(3, '0')}`,
      nombre: grupo.canonico,
      variantes: [...grupo.variantes.keys()],
      usos: grupo.usos,
    });
  });

  return { porClave, propuestas: g.propuestas };
}

/** Valor más repetido de una lista, ignorando los vacíos. */
function masFrecuente(valores) {
  const cuenta = new Map();
  for (const v of valores) {
    const t = texto(v);
    if (!t) continue;
    cuenta.set(t, (cuenta.get(t) || 0) + 1);
  }
  if (!cuenta.size) return { valor: '', distintos: 0 };
  const orden = [...cuenta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  return { valor: orden[0][0], distintos: orden.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Construcción del modelo
// ─────────────────────────────────────────────────────────────────────────────

function construir(datos) {
  const { hojas, servicios, gastos, costesFijos } = datos;

  const cli = identidades(servicios.map((s) => s.cliente), 'CLI');
  const col = identidades(servicios.flatMap((s) => s.colaboradores), 'COL');

  // ── SERVICIOS + SERVICIO_COLABORADOR ──
  const filasServicios = [];
  const filasEnlace = [];

  servicios.forEach((s, i) => {
    s.id = `SRV-${String(i + 1).padStart(4, '0')}`;
    s.clienteId = cli.porClave.get(clave(s.cliente))?.id ?? '';

    // El margen es valor − (pago a colaboradores + transporte). El gasto de
    // empresa NO entra: no es un coste de este servicio, vive en GASTOS.
    s.margen = dos(s.valor - s.pagoColab - s.transporte);

    filasServicios.push({
      id: s.id,
      periodo: s.periodo,
      fecha: s.fecha,
      hora: s.hora ?? '',
      cliente_id: s.clienteId,
      cliente: s.cliente,
      horas: s.horas,
      personas: s.personas ?? '',
      valor: s.valor,
      pago_colab: s.pagoColab,
      transporte: s.transporte,
      margen: s.margen,
      pagado: s.pagado,
      colaboradores: s.colaboradoresTexto,
      n_colaboradores: s.colaboradores.length,
      rentabilidad_libro: s.rentabilidadLibro ?? '',
      revisar: s.revisar ? 'SI' : '',
      maquetacion: s.maquetacion,
      origen: s.origen,
    });

    // Un servicio puede llevar varias personas. El pago se reparte en céntimos
    // enteros para que la suma de las partes sea idéntica al pago del servicio.
    const ids = [...new Set(s.colaboradores.map((c) => clave(c)))];
    const partes = repartir(s.pagoColab, ids.length);
    ids.forEach((k, j) => {
      const id = col.porClave.get(k);
      filasEnlace.push({
        servicio_id: s.id,
        colaborador_id: id?.id ?? '',
        colaborador: id?.nombre ?? k,
        pago_reparto: partes[j],
        horas_reparto: dos(s.horas / ids.length),
      });
    });
  });

  // ── CLIENTES ──
  const porCliente = new Map();
  for (const s of servicios) {
    if (!porCliente.has(s.clienteId)) porCliente.set(s.clienteId, []);
    porCliente.get(s.clienteId).push(s);
  }

  const filasClientes = [...cli.porClave.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => {
      const suyos = porCliente.get(c.id) ?? [];
      const dir = masFrecuente(suyos.map((s) => s.direccion));
      const tel = masFrecuente(suyos.map((s) => s.telefono));
      const valor = suyos.reduce((a, s) => a + s.valor, 0);
      const coste = suyos.reduce((a, s) => a + s.pagoColab + s.transporte, 0);
      // Se suman los márgenes ya redondeados de cada fila, no se recalcula
      // sobre los brutos: así la columna de SERVICIOS suma exactamente esto.
      const margen = suyos.reduce((a, s) => a + s.margen, 0);

      if (dir.distintos > 1) {
        anotar('cliente_varias_direcciones', null, c.id,
          `${c.nombre}: ${dir.distintos} direcciones distintas. Se toma la más repetida.`);
      }
      if (tel.distintos > 1) {
        anotar('cliente_varios_telefonos', null, c.id,
          `${c.nombre}: ${tel.distintos} teléfonos distintos. Se toma el más repetido.`);
      }

      return {
        id: c.id,
        nombre: c.nombre,
        direccion: dir.valor,
        telefono: tel.valor,
        servicios: suyos.length,
        horas: dos(suyos.reduce((a, s) => a + s.horas, 0)),
        facturado: dos(valor),
        coste: dos(coste),
        margen: dos(margen),
        primer_servicio: suyos.map((s) => s.fechaFiable).filter(Boolean).sort()[0] ?? '',
        ultimo_servicio: suyos.map((s) => s.fechaFiable).filter(Boolean).sort().pop() ?? '',
        variantes: c.variantes.length > 1 ? c.variantes.join(' | ') : '',
      };
    });

  // ── COLABORADORES ──
  const porColab = new Map();
  for (const e of filasEnlace) {
    if (!e.colaborador_id) continue;
    if (!porColab.has(e.colaborador_id)) porColab.set(e.colaborador_id, []);
    porColab.get(e.colaborador_id).push(e);
  }

  const filasColab = [...col.porClave.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => {
      const suyos = porColab.get(c.id) ?? [];
      return {
        id: c.id,
        nombre: c.nombre,
        servicios: suyos.length,
        horas: dos(suyos.reduce((a, e) => a + e.horas_reparto, 0)),
        pago: dos(suyos.reduce((a, e) => a + e.pago_reparto, 0)),
        variantes: c.variantes.length > 1 ? c.variantes.join(' | ') : '',
      };
    });

  // ── MESES: lo sumado contra lo que dice el cierre escrito a mano ──
  const filasMeses = hojas.map((h) => {
    const suyos = servicios.filter((s) => s.periodo === h.periodo);
    const facturado = dos(suyos.reduce((a, s) => a + s.valor, 0));
    const pagoColab = dos(suyos.reduce((a, s) => a + s.pagoColab, 0));
    const transporte = dos(suyos.reduce((a, s) => a + s.transporte, 0));
    const margen = dos(suyos.reduce((a, s) => a + s.margen, 0));
    const gasto = dos(gastos.filter((g) => g.periodo === h.periodo)
      .reduce((a, g) => a + g.importe, 0));
    const fijos = dos(costesFijos.filter((f) => f.periodo === h.periodo)
      .reduce((a, f) => a + f.importe, 0));
    const c = h.cierre;

    const desfase = c.facturadoLibro == null ? null : dos(facturado - c.facturadoLibro);
    if (desfase) {
      anotar('cierre_no_cuadra', h.periodo, h.nombre,
        `Sumando las filas salen ${facturado} € y el cierre de la hoja dice ${dos(c.facturadoLibro)} € (${desfase > 0 ? '+' : ''}${desfase} €). El porqué está en los avisos importe_como_texto, fila_contada_dos_veces y fila_sin_cliente de este mismo mes.`);
    }

    return {
      periodo: h.periodo,
      mes: `${NOMBRE_MES[h.mes]} ${ANIO}`,
      servicios: suyos.length,
      horas: dos(suyos.reduce((a, s) => a + s.horas, 0)),
      facturado,
      pago_colab: pagoColab,
      transporte,
      margen_servicios: margen,
      gastos: gasto,
      costes_fijos: fijos,
      seg_soc: c['SEG-SOC'] ?? '',
      gestoria: c.GESTORIA ?? '',
      iva_irpf: c['IVA-IRPF'] ?? '',
      resultado: dos(margen - gasto - fijos
        - (c['SEG-SOC'] ?? 0) - (c.GESTORIA ?? 0) - (c['IVA-IRPF'] ?? 0)),
      facturado_libro: c.facturadoLibro == null ? '' : dos(c.facturadoLibro),
      descuadre: desfase ?? '',
      resultado_libro: c.resultadoLibro == null ? '' : dos(c.resultadoLibro),
      maquetacion: h.maquetacion,
      hoja_origen: h.nombre,
    };
  });

  // ── GASTOS ──
  const filasGastos = gastos.map((g, i) => ({
    id: `GAS-${String(i + 1).padStart(3, '0')}`,
    periodo: g.periodo,
    comercio: g.comercio,
    importe: g.importe,
    origen: g.origen,
  }));

  const filasFijos = costesFijos.map((f, i) => ({
    id: `FIJ-${String(i + 1).padStart(3, '0')}`,
    periodo: f.periodo,
    concepto: f.concepto,
    importe: f.importe,
    origen: f.origen,
  }));

  // ── FUSIONES_PROPUESTAS: nada de esto se ha aplicado ──
  const filasFusiones = [
    ...cli.propuestas.map((p) => ({ tabla: 'CLIENTES', ...p })),
    ...col.propuestas.map((p) => ({ tabla: 'COLABORADORES', ...p })),
  ].map((p, i) => ({
    id: `FUS-${String(i + 1).padStart(3, '0')}`,
    tabla: p.tabla,
    confianza: p.confianza,
    motivo: p.motivos.join(', '),
    quedaria_como: p.canonico,
    absorberia: p.miembros.slice(1).map((m) => `${m.nombre} (${m.usos})`).join(' | '),
    usos: p.usos,
    ojo: p.dudosos.map(([a, b]) => `${a} ≠ ${b}?`).join(' | '),
    aceptada: '',
  }));

  return {
    filasServicios, filasEnlace, filasClientes, filasColab,
    filasMeses, filasGastos, filasFijos, filasFusiones,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Escritura
// ─────────────────────────────────────────────────────────────────────────────

function leeme(m, origen) {
  const total = (campo, filas) => dos(filas.reduce((a, f) => a + (Number(f[campo]) || 0), 0));
  return [
    ['LIBRO MODELO 2026 — LIMPIEZAS EL IMPERIO'],
    [],
    ['Generado por scripts/modelo-2026.mjs a partir de:', origen],
    ['Fecha de generación:', new Date().toISOString().slice(0, 10)],
    [],
    ['CONTIENE DATOS REALES DE CLIENTES. No debe subirse a git ni compartirse.'],
    [],
    ['QUÉ ES'],
    ['Los meses de 2026 del libro de contabilidad, reescritos como base de datos:'],
    ['una fila por servicio, los nombres con identificador propio, y los gastos y'],
    ['los cierres de mes fuera de las filas de servicio, cada uno en su hoja.'],
    [],
    ['HOJAS'],
    ['SERVICIOS', 'Una fila por servicio prestado. Es la tabla principal.', m.filasServicios.length],
    ['SERVICIO_COLABORADOR', 'Quién hizo cada servicio y cuánto le tocó cobrar.', m.filasEnlace.length],
    ['CLIENTES', 'Un cliente por fila, con su dirección, teléfono y totales.', m.filasClientes.length],
    ['COLABORADORES', 'Una persona por fila, con horas y pago repartidos.', m.filasColab.length],
    ['MESES', 'Cierre mensual: lo sumado y lo que dice la hoja original.', m.filasMeses.length],
    ['GASTOS', 'Compras de la empresa. Estaban dentro de las filas de servicio.', m.filasGastos.length],
    ['COSTES_FIJOS', 'Alquiler, luz, basura anotados al pie de una hoja.', m.filasFijos.length],
    ['FUSIONES_PROPUESTAS', 'Nombres que podrían ser la misma persona. SIN APLICAR.', m.filasFusiones.length],
    ['AVISOS', 'Todo lo que no cuadra. Nada se ha corregido en silencio.', avisos.length],
    [],
    ['CÓMO SE UNEN'],
    ['SERVICIOS.cliente_id', '→', 'CLIENTES.id'],
    ['SERVICIO_COLABORADOR.servicio_id', '→', 'SERVICIOS.id'],
    ['SERVICIO_COLABORADOR.colaborador_id', '→', 'COLABORADORES.id'],
    ['SERVICIOS.periodo', '→', 'MESES.periodo'],
    [],
    ['DECISIONES QUE HAY QUE CONOCER'],
    [],
    ['1. El margen de un servicio es valor − (pago_colab + transporte).'],
    ['   Las columnas VALOR y COMERCIO del libro original NO son un coste del'],
    ['   servicio: son la compra del mes (supermercado, ferretería, óptica)'],
    ['   apuntada en la fila donde había sitio. Repartirlas entre los clientes de'],
    ['   esas filas culpaba del gasto a quien no lo causó. Ahora están en GASTOS,'],
    ['   por mes, y el resultado del mes sí las descuenta (hoja MESES).'],
    [],
    ['2. La columna RENTABILIDAD del libro se conserva (rentabilidad_libro) pero'],
    ['   no se usa para nada: está escrita a mano y no sigue el mismo criterio'],
    ['   entre hojas.'],
    [],
    ['3. El mes contable de un servicio es el de la hoja de la que sale, no el de'],
    ['   la fecha escrita en la fila. Cuando no coinciden la fecha se conserva tal'],
    ['   cual, la fila queda marcada con revisar = SI y sale en AVISOS.'],
    [],
    ['4. Los identificadores agrupan sólo nombres idénticos al normalizar'],
    ['   (mayúsculas, acentos, espacios). Los parecidos NO se han fusionado: están'],
    ['   en FUSIONES_PROPUESTAS con una columna «aceptada» que rellenar. Agrupar'],
    ['   de menos se arregla luego; agrupar de más destruye datos.'],
    [],
    ['5. Los importes están tal y como se escribieron. Sólo se redondean a dos'],
    ['   decimales los totales que calcula este script.'],
    [],
    ['QUÉ SE HA QUITADO DEL ORIGINAL'],
    ['· Las 77 pestañas ajenas a 2026 de las 85 del libro: años anteriores, una'],
    ['  hoja por colaborador, plantillas, tarifas y siete hojas vacías.'],
    ['· Las más de cien columnas vacías a la derecha de cada hoja mensual.'],
    ['· Las filas de membrete sobre la tabla.'],
    ['· Las columnas que no llevaban dato en ninguna fila: ESTADO PAGO DEL'],
    ['  TRABAJADOR y la columna sin nombre (vacías siempre), CONCEPTO («PAGADO A»'],
    ['  siempre), ESTADO DEL TRABAJO («MANTEN/TO» siempre), HORA (0 o vacía) y'],
    ['  PAGADO (0 en casi todas).'],
    ['· Las filas de relleno sin nombre de cliente y sin importe.'],
    [],
    ['OJO CON LAS CABECERAS DEL ORIGINAL'],
    ['En las hojas de 2026 los valores van corridos una columna respecto a sus'],
    ['títulos a partir de PAGADO: el OK/PTE aparece bajo «DESCRIPCION DEL'],
    ['SERVICIO» y la hora bajo «PAGO DEL CLIENTE». Aquí se han puesto bajo el'],
    ['nombre que les corresponde por contenido (pagado, hora).'],
    [],
    ['SUMAS DE CONTROL'],
    ['Servicios', m.filasServicios.length],
    ['Facturado', total('valor', m.filasServicios)],
    ['Pago a colaboradores', total('pago_colab', m.filasServicios)],
    ['Repartido en SERVICIO_COLABORADOR', total('pago_reparto', m.filasEnlace)],
    ['Transporte', total('transporte', m.filasServicios)],
    ['Margen de los servicios', total('margen', m.filasServicios)],
    ['Gastos de empresa', total('importe', m.filasGastos)],
    ['Costes fijos', total('importe', m.filasFijos)],
  ];
}

function escribir(m, salida, origen) {
  const wb = XLSX.utils.book_new();
  const hoja = (nombre, aoaOJson) => {
    const ws = Array.isArray(aoaOJson) && Array.isArray(aoaOJson[0])
      ? XLSX.utils.aoa_to_sheet(aoaOJson)
      : XLSX.utils.json_to_sheet(aoaOJson);
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  };

  hoja('LEEME', leeme(m, origen));
  hoja('SERVICIOS', m.filasServicios);
  hoja('SERVICIO_COLABORADOR', m.filasEnlace);
  hoja('CLIENTES', m.filasClientes);
  hoja('COLABORADORES', m.filasColab);
  hoja('MESES', m.filasMeses);
  hoja('GASTOS', m.filasGastos);
  hoja('COSTES_FIJOS', m.filasFijos);
  hoja('FUSIONES_PROPUESTAS', m.filasFusiones);
  hoja('AVISOS', avisos.map((a, i) => ({
    id: `AVI-${String(i + 1).padStart(3, '0')}`,
    tipo: a.tipo,
    periodo: a.periodo ?? '',
    origen: a.origen,
    detalle: a.detalle,
  })));

  fs.writeFileSync(salida, XLSX.write(wb, { bookType: 'ods', type: 'buffer', compression: true }));
}

// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const entrada = process.argv[2];
  if (!entrada) {
    console.error('Uso: node scripts/modelo-2026.mjs <libro.xlsx> [salida.ods]');
    process.exit(2);
  }
  const salida = process.argv[3]
    ?? path.join(path.dirname(entrada), `modelo limpiezas el imperio ${ANIO}.ods`);

  const datos = leerLibro(entrada);
  const m = construir(datos);
  escribir(m, salida, path.basename(entrada));

  const suma = (campo, filas) => dos(filas.reduce((a, f) => a + (Number(f[campo]) || 0), 0));

  console.log(`\nLibro modelo escrito en ${salida}\n`);
  console.log('  hojas mensuales leídas   ', datos.hojas.length,
    `(${datos.hojas.map((h) => h.periodo).join(' ')})`);
  console.log('  servicios                ', m.filasServicios.length);
  console.log('  clientes distintos       ', m.filasClientes.length);
  console.log('  colaboradores distintos  ', m.filasColab.length);
  console.log('  facturado                ', suma('valor', m.filasServicios), '€');
  console.log('  pago a colaboradores     ', suma('pago_colab', m.filasServicios), '€');
  console.log('  repartido por persona    ', suma('pago_reparto', m.filasEnlace), '€',
    suma('pago_reparto', m.filasEnlace) === suma('pago_colab', m.filasServicios.filter((s) => s.n_colaboradores)) ? '(cuadra)' : '(NO CUADRA)');
  console.log('  margen de los servicios  ', suma('margen', m.filasServicios), '€');
  console.log('  gastos de empresa        ', suma('importe', m.filasGastos), '€',
    `(${m.filasGastos.length} apuntes, fuera del margen por cliente)`);
  console.log('  costes fijos             ', suma('importe', m.filasFijos), '€');
  console.log('  fusiones propuestas      ', m.filasFusiones.length, '(sin aplicar)');
  console.log('  avisos                   ', avisos.length);

  const porTipo = new Map();
  for (const a of avisos) porTipo.set(a.tipo, (porTipo.get(a.tipo) || 0) + 1);
  for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(4)}  ${t}`);
  }
  console.log();
}

main();
