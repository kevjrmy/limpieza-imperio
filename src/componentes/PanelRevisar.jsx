'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { resolverAviso, aplicarFusion, rechazarFusion } from '../lib/acciones.js';
import { entero } from '../lib/formato.js';

/**
 * Lo que quedó pendiente al traerse el Excel.
 *
 * Dos listas con naturaleza distinta:
 *
 *  · Avisos: cosas que no cuadraban y que NO se corrigieron solas. Se marcan
 *    como vistas cuando él las resuelve o decide que le da igual.
 *
 *  · Fusiones: nombres que podrían ser la misma persona. Aplicarlas mueve
 *    historial de un nombre a otro y borra el que sobra, así que no se hace
 *    nada sin que él lo diga. Agrupar de menos se arregla luego; agrupar de más
 *    destruye datos.
 */
export default function PanelRevisar({ avisos, fusiones, resumen }) {
  const router = useRouter();
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);
  const [tipoVisible, setTipoVisible] = useState('');

  function hacer(fn, ...args) {
    setError(null);
    empezar(async () => {
      const r = await fn(...args);
      if (r?.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  const visibles = tipoVisible ? avisos.filter((a) => a.tipo === tipoVisible) : avisos;

  return (
    <>
      {error && <p className="alerta alerta--error">{error}</p>}

      <section className="bloque">
        <div className="bloque__cab">
          <h3>Nombres que podrían ser la misma persona</h3>
          <p className="bloque__cifra"><strong>{entero(fusiones.length)}</strong> por decidir</p>
        </div>
        <p className="bloque__desc">
          Nada de esto se ha aplicado. Aceptar une el historial de los dos nombres bajo uno
          solo y borra el otro; eso no se puede deshacer. Las marcadas en ámbar son las que
          más fácil es equivocarse: cambian sólo en la terminación, y suelen ser dos
          personas distintas.
        </p>

        {fusiones.length === 0 ? (
          <p className="vacio">No queda ningún nombre por decidir.</p>
        ) : (
          <ul className="propuestas">
            {fusiones.map((f) => (
              <li key={f.id}
                className={`propuesta${f.confianza === 'baja' ? ' propuesta--dudosa' : ''}`}>
                <div>
                  <span className="propuesta__resultado">
                    {f.quedaria}
                    {f.confianza === 'baja' && <> <span className="marca marca--revisar">revisar</span></>}
                  </span>
                  <span className="propuesta__miembros">
                    absorbería: {f.absorberia}
                  </span>
                  <span className="propuesta__motivo">
                    {f.tabla} · {f.motivo} · {entero(f.usos)} usos
                    {f.ojo && ` · ${f.ojo}`}
                  </span>
                </div>
                <div className="acciones-fila">
                  <button type="button" className="boton" disabled={enviando}
                    onClick={() => {
                      if (confirm(`Unir todo bajo «${f.quedaria}»? No se puede deshacer.`)) {
                        hacer(aplicarFusion, f.id);
                      }
                    }}>
                    Unir
                  </button>
                  <button type="button" className="boton boton--plano" disabled={enviando}
                    onClick={() => hacer(rechazarFusion, f.id)}>
                    Son distintos
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bloque bloque--aviso">
        <div className="bloque__cab">
          <h3>Avisos heredados del Excel</h3>
          <p className="bloque__cifra"><strong>{entero(avisos.length)}</strong> sin resolver</p>
        </div>
        <p className="bloque__desc">
          Nada de esto se corrigió por su cuenta al importar. Cada línea dice de qué fila del
          Excel viene, para poder ir a mirarla.
        </p>

        <div className="filtros">
          <label className="campo">
            <span>Tipo</span>
            <select value={tipoVisible} onChange={(e) => setTipoVisible(e.target.value)}>
              <option value="">Todos ({entero(avisos.length)})</option>
              {resumen.map((r) => (
                <option key={r.tipo} value={r.tipo}>{r.tipo} ({entero(r.n)})</option>
              ))}
            </select>
          </label>
        </div>

        {visibles.length === 0 ? (
          <p className="vacio">No queda ningún aviso.</p>
        ) : (
          <div className="tabla-envoltorio tabla-envoltorio--alta">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Tipo</th>
                  <th scope="col">Origen</th>
                  <th scope="col">Detalle</th>
                  <th scope="col"><span className="visualmente-oculto">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {visibles.slice(0, 300).map((a) => (
                  <tr key={a.id}>
                    <td className="tenue">{a.tipo}</td>
                    <td className="celda-nota">{a.origen}</td>
                    <td className="celda-nota">{a.detalle}</td>
                    <td className="acciones-fila">
                      <button type="button" className="boton boton--plano" disabled={enviando}
                        onClick={() => hacer(resolverAviso, a.id, true)}>
                        Visto
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visibles.length > 300 && (
          <p className="bloque__pie">
            Se enseñan los 300 primeros de {entero(visibles.length)}. Filtra por tipo para ver el resto.
          </p>
        )}
      </section>
    </>
  );
}
