/**
 * Genera un libro sintético con la misma forma que el real.
 *
 *   node scripts/libro-de-prueba.mjs public/libro-de-prueba.xlsx
 *
 * Existe para poder probar la interfaz sin mover el archivo del cliente de su
 * sitio: contiene nombres inventados y reproduce, a propósito, cada rareza del
 * original —dos maquetaciones, cabecera en filas distintas, una hoja sin
 * TRANSPORTE, filas de relleno, bloque de TOTAL, años cruzados y celdas de
 * colaboradores con varias personas dentro.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

// La build ESM de SheetJS no trae `fs` enlazado: hay que dárselo para escribir.
XLSX.set_fs(fs);

const destino = process.argv[2] || 'public/libro-de-prueba.xlsx';

const CAB_2026 = [
  'NOMBRE DEL CLIENTE', '', '', 'DIRECCION CLIENTE', '', '', '', 'TELEFONO', '', '',
  'DIA', 'MES', 'AÑO ', 'NUMERO  HORAS', 'NUMERO PERSONAS', 'HORA DEL SERVICIO',
  'VALOR DEL SERVICIO', 'RENTABILIDAD', 'PAGADO', 'COLABORADORES ',
  'DESCRIPCION DEL SERVICIO', 'HORA', 'ESTADO DEL TRABAJO', 'PAGO DEL CLIENTE',
  'ESTADO PAGO DEL TRABAJADOR', '', 'CONCEPTO', 'PAGO COLABORADORES',
  'TRANSPORTE', 'VALOR', 'COMERCIO',
];

const CAB_ANTIGUA = [
  'NOMBRE DEL CLIENTE', '', '', '', 'DIRECCION CLIENTE', '', '', '', 'TELEFONO', '',
  'DIA', 'MES', 'AÑO', 'HORAS', 'VALOR', 'IMPUESTOS', 'RESPONSABLE LIMPIEZA',
  'PAGADO', 'TRABAJADORES', 'DESCRIPCION DEL SERVICIO', 'HORA', 'ESTADO DEL TRABAJO',
  'PAGO DEL CLIENTE', 'ESTADO PAGO DEL TRABAJADOR', 'DINERO PAGADO', 'TRANSPORTE',
];

/** Fila de la maquetación 2026 en las posiciones que le tocan. */
function fila2026({ cliente, dia, mes, anio, horas, personas, valor, colab, pago, transporte, gasto }) {
  const f = new Array(31).fill(null);
  f[0] = cliente; f[3] = cliente ? 'C/ Inventada 1' : null; f[7] = cliente ? '600000000' : null;
  f[10] = dia; f[11] = mes; f[12] = anio;
  f[13] = horas; f[14] = personas; f[16] = valor; f[17] = valor ? valor * 0.4 : 0;
  f[19] = colab; f[22] = 'MANTEN/TO';
  f[27] = pago; f[28] = transporte; f[29] = gasto;
  return f;
}

const SERVICIOS = [
  // Cliente rentable, un colaborador.
  { cliente: 'FINCA LOS OLMOS', dia: 3, valor: 200, colab: 'LUCIA', pago: 80, transporte: 0, gasto: 0 },
  { cliente: 'FINCA LOS OLMOS', dia: 10, valor: 200, colab: 'LUCIA', pago: 80, transporte: 0, gasto: 0 },
  // Misma clienta escrita de tres formas: se une sola al normalizar.
  { cliente: 'MÓNICA REYES', dia: 4, valor: 90, colab: 'LUCIA MENDEZ', pago: 40, transporte: 0, gasto: 0 },
  { cliente: 'monica reyes', dia: 11, valor: 90, colab: 'LUCIA', pago: 40, transporte: 0, gasto: 0 },
  { cliente: 'MONICA  REYES', dia: 18, valor: 90, colab: 'LUCIA', pago: 40, transporte: 0, gasto: 0 },
  // Varios colaboradores en una celda, con separadores distintos.
  { cliente: 'HOTEL PALMERA', dia: 5, valor: 300, colab: 'LUCIA, TOMAS RIVAS, NURIA', pago: 150, transporte: 10, gasto: 5 },
  { cliente: 'HOTEL PALMERA', dia: 12, valor: 300, colab: 'TOMAS-NURIA', pago: 150, transporte: 10, gasto: 0 },
  { cliente: 'HOTEL PALMERA', dia: 19, valor: 300, colab: 'NURIA / TOMAS RIVAS', pago: 150, transporte: 10, gasto: 0 },
  // Ruido que no es una persona: debe descartarse.
  { cliente: 'GIMNASIO ATLAS', dia: 6, valor: 120, colab: 'ASPIRADORA', pago: 0, transporte: 0, gasto: 0 },
  { cliente: 'GIMNASIO ATLAS', dia: 13, valor: 120, colab: 'NURIA - CON VAPORETA', pago: 60, transporte: 0, gasto: 0 },
  // Cliente en pérdidas: cuesta más de lo que paga.
  { cliente: 'BAR LA ESQUINA', dia: 7, valor: 45, colab: 'TOMAS RIVAS', pago: 60, transporte: 8, gasto: 3 },
  { cliente: 'BAR LA ESQUINA', dia: 14, valor: 45, colab: 'TOMAS RIVAS', pago: 60, transporte: 8, gasto: 3 },
  { cliente: 'BAR LA ESQUINA', dia: 21, valor: 45, colab: 'TOMAS', pago: 60, transporte: 8, gasto: 3 },
  // Año cruzado: se avisa, no se corrige.
  { cliente: 'FINCA LOS OLMOS', dia: 24, anio: 2025, valor: 200, colab: 'LUCIA', pago: 80, transporte: 0, gasto: 0 },
  { cliente: 'HOTEL PALMERA', dia: 25, anio: 2025, valor: 300, colab: 'NURIA', pago: 150, transporte: 10, gasto: 0 },
  // Nombres que se parecen pero son dos personas: propuesta de baja confianza.
  { cliente: 'ROSA CAMPOS', dia: 8, valor: 70, colab: 'MARIANO', pago: 30, transporte: 0, gasto: 0 },
  { cliente: 'ROSA CAMPOS', dia: 15, valor: 70, colab: 'MARIANA', pago: 30, transporte: 0, gasto: 0 },
  // Nombre truncado frente al completo: propuesta de confianza alta.
  { cliente: 'ROSA CAMPOS', dia: 22, valor: 70, colab: 'BEATRIZ SOL', pago: 30, transporte: 0, gasto: 0 },
  { cliente: 'ROSA CAMPOS', dia: 23, valor: 70, colab: 'BEATRIZ SOLANO', pago: 30, transporte: 0, gasto: 0 },
  // Inicial ambigua: NO debe proponerse, hay dos apellidos en juego.
  { cliente: 'ELENA P', dia: 9, valor: 80, colab: 'LUCIA', pago: 35, transporte: 0, gasto: 0 },
  { cliente: 'ELENA M', dia: 16, valor: 80, colab: 'LUCIA', pago: 35, transporte: 0, gasto: 0 },
  { cliente: 'ELENA PRADOS', dia: 17, valor: 80, colab: 'LUCIA', pago: 35, transporte: 0, gasto: 0 },
  { cliente: 'ELENA MOLINA', dia: 20, valor: 80, colab: 'LUCIA', pago: 35, transporte: 0, gasto: 0 },
  // Servicio sin colaborador anotado: no entra en el reparto.
  { cliente: 'GIMNASIO ATLAS', dia: 27, valor: 120, colab: '', pago: 50, transporte: 0, gasto: 0 },
];

/** Monta una hoja 2026 completa, con su cabecera donde toque y su bloque final. */
function hoja2026({ mes, anio, filaCabecera, sinTransporte }) {
  const filas = [];
  for (let i = 0; i < filaCabecera; i++) filas.push([]);
  filas.push(sinTransporte ? CAB_2026.map((c, i) => (i === 28 ? '' : c)) : CAB_2026);

  for (const s of SERVICIOS) {
    filas.push(fila2026({
      ...s,
      mes,
      anio: s.anio ?? anio,
      horas: 2, personas: 1,
      transporte: sinTransporte ? null : s.transporte,
    }));
  }

  // Relleno: filas con ceros y sin cliente, como las ~180 del libro real.
  for (let i = 0; i < 6; i++) {
    filas.push(fila2026({ cliente: null, dia: 28, mes, anio, horas: 0, personas: 0, valor: 0, colab: null, pago: 0, transporte: 0, gasto: 0 }));
  }

  // Bloque de totales escrito a mano: la lectura tiene que parar aquí.
  const total = new Array(31).fill(null);
  total[10] = 'TOTAL HORAS';
  total[13] = 999; total[16] = 99999;
  filas.push(total);
  filas.push((() => { const f = new Array(31).fill(null); f[10] = 'TOTAL MES'; f[16] = 88888; return f; })());

  return XLSX.utils.aoa_to_sheet(filas);
}

/** Hoja de la maquetación antigua: debe quedar fuera y listada por su nombre. */
function hojaAntigua({ mes, anio }) {
  const filas = [];
  for (let i = 0; i < 9; i++) filas.push([]);
  filas.push(CAB_ANTIGUA);
  for (let d = 1; d <= 5; d++) {
    const f = new Array(26).fill(null);
    f[0] = 'CLIENTE ANTIGUO ' + d;
    f[10] = d; f[11] = mes; f[12] = anio; f[13] = 2; f[14] = 60;
    f[16] = 'LUCIA'; f[25] = 0;
    filas.push(f);
  }
  return XLSX.utils.aoa_to_sheet(filas);
}

const libro = XLSX.utils.book_new();

// Cabecera en la fila 7 en unas hojas y en la 11 en otras, como el original.
XLSX.utils.book_append_sheet(libro, hoja2026({ mes: 8, anio: 2026, filaCabecera: 6 }), 'CLIENTES AGOSTO 2026');
XLSX.utils.book_append_sheet(libro, hoja2026({ mes: 7, anio: 2026, filaCabecera: 6 }), 'CLIENTES JULIO 2026');
XLSX.utils.book_append_sheet(libro, hoja2026({ mes: 6, anio: 2026, filaCabecera: 10 }), 'CLIENTES JUNIO 2026');
// Esta no tiene columna TRANSPORTE en absoluto.
XLSX.utils.book_append_sheet(libro, hoja2026({ mes: 2, anio: 2026, filaCabecera: 10, sinTransporte: true }), 'CLIENTES FEBRERO DE 2026');
// Maquetación antigua pese al año 2026: se detecta por marcadores, no por nombre.
XLSX.utils.book_append_sheet(libro, hojaAntigua({ mes: 1, anio: 2026 }), 'CLIENTES ENERO DE 2026');
XLSX.utils.book_append_sheet(libro, hojaAntigua({ mes: 12, anio: 2025 }), 'CLIENTES DE DIC DE 2025');
// Hojas que no empiezan por CLIENTES: ni se miran.
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['PERSONAL']]), 'PERSONAL ');
XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['PRODUCTOS']]), 'PRODUCTOS');

fs.mkdirSync(path.dirname(destino), { recursive: true });
XLSX.writeFile(libro, destino);
console.log(`Libro de prueba escrito en ${destino}`);
