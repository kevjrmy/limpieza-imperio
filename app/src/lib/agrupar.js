/**
 * Agrupación de nombres escritos a mano.
 *
 * El nombre es la única clave de unión que existe en el libro y es texto libre.
 * Se trabaja en dos niveles deliberadamente distintos:
 *
 *   1. EXACTO      — idénticos al normalizar (mayúsculas, acentos, espacios).
 *                    Se fusionan solos, sin preguntar.
 *   2. PROPUESTO   — probablemente la misma persona. Se propone y decide una
 *                    persona. Nunca se aplica a ciegas.
 *
 * Dos salvaguardas gobiernan el nivel 2, y ambas existen porque el caso
 * contrario destruye datos reales:
 *
 *   · Un nombre de pila compartido seguido de inicial NO se fusiona.
 *     ELENA P, ELENA M, ELENA V, ELENA PRADOS y ELENA MOLINA pueden ser cinco
 *     personas distintas. Una inicial suelta es ambigua por definición:
 *     "ELENA P" podría ser Prados o Peris.
 *
 *   · Los pares que sólo cambian la terminación de género se marcan de baja
 *     confianza: MARIANO/MARIANA, RAMON/RAMONA suelen ser personas distintas.
 *     No se descartan —él conoce a su gente— pero se señalan y se colocan las
 *     primeras en la pantalla de revisión.
 */

import { clave } from './texto.js';

const LONGITUD_MINIMA = 6;      // por debajo, cualquier parecido es ruido
const DISTANCIA_MAXIMA = 2;
const PROPORCION_MAXIMA = 0.2;  // la distancia no puede pasar del 20% del largo

/** Sufijos que convierten un nombre en su variante de otro género. */
const SUFIJOS_GENERO = ['A', 'O', 'IA', 'ITO', 'ITA'];

/** Distancia de Levenshtein con dos filas rodantes. */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previa = new Array(b.length + 1);
  let actual = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) previa[j] = j;

  for (let i = 1; i <= a.length; i++) {
    actual[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const coste = ca === b.charCodeAt(j - 1) ? 0 : 1;
      actual[j] = Math.min(actual[j - 1] + 1, previa[j] + 1, previa[j - 1] + coste);
    }
    [previa, actual] = [actual, previa];
  }
  return previa[b.length];
}

const partes = (s) => s.split(' ').filter(Boolean);

/**
 * Apellidos distintos que aparecen colgando de cada nombre de pila.
 *
 * Es el índice que hace falta para saber si «ELENA P» es ambiguo. Se cuentan
 * apellidos de verdad (dos letras o más) y se colapsan los que son prefijo de
 * otro: «ELENA MOL» y «ELENA MOLINA» son el mismo apellido escrito a medias.
 *
 * @param {string[]} claves  todas las claves normalizadas del conjunto
 * @returns {Map<string, Set<string>>} nombre de pila → apellidos distintos
 */
export function indiceApellidos(claves) {
  const bruto = new Map();
  for (const k of claves) {
    const p = partes(k);
    if (p.length < 2) continue;
    const apellido = p[1];
    if (apellido.length < 2) continue;   // una inicial no identifica familia
    if (!bruto.has(p[0])) bruto.set(p[0], new Set());
    bruto.get(p[0]).add(apellido);
  }

  // Colapsa el apellido truncado contra su forma larga (VAS → VASQUEZ) y el
  // apellido mal tecleado contra el bueno (LONDONNP → LONDONO). Ninguno de los
  // dos casos es un apellido distinto, y contarlos como tales haría parecer
  // ambiguo un nombre que no lo es.
  const indice = new Map();
  for (const [pila, apellidos] of bruto) {
    const lista = [...apellidos].sort((x, y) => y.length - x.length);
    const canonicos = [];
    for (const ap of lista) {
      const yaEsta = canonicos.some((c) => {
        if (c.startsWith(ap)) return true;
        const d = levenshtein(c, ap);
        return d <= DISTANCIA_MAXIMA && d <= Math.max(c.length, ap.length) * PROPORCION_MAXIMA;
      });
      if (!yaEsta) canonicos.push(ap);
    }
    indice.set(pila, new Set(canonicos));
  }
  return indice;
}

/**
 * Salvaguarda 1: nombre de pila compartido, sin apellido que desempate.
 *
 * Cuando dos nombres empiezan igual y en al menos uno el resto es una inicial
 * suelta —o no hay resto en absoluto— la única forma de decidir es saber
 * cuántos apellidos distintos cuelgan de ese nombre de pila en todo el libro:
 *
 *   · Si de ELENA cuelgan PRADOS, MOLINA y VIDAL, «ELENA P» podría ser Prados
 *     o Peris, y «ELENA» a secas podría ser cualquiera de las tres. Se bloquea:
 *     ELENA P, ELENA M, ELENA PRADOS y ELENA MOLINA se quedan como personas
 *     distintas, que es lo que probablemente son.
 *
 *   · Si de BEATRIZ sólo cuelga SOLANO, no hay ambigüedad posible, así que
 *     BEATRIZ → BEATRIZ SOLANO sí se propone (y una persona lo confirma).
 *
 * @param {Map<string, Set<string>>} indice  salida de `indiceApellidos`
 */
export function bloqueadoPorInicial(a, b, indice) {
  const pa = partes(a);
  const pb = partes(b);
  if (pa[0] !== pb[0]) return false;

  const restoA = pa.slice(1).join(' ');
  const restoB = pb.slice(1).join(' ');
  if (restoA === restoB) return false;

  // Sólo hay ambigüedad si a algún lado le falta el apellido entero.
  const sinApellido = (r) => r.length <= 1;
  if (!sinApellido(restoA) && !sinApellido(restoB)) return false;

  return (indice.get(pa[0])?.size ?? 0) > 1;
}

/**
 * Salvaguarda 2: par que sólo se diferencia en la terminación de género.
 * Marca baja confianza, no rechazo.
 */
export function esVarianteDeGenero(a, b) {
  if (a === b) return false;

  // Misma longitud y una sola edición: MARIANO / MARIANA.
  if (a.length === b.length && levenshtein(a, b) === 1) return true;

  // Uno es prefijo del otro y lo que sobra es una terminación de género:
  // RAMON → RAMONA, o las formas en -IA.
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  if (largo.startsWith(corto)) {
    const sufijo = largo.slice(corto.length);
    if (SUFIJOS_GENERO.includes(sufijo)) return true;
  }
  return false;
}

/**
 * ¿Deben proponerse `a` y `b` como la misma persona?
 * Devuelve null si no, o { motivo, confianza } si sí.
 */
export function evaluarPar(a, b, indice = new Map()) {
  if (a === b) return null;
  if (a.length < LONGITUD_MINIMA || b.length < LONGITUD_MINIMA) return null;
  if (bloqueadoPorInicial(a, b, indice)) return null;

  const largo = Math.max(a.length, b.length);
  const [corto, mayor] = a.length <= b.length ? [a, b] : [b, a];

  let motivo = null;
  if (mayor.startsWith(corto)) {
    motivo = 'prefijo';
  } else {
    const d = levenshtein(a, b);
    if (d <= DISTANCIA_MAXIMA && d <= largo * PROPORCION_MAXIMA) {
      motivo = 'distancia';
    }
  }
  if (!motivo) return null;

  return {
    motivo,
    confianza: esVarianteDeGenero(a, b) ? 'baja' : 'alta',
  };
}

/** Conjuntos disjuntos con compresión de camino. */
function crearUnion(claves) {
  const padre = new Map(claves.map((k) => [k, k]));
  const raiz = (k) => {
    let r = k;
    while (padre.get(r) !== r) r = padre.get(r);
    while (padre.get(k) !== r) { const s = padre.get(k); padre.set(k, r); k = s; }
    return r;
  };
  return {
    raiz,
    unir(a, b) {
      const ra = raiz(a); const rb = raiz(b);
      if (ra !== rb) padre.set(ra, rb);
    },
  };
}

/**
 * Agrupa una lista de apariciones de nombres.
 *
 * @param {string[]} apariciones  un elemento por uso (los repetidos importan:
 *                                la variante más usada será la canónica)
 * @returns {{
 *   variantesBrutas: number,
 *   gruposExactos: Array,
 *   propuestas: Array,
 *   aplicar: (idsAceptadas: Set<string>) => { clusters: Array, mapa: Map }
 * }}
 */
export function agrupar(apariciones) {
  // --- Nivel 1: exacto -----------------------------------------------------
  const brutas = new Map();   // texto tal cual → nº de usos
  for (const bruto of apariciones) {
    const t = String(bruto ?? '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    brutas.set(t, (brutas.get(t) || 0) + 1);
  }

  const exactos = new Map();  // clave normalizada → grupo
  for (const [texto, usos] of brutas) {
    const k = clave(texto);
    if (!k) continue;
    let g = exactos.get(k);
    if (!g) { g = { clave: k, variantes: new Map(), usos: 0 }; exactos.set(k, g); }
    g.variantes.set(texto, (g.variantes.get(texto) || 0) + usos);
    g.usos += usos;
  }

  // Forma canónica: la variante más usada; a igualdad, la más larga, y luego
  // por orden alfabético para que el resultado sea estable entre ejecuciones.
  for (const g of exactos.values()) {
    g.canonico = [...g.variantes.entries()].sort(
      (x, y) => y[1] - x[1] || y[0].length - x[0].length || x[0].localeCompare(y[0], 'es'),
    )[0][0];
  }

  // --- Nivel 2: propuestas -------------------------------------------------
  const claves = [...exactos.keys()].sort();
  const indice = indiceApellidos(claves);

  // Pares que superan las reglas...
  const enlaces = [];
  const uniónPropuesta = crearUnion(claves);
  for (let i = 0; i < claves.length; i++) {
    for (let j = i + 1; j < claves.length; j++) {
      const ev = evaluarPar(claves[i], claves[j], indice);
      if (!ev) continue;
      enlaces.push({ a: claves[i], b: claves[j], ...ev });
      uniónPropuesta.unir(claves[i], claves[j]);
    }
  }

  // ...y agrupados en familias de nombre. Se revisa una familia entera de una
  // vez: enseñar «SONIA RUIZ = SONNIA RUIZ» y «SONNIA RUIZ = ONIA RUIZ» como
  // dos preguntas sueltas es pedirle que resuelva dos veces lo mismo.
  const familias = new Map();
  for (const k of claves) {
    const r = uniónPropuesta.raiz(k);
    if (!familias.has(r)) familias.set(r, []);
    familias.get(r).push(k);
  }

  const propuestas = [];
  for (const [raiz, miembros] of familias) {
    if (miembros.length < 2) continue;
    const grupos = miembros
      .map((k) => exactos.get(k))
      .sort((x, y) => y.usos - x.usos || x.clave.localeCompare(y.clave, 'es'));

    const propios = enlaces.filter((e) => miembros.includes(e.a) && miembros.includes(e.b));
    const confianza = propios.some((e) => e.confianza === 'baja') ? 'baja' : 'alta';

    propuestas.push({
      id: `g:${raiz}`,
      confianza,
      motivos: [...new Set(propios.map((e) => e.motivo))],
      // El primero es el nombre que quedará; los demás se absorben.
      canonico: grupos[0].canonico,
      miembros: grupos.map((g) => ({
        clave: g.clave,
        nombre: g.canonico,
        usos: g.usos,
        variantes: [...g.variantes.keys()],
      })),
      usos: grupos.reduce((a, g) => a + g.usos, 0),
      // Pares de baja confianza, para poder explicar POR QUÉ hay que mirarla.
      dudosos: propios
        .filter((e) => e.confianza === 'baja')
        .map((e) => [exactos.get(e.a).canonico, exactos.get(e.b).canonico]),
    });
  }

  // Baja confianza primero: son las que de verdad necesitan un par de ojos.
  propuestas.sort((x, y) => {
    if (x.confianza !== y.confianza) return x.confianza === 'baja' ? -1 : 1;
    return y.usos - x.usos || x.id.localeCompare(y.id);
  });

  const gruposExactos = [...exactos.values()];

  /** Aplica el subconjunto de propuestas aceptadas y devuelve los grupos finales. */
  function aplicar(idsAceptadas) {
    const u = crearUnion(claves);
    for (const p of propuestas) {
      if (!idsAceptadas.has(p.id)) continue;
      for (let i = 1; i < p.miembros.length; i++) {
        u.unir(p.miembros[0].clave, p.miembros[i].clave);
      }
    }

    const porRaiz = new Map();
    for (const g of gruposExactos) {
      const r = u.raiz(g.clave);
      let c = porRaiz.get(r);
      if (!c) { c = { id: r, usos: 0, variantes: new Map(), claves: [] }; porRaiz.set(r, c); }
      c.usos += g.usos;
      c.claves.push(g.clave);
      for (const [texto, usos] of g.variantes) {
        c.variantes.set(texto, (c.variantes.get(texto) || 0) + usos);
      }
    }

    const clusters = [];
    const mapa = new Map();  // clave normalizada → nombre canónico del cluster
    for (const c of porRaiz.values()) {
      c.canonico = [...c.variantes.entries()].sort(
        (x, y) => y[1] - x[1] || y[0].length - x[0].length || x[0].localeCompare(y[0], 'es'),
      )[0][0];
      clusters.push(c);
      for (const k of c.claves) mapa.set(k, c.canonico);
    }
    clusters.sort((a, b) => b.usos - a.usos || a.canonico.localeCompare(b.canonico, 'es'));

    return { clusters, mapa };
  }

  return {
    variantesBrutas: brutas.size,
    gruposExactos,
    propuestas,
    aplicar,
  };
}
