/**
 * Presupuestos, hojas de servicio y cuentas de cobro: qué llevan dentro y cómo
 * se suman.
 *
 * Son los papeles que él tenía en su Excel como hojas sueltas —COTIZACION DE
 * SERVICIO, HOJA DE SERVICIO MODELO y CUENTA DE COBRO— y que rellenaba
 * machacando el anterior.
 * Aquí cada uno se guarda aparte con su número, y «Nueva a partir de esta» abre
 * una copia sin tocar el original: eso es exactamente lo que pidió.
 *
 * Módulo puro. Lo usan el formulario, para enseñar los totales mientras
 * escribe, y la acción de guardar, que los vuelve a calcular por su cuenta: el
 * total que se guarda nunca es el que manda el navegador.
 *
 * Nada de esto es contabilidad. Guardar un documento no crea servicios ni suma
 * en ningún resumen (ver `documentos` en esquema.sql).
 */

import { fechaDeHoy } from '../componentes/formato.js';

// `femenino` decide la concordancia de los textos que los nombran («nueva
// hoja», «nuevo presupuesto»): ver `genero()`.
export const TIPOS = {
  presupuesto: {
    nombre: 'Presupuesto',
    plural: 'Presupuestos',
    ruta: '/presupuestos',
    articulo: 'el presupuesto',
    femenino: false,
    // Su hoja COTIZACION DE SERVICIO sólo tenía el #001. Se puede cambiar al
    // guardar el primero.
    primerNumero: 1,
  },
  hoja: {
    nombre: 'Hoja de servicio',
    plural: 'Hojas de servicio',
    ruta: '/hojas-de-servicio',
    articulo: 'la hoja',
    femenino: true,
    primerNumero: 1,
  },
  cobro: {
    nombre: 'Cuenta de cobro',
    plural: 'Cuentas de cobro',
    ruta: '/cuentas-de-cobro',
    articulo: 'la cuenta de cobro',
    femenino: true,
    // Su Excel iba por la #023 cuando se leyó. Es sólo la primera propuesta si
    // todavía no hay ninguna guardada aquí: el número se puede cambiar al
    // guardar la primera, y a partir de ahí sigue desde la más alta.
    primerNumero: 24,
  },
};

export const esTipo = (t) => Object.hasOwn(TIPOS, t);

/** La palabra que concuerda con el tipo: `genero(t, 'nueva', 'nuevo')`. */
export const genero = (t, femenino, masculino) => (t.femenino ? femenino : masculino);

// Lo que se puede decir de un presupuesto después de mandarlo. No se imprime:
// es para que él vea en la lista cuáles salieron adelante.
export const ESTADOS_PRESUPUESTO = {
  pendiente: 'Pendiente',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
};

// Sugerencias para el tipo de servicio y la frecuencia. Salen de su web
// (limpiezaselimperio, `src/datos/negocio.ts`); son sólo eso, sugerencias: el
// campo es libre.
export const SERVICIOS_SUGERIDOS = ['Limpieza general', 'Limpieza regular',
  'Limpieza profunda', 'Post mudanza', 'Alquiler vacacional', 'Limpieza de cristales',
  'Limpieza de comunidades', 'Garajes', 'Limpieza de oficinas', 'Limpieza comercial',
  'Escaparates', 'Post evento', 'Limpieza de obra', 'Fin de obra'];
export const FRECUENCIAS_SUGERIDAS = ['Una sola vez', 'Semanal', 'Cada quince días',
  'Mensual'];

// Lo que su hoja modelo traía escrito, con la ortografía arreglada. Es sólo el
// punto de partida de una hoja en blanco: se quita y se añade lo que haga falta.
const TAREAS_MODELO = ['Habitaciones', 'Baños', 'Cocina', 'Salón comedor', 'Paredes',
  'Electrodomésticos', 'Sofá aspirado', 'Tirar platos', 'Colchón', 'Armarios'];

// Los importes de la hoja, en el orden de su Excel. `IVA` no está aquí: se
// calcula sobre la suma de estos.
export const IMPORTES_HOJA = [
  { campo: 'servicio', texto: 'Valor horas contratadas' },
  { campo: 'desplazamiento', texto: 'Desplazamiento' },
  { campo: 'extras', texto: 'Valor horas extras' },
  { campo: 'vaporeta', texto: 'Servicio con vaporeta' },
  { campo: 'karcher', texto: 'Servicio con Kärcher' },
];

// ── Números escritos a mano ─────────────────────────────────────────────────

/**
 * Número desde lo que escribió, tolerando la coma decimal y el símbolo del
 * euro, como `num()` en acciones.js.
 *
 * Con una diferencia: si hay coma, los puntos son de millar y se quitan. En una
 * cuenta de cobro se escriben importes de más de mil, y «1.200,50» se leía
 * como 1,2. Un punto SIN coma se deja como decimal, porque «83.333» igual es
 * 83,333 € escrito con punto: adivinar ahí cambiaría un importe sin avisar, y el
 * total que se ve mientras escribe ya delata el error.
 */
export function leerNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let t = String(v ?? '').trim().replace(/[€\s]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  if (!t) return 0;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** Al revés: un número guardado, como se escribe en un campo en España. */
export function aCampo(n) {
  if (n === '' || n === null || n === undefined) return '';
  if (typeof n === 'string') return n;
  return n ? String(n).replace('.', ',') : '';
}

const centimos = (n) => Math.round(n * 100) / 100;

// ── Documentos en blanco ────────────────────────────────────────────────────

const clienteVacio = () => ({
  nombre: '', nif: '', direccion: '', codigoPostal: '', localidad: '', telefono: '',
});

/** Los datos del cliente tal y como salen de su ficha, para copiarlos al papel. */
export function clienteDesdeFicha(c) {
  return {
    nombre: c?.nombre ?? '',
    nif: c?.nif ?? '',
    direccion: c?.direccion ?? '',
    codigoPostal: c?.codigo_postal ?? '',
    // La ficha no tiene localidad: la dirección de sus clientes suele llevarla
    // dentro. Se deja lo que hubiera escrito en el papel.
    localidad: '',
    telefono: c?.telefono ?? '',
  };
}

const tareaVacia = (descripcion = '') => ({
  descripcion, cantidad: '', observaciones: '', realizada: false, responsable: '',
});

const lineaVacia = () => ({ descripcion: '', cantidad: '1', importe: '', fecha: '' });

// En el presupuesto se escribe el precio y la cantidad, y el importe sale de
// multiplicar: es al revés que en la cuenta de cobro, porque aquí él parte de
// su tarifa por hora («normalmente se cobra por horas», dice su web) y el
// total es lo que quiere saber. Un precio cerrado es cantidad 1.
const partidaVacia = () => ({ descripcion: '', cantidad: '1', precio: '' });

export function documentoVacio(tipo) {
  if (tipo === 'presupuesto') {
    return {
      fecha: fechaDeHoy(),
      validez: '30',
      servicio: '',
      frecuencia: '',
      cliente: clienteVacio(),
      partidas: [partidaVacia()],
      iva: '21',
      // Su web: «los materiales y los productos van incluidos en el servicio».
      productosIncluidos: true,
      observaciones: '',
      estado: 'pendiente',
    };
  }
  if (tipo === 'hoja') {
    return {
      fecha: fechaDeHoy(),
      hora: '',
      tipoLimpieza: '',
      cliente: clienteVacio(),
      facturado: false,
      tareas: TAREAS_MODELO.map((t) => tareaVacia(t)),
      personal: [],
      horasContratadas: '',
      horasExtras: '',
      importes: Object.fromEntries(IMPORTES_HOJA.map((i) => [i.campo, ''])),
      iva: '21',
      productosIncluidos: true,
      observaciones: '',
    };
  }
  return {
    fecha: fechaDeHoy(),
    ciudad: '',
    concepto: '',
    cliente: clienteVacio(),
    lineas: [lineaVacia()],
    totalHoras: '',
    observaciones: '',
  };
}

export const nuevaTarea = () => tareaVacia();
export const nuevaLinea = () => lineaVacia();
export const nuevaPartida = () => partidaVacia();

/**
 * El contenido guardado, listo para meterlo en el formulario: los números
 * vuelven a ser texto con coma, que es como él los escribe.
 */
export function paraFormulario(tipo, c) {
  const base = documentoVacio(tipo);
  const d = { ...base, ...c, cliente: { ...base.cliente, ...(c?.cliente ?? {}) } };

  if (tipo === 'presupuesto') {
    return {
      ...d,
      validez: aCampo(d.validez),
      iva: String(d.iva ?? 21).replace('.', ','),
      partidas: (d.partidas ?? []).map((p) => ({
        ...partidaVacia(), ...p, cantidad: aCampo(p.cantidad), precio: aCampo(p.precio),
      })),
    };
  }
  if (tipo === 'hoja') {
    return {
      ...d,
      horasContratadas: aCampo(d.horasContratadas),
      horasExtras: aCampo(d.horasExtras),
      // El IVA a 0 se enseña como «0», no vacío: es una decisión, no un hueco.
      iva: String(d.iva ?? 21).replace('.', ','),
      importes: Object.fromEntries(IMPORTES_HOJA.map((i) => [i.campo, aCampo(d.importes?.[i.campo])])),
      tareas: (d.tareas ?? []).map((t) => ({ ...tareaVacia(), ...t, cantidad: aCampo(t.cantidad) })),
      personal: [...(d.personal ?? [])],
    };
  }
  return {
    ...d,
    totalHoras: aCampo(d.totalHoras),
    lineas: (d.lineas ?? []).map((l) => ({
      ...lineaVacia(), ...l, cantidad: aCampo(l.cantidad), importe: aCampo(l.importe),
    })),
  };
}

/**
 * «Nueva a partir de esta»: la misma hoja con la fecha de hoy y sin lo que es
 * propio del día en que se hizo la anterior. El original no se toca: esto sólo
 * rellena el formulario, y guardar crea otro documento.
 */
export function copiaParaNueva(tipo, contenido) {
  const d = paraFormulario(tipo, contenido);
  d.fecha = fechaDeHoy();
  if (tipo === 'presupuesto') {
    // Si aquél se aceptó, éste todavía no lo ha visto nadie.
    d.estado = 'pendiente';
  } else if (tipo === 'hoja') {
    // Lo hecho es de aquel día, no de éste. Y si aquella se facturó, ésta
    // todavía no: copiarlo imprimiría «Facturado: Sí» en un servicio sin cobrar.
    d.tareas = d.tareas.map((t) => ({ ...t, realizada: false, observaciones: '' }));
    d.facturado = false;
  } else {
    // Las fechas de cada línea eran las de aquellos trabajos. Copiarlas
    // imprimiría en un papel nuevo unas fechas que no son las suyas.
    d.lineas = d.lineas.map((l) => ({ ...l, fecha: '' }));
  }
  return d;
}

// ── Totales ─────────────────────────────────────────────────────────────────

/** Lo que se suma en cada documento. Acepta lo del formulario o lo guardado. */
export function calcular(tipo, d) {
  if (tipo === 'presupuesto') {
    const partidas = (d.partidas ?? []).map((p) => {
      const cantidad = leerNumero(p.cantidad);
      const precio = leerNumero(p.precio);
      return { cantidad, precio, importe: centimos(cantidad * precio) };
    });
    const subtotal = centimos(partidas.reduce((a, p) => a + p.importe, 0));
    const ivaPorcentaje = leerNumero(d.iva);
    const iva = centimos(subtotal * ivaPorcentaje / 100);
    return { partidas, subtotal, ivaPorcentaje, iva, total: centimos(subtotal + iva) };
  }
  if (tipo === 'hoja') {
    const subtotal = IMPORTES_HOJA.reduce((a, i) => a + leerNumero(d.importes?.[i.campo]), 0);
    const ivaPorcentaje = leerNumero(d.iva);
    const iva = centimos(subtotal * ivaPorcentaje / 100);
    return {
      subtotal: centimos(subtotal),
      ivaPorcentaje,
      iva,
      total: centimos(subtotal + iva),
      totalHoras: leerNumero(d.horasContratadas) + leerNumero(d.horasExtras),
    };
  }

  const lineas = (d.lineas ?? []).map((l) => {
    const cantidad = leerNumero(l.cantidad);
    const importe = leerNumero(l.importe);
    // Como en su hoja: él escribe el total de la línea y el precio por unidad
    // sale de dividir por la cantidad.
    return { cantidad, importe, unitario: cantidad ? importe / cantidad : importe };
  });
  return {
    lineas,
    total: centimos(lineas.reduce((a, l) => a + l.importe, 0)),
  };
}

// ── Lo que se guarda ────────────────────────────────────────────────────────

const txt = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
// Las observaciones pueden llevar saltos de línea: se respetan.
const parrafo = (v) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 4000);
const lista = (v, max = 200) => (Array.isArray(v) ? v.slice(0, max) : []);
const fechaValida = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f ?? ''));

function limpiarCliente(c) {
  return {
    nombre: txt(c?.nombre, 200),
    nif: txt(c?.nif, 40),
    direccion: txt(c?.direccion, 300),
    codigoPostal: txt(c?.codigoPostal, 10),
    localidad: txt(c?.localidad, 120),
    telefono: txt(c?.telefono, 60),
  };
}

/**
 * Deja el contenido en su forma guardada: textos recortados, números como
 * números, y nada que no sea de este tipo de documento. Devuelve
 * `{ contenido }` o `{ error }` con lo que falta dicho en su idioma.
 */
export function normalizar(tipo, d) {
  if (!esTipo(tipo)) return { error: 'Tipo de documento desconocido.' };
  if (!fechaValida(d?.fecha)) return { error: 'Falta la fecha.' };

  const cliente = limpiarCliente(d.cliente);
  if (!cliente.nombre) return { error: 'Falta el nombre del cliente.' };

  if (tipo === 'presupuesto') {
    const partidas = lista(d.partidas)
      .map((p) => ({
        descripcion: txt(p?.descripcion, 300),
        cantidad: leerNumero(p?.cantidad),
        precio: leerNumero(p?.precio),
      }))
      // Como en la cuenta de cobro: la cantidad nace con un 1 y no cuenta.
      .filter((p) => p.descripcion || p.precio);
    if (!partidas.length) return { error: 'El presupuesto necesita al menos una línea.' };

    // Sin validez es «sin plazo», y se imprime así: no se inventa un plazo.
    const validez = Math.max(0, Math.min(365, Math.round(leerNumero(d.validez))));
    return {
      contenido: {
        fecha: d.fecha,
        validez,
        servicio: txt(d.servicio, 200),
        frecuencia: txt(d.frecuencia, 120),
        cliente,
        partidas,
        iva: leerNumero(d.iva),
        productosIncluidos: Boolean(d.productosIncluidos),
        observaciones: parrafo(d.observaciones),
        estado: Object.hasOwn(ESTADOS_PRESUPUESTO, d.estado) ? d.estado : 'pendiente',
      },
    };
  }

  if (tipo === 'hoja') {
    return {
      contenido: {
        fecha: d.fecha,
        hora: /^\d{2}:\d{2}$/.test(String(d.hora ?? '')) ? d.hora : '',
        tipoLimpieza: txt(d.tipoLimpieza, 200),
        cliente,
        facturado: Boolean(d.facturado),
        tareas: lista(d.tareas)
          .map((t) => ({
            descripcion: txt(t?.descripcion, 200),
            // La cantidad es texto: en su hoja pone «2», pero también «varios».
            cantidad: txt(t?.cantidad, 40),
            observaciones: txt(t?.observaciones, 300),
            realizada: Boolean(t?.realizada),
            responsable: txt(t?.responsable, 200),
          }))
          // Sólo se descarta la fila del todo vacía. Una con la casilla de
          // hecha o un responsable puestos es algo que él escribió, y
          // tirarla sin decir nada sería corregirle en silencio.
          .filter((t) => t.descripcion || t.cantidad || t.observaciones
            || t.realizada || t.responsable),
        personal: lista(d.personal, 50).map((p) => txt(p, 200)).filter(Boolean),
        horasContratadas: leerNumero(d.horasContratadas),
        horasExtras: leerNumero(d.horasExtras),
        importes: Object.fromEntries(
          IMPORTES_HOJA.map((i) => [i.campo, leerNumero(d.importes?.[i.campo])])),
        iva: leerNumero(d.iva),
        productosIncluidos: Boolean(d.productosIncluidos),
        observaciones: parrafo(d.observaciones),
      },
    };
  }

  const lineas = lista(d.lineas)
    .map((l) => ({
      descripcion: txt(l?.descripcion, 300),
      cantidad: leerNumero(l?.cantidad),
      importe: leerNumero(l?.importe),
      fecha: fechaValida(l?.fecha) ? l.fecha : '',
    }))
    // La cantidad no cuenta para decidir si está vacía: una línea nueva ya
    // nace con un 1, y guardaría filas en blanco.
    .filter((l) => l.descripcion || l.importe || l.fecha);
  if (!lineas.length) return { error: 'La cuenta de cobro necesita al menos una línea.' };

  return {
    contenido: {
      fecha: d.fecha,
      ciudad: txt(d.ciudad, 120),
      concepto: txt(d.concepto, 300),
      cliente,
      lineas,
      totalHoras: leerNumero(d.totalHoras),
      observaciones: parrafo(d.observaciones),
    },
  };
}

/**
 * Hasta qué día vale un presupuesto: la fecha más los días de validez, en
 * `AAAA-MM-DD`. Vacío si no tiene plazo. Se cuenta en UTC para que el cambio de
 * hora no mueva el día.
 */
export function validoHasta(d) {
  const dias = Math.round(leerNumero(d?.validez));
  if (!dias || !fechaValida(d?.fecha)) return '';
  const f = new Date(`${d.fecha}T00:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

/** El contenido guardado en la base, a objeto. Un JSON roto no tira la página. */
export function leerContenido(texto) {
  try {
    const d = JSON.parse(texto || '{}');
    return d && typeof d === 'object' ? d : {};
  } catch {
    return {};
  }
}
