import { useCallback, useEffect, useMemo, useState } from 'react';

import SoltarArchivo from './componentes/SoltarArchivo.jsx';
import Revision from './componentes/Revision.jsx';
import Panel from './componentes/Panel.jsx';
import AvisoAlmacenamiento from './componentes/AvisoAlmacenamiento.jsx';

import { analizarLibro } from './lib/parser.js';
import { agrupar } from './lib/agrupar.js';
import { construirMetricas, repartir } from './lib/metricas.js';
import { clave } from './lib/texto.js';
import { abrirBase, guardarImportacion, limpiarBase, estadoAlmacenamiento } from './lib/db.js';
import { hayImportacion, metricasDesdeSQL, hojasGuardadas, conteosBase } from './lib/consultas.js';

/**
 * Tres etapas, en este orden y sin atajos:
 *
 *   soltar  → el archivo entra y se lee
 *   revisar → se enseña QUÉ se ha entendido, y él corrige lo dudoso
 *   panel   → los números
 *
 * La etapa del medio existe porque los nombres del libro son texto libre. Sin
 * ella el panel daría cifras precisas sobre agrupaciones que nadie ha visto.
 */
export default function App() {
  const [etapa, setEtapa] = useState('soltar');
  const [ocupado, setOcupado] = useState(null);
  const [error, setError] = useState(null);

  const [lectura, setLectura] = useState(null);       // { hojas, servicios, avisos }
  const [agClientes, setAgClientes] = useState(null);
  const [agColab, setAgColab] = useState(null);
  const [rechazadas, setRechazadas] = useState({ clientes: new Set(), colab: new Set() });

  const [metricas, setMetricas] = useState(null);
  const [resumenBase, setResumenBase] = useState(null);
  const [almacen, setAlmacen] = useState(estadoAlmacenamiento);
  const [hayGuardado, setHayGuardado] = useState(false);

  // La base se abre al arrancar para poder avisar del modo de guardado antes
  // de que suelte el archivo, no después de haber importado.
  useEffect(() => {
    let vivo = true;
    abrirBase()
      .then(async (info) => {
        if (!vivo) return;
        setAlmacen({ ...info });
        // Si quedó una importación de otra sesión, se ofrece retomarla en vez
        // de hacerle buscar el archivo otra vez.
        setHayGuardado(await hayImportacion());
      })
      .catch(() => { if (vivo) setAlmacen({ ...estadoAlmacenamiento }); });
    return () => { vivo = false; };
  }, []);

  const procesarArchivo = useCallback(async (archivo) => {
    setError(null);
    setOcupado('Leyendo el archivo…');
    try {
      const XLSX = await import('xlsx');
      const datos = new Uint8Array(await archivo.arrayBuffer());

      setOcupado('Analizando las hojas…');
      const resultado = analizarLibro(datos, XLSX);

      if (!resultado.servicios.length) {
        const conCabecera = resultado.hojas.length;
        throw new Error(conCabecera
          ? 'Se han encontrado hojas de clientes, pero ninguna con la maquetación de 2026 (columnas «VALOR DEL SERVICIO» y «COLABORADORES»).'
          : 'Este archivo no tiene ninguna hoja que empiece por «CLIENTES».');
      }

      setOcupado('Agrupando nombres…');
      const ac = agrupar(resultado.servicios.map((s) => s.cliente));
      const ak = agrupar(resultado.servicios.flatMap((s) => s.colaboradores));

      setLectura(resultado);
      setAgClientes(ac);
      setAgColab(ak);
      // Todas las propuestas entran aceptadas: desmarcar lo que sobra es más
      // barato que marcar decenas de casillas para llegar al panel.
      setRechazadas({ clientes: new Set(), colab: new Set() });
      setEtapa('revisar');
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setOcupado(null);
    }
  }, []);

  const alternar = useCallback((cual, id) => {
    setRechazadas((prev) => {
      const copia = new Set(prev[cual]);
      copia.has(id) ? copia.delete(id) : copia.add(id);
      return { ...prev, [cual]: copia };
    });
  }, []);

  const aceptadas = useMemo(() => {
    if (!agClientes || !agColab) return null;
    return {
      clientes: new Set(agClientes.propuestas.map((p) => p.id).filter((id) => !rechazadas.clientes.has(id))),
      colab: new Set(agColab.propuestas.map((p) => p.id).filter((id) => !rechazadas.colab.has(id))),
    };
  }, [agClientes, agColab, rechazadas]);

  const confirmar = useCallback(async () => {
    setError(null);
    setOcupado('Calculando…');
    try {
      const resCli = agClientes.aplicar(aceptadas.clientes);
      const resCol = agColab.aplicar(aceptadas.colab);
      const m = construirMetricas(lectura.servicios, resCli.mapa, resCol.mapa);

      // Se resuelven aquí los nombres definitivos y el reparto por persona, de
      // forma que lo que se guarda es exactamente lo que se enseña.
      const servicios = lectura.servicios.map((s) => {
        const nombres = [...new Set(s.colaboradores.map((r) => resCol.mapa.get(clave(r)) || r))];
        const partes = repartir(s.pagoColab, nombres.length);
        return {
          ...s,
          cliente: resCli.mapa.get(s.clienteClave) || s.cliente,
          trabajadores: nombres.map((nombre, i) => ({ nombre, pago: partes[i] })),
        };
      });

      setOcupado('Guardando en SQLite…');
      let resumen = null;
      try {
        resumen = await guardarImportacion({
          servicios, avisos: lectura.avisos, hojas: lectura.hojas,
        });
      } catch (e) {
        // Que falle el guardado no debe impedirle ver sus números.
        setError(`Los datos se han calculado, pero no se han podido guardar en SQLite: ${e.message}`);
      }

      setResumenBase(resumen);
      setMetricas(m);
      setEtapa('panel');
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setOcupado(null);
    }
  }, [agClientes, agColab, aceptadas, lectura]);

  /** Rehace el panel leyendo de SQLite, sin volver a pedir el archivo. */
  const retomar = useCallback(async () => {
    setError(null);
    setOcupado('Leyendo la importación guardada…');
    try {
      const [m, hojas, conteos] = await Promise.all([
        metricasDesdeSQL(), hojasGuardadas(), conteosBase(),
      ]);
      setMetricas(m);
      setResumenBase(conteos);
      setLectura({ hojas, servicios: [], avisos: [] });
      setEtapa('panel');
    } catch (e) {
      setError(`No se ha podido recuperar la importación guardada: ${e.message}`);
      setHayGuardado(false);
    } finally {
      setOcupado(null);
    }
  }, []);

  const descartarGuardado = useCallback(async () => {
    try { await limpiarBase(); } catch { /* si no se puede, no pasa nada */ }
    setHayGuardado(false);
  }, []);

  const reiniciar = useCallback(() => {
    setLectura(null); setAgClientes(null); setAgColab(null);
    setMetricas(null); setResumenBase(null); setError(null);
    setRechazadas({ clientes: new Set(), colab: new Set() });
    setEtapa('soltar');
  }, []);

  const etapas = [
    { id: 'soltar', n: 1, etiqueta: 'Archivo' },
    { id: 'revisar', n: 2, etiqueta: 'Revisión' },
    { id: 'panel', n: 3, etiqueta: 'Panel' },
  ];
  const indiceActual = etapas.findIndex((e) => e.id === etapa);

  return (
    <div className="app">
      <header className="cabecera">
        <div className="cabecera__titulo">
          <h1>Limpiezas El Imperio</h1>
          <p className="cabecera__sub">Contabilidad de servicios · La Pobla de Vallbona</p>
        </div>

        <nav className="pasos" aria-label="Progreso">
          <ol>
            {etapas.map((e, i) => (
              <li
                key={e.id}
                className={
                  'paso' +
                  (i === indiceActual ? ' paso--actual' : '') +
                  (i < indiceActual ? ' paso--hecho' : '')
                }
                aria-current={i === indiceActual ? 'step' : undefined}
              >
                <span className="paso__n" aria-hidden="true">{e.n}</span>
                <span className="paso__etiqueta">{e.etiqueta}</span>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <AvisoAlmacenamiento estado={almacen} />

      {error && (
        <div className="alerta alerta--error" role="alert">
          <strong>No se ha podido continuar.</strong>
          <p>{error}</p>
        </div>
      )}

      <main>
        {etapa === 'soltar' && (
          <>
            {hayGuardado && !ocupado && (
              <div className="retomar">
                <p>
                  Hay una importación anterior guardada en este navegador.
                </p>
                <div className="retomar__acciones">
                  <button type="button" className="boton" onClick={retomar}>
                    Ver esos números
                  </button>
                  <button type="button" className="boton boton--plano" onClick={descartarGuardado}>
                    Descartarla
                  </button>
                </div>
              </div>
            )}
            <SoltarArchivo alSoltar={procesarArchivo} ocupado={ocupado} />
          </>
        )}

        {etapa === 'revisar' && lectura && (
          <Revision
            lectura={lectura}
            agClientes={agClientes}
            agColab={agColab}
            rechazadas={rechazadas}
            alAlternar={alternar}
            alConfirmar={confirmar}
            alReiniciar={reiniciar}
            ocupado={ocupado}
          />
        )}

        {etapa === 'panel' && metricas && (
          <Panel
            metricas={metricas}
            lectura={lectura}
            resumenBase={resumenBase}
            almacen={almacen}
            alReiniciar={reiniciar}
            alVolverARevisar={agClientes ? () => setEtapa('revisar') : null}
          />
        )}
      </main>

      <footer className="pie">
        <p>
          El archivo no sale de este navegador: se lee en memoria y se guarda en
          una base SQLite local. No hay servidor, no hay subida, no hay copia.
        </p>
      </footer>
    </div>
  );
}
