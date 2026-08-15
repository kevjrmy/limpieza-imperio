/**
 * Lectura del libro de contabilidad.
 *
 * El libro tiene dos maquetaciones incompatibles conviviendo en el mismo
 * archivo. Este parser sólo entiende la de 2026 y deja constancia, por nombre,
 * de las hojas que descarta: es preferible una lista visible de omisiones a un
 * número silenciosamente incompleto.
 *
 * Reglas que no son negociables:
 *  - Los campos se resuelven SIEMPRE por texto de cabecera, nunca por índice de
 *    columna. Las columnas se mueven entre hojas y FEBRERO no tiene TRANSPORTE.
 *  - La lectura se detiene en la fila cuyo DIA contiene "TOTAL": debajo hay un
 *    bloque de sumas escrito a mano que no son servicios.
 *  - Un año de fila que no coincide con el de la hoja se avisa, jamás se corrige.
 */

import { clave, aNumero } from './texto.js';

/** Cabeceras que identifican la maquetación de 2026. Ambas deben estar. */
const MARCADORES_2026 = ['VALOR DEL SERVICIO', 'COLABORADORES'];

/** Cabeceras propias de la maquetación antigua (2024–2025). */
const MARCADORES_ANTIGUO = ['VALOR', 'HORAS', 'RESPONSABLE LIMPIEZA'];

/** Cabecera que ancla la fila de títulos dentro de las 20 primeras filas. */
const ANCLA_CABECERA = 'NOMBRE DEL CLIENTE';

const FILAS_ESCANEO_CABECERA = 20;

/**
 * Campos que extraemos, con la cabecera exacta (ya normalizada) que los nombra.
 * `obligatorio` marca los que, si faltan, invalidan la hoja entera.
 */
const CAMPOS = [
  { campo: 'cliente', cabecera: 'NOMBRE DEL CLIENTE', tipo: 'texto', obligatorio: true },
  { campo: 'direccion', cabecera: 'DIRECCION CLIENTE', tipo: 'texto' },
  { campo: 'telefono', cabecera: 'TELEFONO', tipo: 'texto' },
  { campo: 'dia', cabecera: 'DIA', tipo: 'numero', obligatorio: true },
  { campo: 'mes', cabecera: 'MES', tipo: 'numero', obligatorio: true },
  { campo: 'anio', cabecera: 'ANO', tipo: 'numero', obligatorio: true },
  { campo: 'horas', cabecera: 'NUMERO HORAS', tipo: 'numero' },
  { campo: 'personas', cabecera: 'NUMERO PERSONAS', tipo: 'numero' },
  { campo: 'valor', cabecera: 'VALOR DEL SERVICIO', tipo: 'numero', obligatorio: true },
  { campo: 'rentabilidadHoja', cabecera: 'RENTABILIDAD', tipo: 'numero' },
  { campo: 'colaboradoresRaw', cabecera: 'COLABORADORES', tipo: 'texto' },
  { campo: 'estado', cabecera: 'ESTADO DEL TRABAJO', tipo: 'texto' },
  { campo: 'pagoColab', cabecera: 'PAGO COLABORADORES', tipo: 'numero' },
  { campo: 'transporte', cabecera: 'TRANSPORTE', tipo: 'numero' },
  { campo: 'gasto', cabecera: 'VALOR', tipo: 'numero' },
];

/**
 * Cadenas que aparecen en la celda COLABORADORES pero no son personas:
 * herramientas, notas sueltas del día.
 */
const NO_ES_PERSONA = new Set([
  'ASPIRADORA',
  'CON VAPORETA',
  'VAPORETA',
  'CON ASPIRADORA',
  'MAQUINA',
  'CON MAQUINA',
  'PULIDORA',
  'HIDROLIMPIADORA',
  'NADIE',
  'NINGUNO',
  'PENDIENTE',
  'SIN ASIGNAR',
  'X',
  '-',
  '',
]);

/** Meses en el nombre de la hoja → número, para deducir el periodo esperado. */
const MESES = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SEPT: 9, OCTUBRE: 10,
  NOVIEMBRE: 11, NOV: 11, DICIEMBRE: 12, DIC: 12,
};

/** Extrae mes y año declarados en el nombre de la hoja ("CLIENTES MAYO 2026"). */
function periodoDeHoja(nombre) {
  const k = clave(nombre);
  const anio = (k.match(/\b(20\d{2})\b/) || [])[1];
  let mes = null;
  for (const [texto, num] of Object.entries(MESES)) {
    if (new RegExp(`\\b${texto}\\b`).test(k)) { mes = num; break; }
  }
  return { mes, anio: anio ? Number(anio) : null };
}

/** Localiza la fila de cabecera buscando el ancla en las primeras filas. */
function buscarCabecera(filas) {
  const limite = Math.min(FILAS_ESCANEO_CABECERA, filas.length);
  for (let i = 0; i < limite; i++) {
    const fila = filas[i] || [];
    for (const celda of fila) {
      if (clave(celda) === ANCLA_CABECERA) return i;
    }
  }
  return -1;
}

/** Mapa cabecera normalizada → índice de columna. La primera aparición gana. */
function mapaColumnas(filaCabecera) {
  const mapa = new Map();
  (filaCabecera || []).forEach((celda, i) => {
    const k = clave(celda);
    if (k && !mapa.has(k)) mapa.set(k, i);
  });
  return mapa;
}

/**
 * Separa la celda de colaboradores en personas.
 * Un solo texto libre puede contener "LUCIA MENDEZ, TOMAS RIVAS",
 * "TOMAS-NURIA" o "LUCIA M - NURIA".
 *
 * Devuelve los fragmentos tal y como están escritos (sólo recortados): la
 * normalización es cosa del agrupador, que necesita ver las variantes reales
 * para elegir la forma canónica.
 */
export function separarColaboradores(bruto) {
  if (bruto == null) return [];
  return String(bruto)
    .split(/[,/;\-–—]+/)
    .map((t) => String(t).replace(/\s+/g, ' ').trim())
    .filter((t) => {
      const k = clave(t);
      if (!k) return false;
      if (NO_ES_PERSONA.has(k)) return false;
      if (k.length < 2) return false;          // iniciales sueltas
      if (/^[0-9.,]+$/.test(k)) return false;  // números sueltos
      if (!/[A-Z]/.test(k)) return false;      // sin letras
      return true;
    });
}

/** Lee una celda como texto limpio, o '' si está vacía. */
function comoTexto(v) {
  if (v == null) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

/**
 * Analiza el libro completo.
 *
 * @param {ArrayBuffer|Uint8Array} datos  contenido del .xlsx
 * @param {object} XLSX                   módulo SheetJS ya cargado
 * @returns {{hojas: Array, servicios: Array, avisos: Array}}
 */
export function analizarLibro(datos, XLSX) {
  const libro = XLSX.read(datos, { type: 'array', cellDates: false });

  const hojas = [];
  const servicios = [];
  const avisos = [];

  for (const nombreHoja of libro.SheetNames) {
    if (!clave(nombreHoja).startsWith('CLIENTES')) continue;

    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });

    const nombre = comoTexto(nombreHoja);
    const filaCab = buscarCabecera(filas);

    if (filaCab === -1) {
      hojas.push({
        nombre, estado: 'omitida', maquetacion: 'desconocida',
        motivo: 'No se encontró la fila de cabecera «NOMBRE DEL CLIENTE».',
        servicios: 0, columnasFaltantes: [],
      });
      continue;
    }

    const cols = mapaColumnas(filas[filaCab]);

    // Detección de maquetación por marcadores, no por el año del nombre:
    // «CLIENTES ENERO DE 2026» usa la maquetación antigua pese al año.
    const es2026 = MARCADORES_2026.every((m) => cols.has(m));
    if (!es2026) {
      const esAntiguo = MARCADORES_ANTIGUO.every((m) => cols.has(m));
      hojas.push({
        nombre, estado: 'omitida',
        maquetacion: esAntiguo ? 'antigua' : 'desconocida',
        motivo: esAntiguo
          ? 'Maquetación antigua (VALOR / HORAS / RESPONSABLE LIMPIEZA).'
          : 'No tiene las columnas VALOR DEL SERVICIO y COLABORADORES.',
        servicios: 0,
        columnasFaltantes: MARCADORES_2026.filter((m) => !cols.has(m)),
        filaCabecera: filaCab + 1,
      });
      continue;
    }

    // Columnas ausentes en una hoja por lo demás válida: se tratan como 0 y
    // se avisa. FEBRERO DE 2026 no tiene TRANSPORTE en absoluto.
    const faltantes = CAMPOS
      .filter((c) => !c.obligatorio && !cols.has(c.cabecera))
      .map((c) => c.cabecera);

    for (const cab of faltantes) {
      avisos.push({
        tipo: 'columna_ausente',
        hoja: nombre,
        fila: null,
        mensaje: `La hoja «${nombre}» no tiene la columna «${cab}». Se toma como 0 en todas sus filas.`,
      });
    }

    const { anio: anioHoja, mes: mesHoja } = periodoDeHoja(nombre);
    const colDia = cols.get('DIA');

    let cuenta = 0;
    let filasVacias = 0;
    let detenidoEn = null;

    for (let r = filaCab + 1; r < filas.length; r++) {
      const fila = filas[r] || [];

      // El bloque de totales escrito a mano empieza aquí. Nada por debajo
      // es un servicio.
      const celdaDia = colDia != null ? fila[colDia] : null;
      if (celdaDia != null && clave(celdaDia).includes('TOTAL')) {
        detenidoEn = r + 1;
        break;
      }

      const registro = { origenHoja: nombre, origenFila: r + 1 };
      for (const c of CAMPOS) {
        const i = cols.get(c.cabecera);
        const bruto = i == null ? null : fila[i];
        registro[c.campo] = c.tipo === 'numero' ? aNumero(bruto) : comoTexto(bruto);
      }

      // Filas de relleno: el libro tiene unas 180 con 0/0/0 y sin cliente.
      if (!registro.cliente) { filasVacias++; continue; }

      registro.clienteClave = clave(registro.cliente);
      registro.colaboradores = separarColaboradores(registro.colaboradoresRaw);

      // Fecha ISO a partir de DIA/MES/AÑO. Si el año de la fila no cuadra con
      // el de la hoja lo dejamos tal cual y avisamos.
      const dia = Math.trunc(registro.dia) || 1;
      const mes = Math.trunc(registro.mes) || mesHoja || 1;
      const anio = Math.trunc(registro.anio) || anioHoja || 0;
      registro.fecha = `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      registro.periodo = `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;

      if (anioHoja && anio && anio !== anioHoja) {
        avisos.push({
          tipo: 'anio_discrepante',
          hoja: nombre,
          fila: r + 1,
          cliente: registro.cliente,
          mensaje: `Fila ${r + 1}: fecha ${registro.fecha} (año ${anio}) en una hoja de ${anioHoja}.`,
          detalle: { anioFila: anio, anioHoja, fecha: registro.fecha },
        });
      }

      servicios.push(registro);
      cuenta++;
    }

    hojas.push({
      nombre,
      estado: 'importada',
      maquetacion: '2026',
      motivo: null,
      servicios: cuenta,
      filasVacias,
      columnasFaltantes: faltantes,
      filaCabecera: filaCab + 1,
      filaTotales: detenidoEn,
      periodo: anioHoja && mesHoja
        ? `${anioHoja}-${String(mesHoja).padStart(2, '0')}`
        : null,
    });
  }

  return { hojas, servicios, avisos };
}
