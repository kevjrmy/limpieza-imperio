import { useMemo, useState } from 'react';
import { entero, euros, fecha } from '../lib/formato.js';
import { comoTitulo } from '../lib/texto.js';

/** Una familia de nombres propuesta para unir. Viene aceptada de serie. */
function Propuesta({ prop, cual, rechazada, alAlternar }) {
  const idCasilla = `${cual}-${prop.id}`;
  return (
    <li className={'propuesta' + (rechazada ? ' propuesta--rechazada' : '') +
      (prop.confianza === 'baja' ? ' propuesta--dudosa' : '')}>
      <input
        type="checkbox"
        id={idCasilla}
        checked={!rechazada}
        onChange={() => alAlternar(cual, prop.id)}
      />
      <label htmlFor={idCasilla}>
        <span className="propuesta__resultado">
          {comoTitulo(prop.canonico)}
          {prop.confianza === 'baja' && (
            <span className="marca marca--revisar">revisar</span>
          )}
        </span>

        <span className="propuesta__miembros">
          {prop.miembros.map((m, i) => (
            <span key={m.clave} className="variante">
              {i > 0 && <span className="variante__mas" aria-hidden="true">+</span>}
              <span className="variante__nombre">{m.nombre}</span>
              <span className="variante__usos">{m.usos}</span>
            </span>
          ))}
        </span>

        {prop.confianza === 'baja' && prop.dudosos.length > 0 && (
          <span className="propuesta__motivo">
            {prop.dudosos.map(([a, b]) => `${a} / ${b}`).join(' · ')} se
            diferencian sólo en la terminación. Suelen ser personas distintas:
            desmarca si lo son.
          </span>
        )}
      </label>
    </li>
  );
}

/** Bloque de propuestas de un tipo (clientes o colaboradores). */
function Grupo({ titulo, cual, agrupacion, rechazadas, alAlternar, descripcion }) {
  const [verTodo, setVerTodo] = useState(false);
  const props = agrupacion.propuestas;
  const dudosas = props.filter((p) => p.confianza === 'baja').length;
  const visibles = verTodo ? props : props.slice(0, 8);

  return (
    <section className="bloque">
      <div className="bloque__cab">
        <h3>{titulo}</h3>
        <p className="bloque__cifra">
          <strong>{entero(agrupacion.variantesBrutas)}</strong> formas escritas
          {' · '}
          <strong>{entero(props.length)}</strong> {props.length === 1 ? 'grupo' : 'grupos'} por confirmar
          {dudosas > 0 && <> · <strong className="texto-revisar">{entero(dudosas)}</strong> con dudas</>}
        </p>
      </div>

      <p className="bloque__desc">{descripcion}</p>

      {props.length === 0 ? (
        <p className="vacio">No hay nombres parecidos que confirmar.</p>
      ) : (
        <>
          <ul className="propuestas">
            {visibles.map((p) => (
              <Propuesta
                key={p.id}
                prop={p}
                cual={cual}
                rechazada={rechazadas[cual].has(p.id)}
                alAlternar={alAlternar}
              />
            ))}
          </ul>
          {props.length > 8 && (
            <button type="button" className="boton boton--plano" onClick={() => setVerTodo((v) => !v)}>
              {verTodo ? 'Ver menos' : `Ver los ${props.length - 8} restantes`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Segunda etapa: qué se ha entendido del archivo.
 *
 * Enseña primero lo que se ha dejado fuera y lo que chirría, y sólo después
 * pide confirmación de los nombres. El orden importa: si va a fiarse de los
 * números, tiene que ver antes de dónde NO salen.
 */
export default function Revision({
  lectura, agClientes, agColab, rechazadas, alAlternar,
  alConfirmar, alReiniciar, ocupado,
}) {
  const [verOmitidas, setVerOmitidas] = useState(false);
  const [verAvisos, setVerAvisos] = useState(false);

  const importadas = useMemo(
    () => lectura.hojas.filter((h) => h.estado === 'importada'), [lectura.hojas]);
  const omitidas = useMemo(
    () => lectura.hojas.filter((h) => h.estado === 'omitida'), [lectura.hojas]);

  const avisosAnio = useMemo(
    () => lectura.avisos.filter((a) => a.tipo === 'anio_discrepante'), [lectura.avisos]);
  const avisosColumna = useMemo(
    () => lectura.avisos.filter((a) => a.tipo === 'columna_ausente'), [lectura.avisos]);

  const facturado = useMemo(
    () => lectura.servicios.reduce((a, s) => a + s.valor, 0), [lectura.servicios]);

  const pendientes =
    agClientes.propuestas.length - rechazadas.clientes.size +
    (agColab.propuestas.length - rechazadas.colab.size);

  return (
    <section className="revision">
      <div className="resumen">
        <h2 className="seccion__titulo">Esto es lo que se ha leído</h2>
        <dl className="cifras">
          <div className="cifra">
            <dt>Servicios</dt>
            <dd className="cifra__valor">{entero(lectura.servicios.length)}</dd>
          </div>
          <div className="cifra">
            <dt>Facturado</dt>
            <dd className="cifra__valor cifra__valor--dinero">{euros(facturado)}</dd>
          </div>
          <div className="cifra">
            <dt>Hojas importadas</dt>
            <dd className="cifra__valor">{entero(importadas.length)}</dd>
          </div>
          <div className="cifra">
            <dt>Hojas fuera</dt>
            <dd className="cifra__valor">{entero(omitidas.length)}</dd>
          </div>
        </dl>
      </div>

      {/* ── Hojas ─────────────────────────────────────────────── */}
      <section className="bloque">
        <div className="bloque__cab"><h3>Hojas leídas</h3></div>
        <div className="tabla-envoltorio">
          <table className="tabla">
            <caption className="visualmente-oculto">Hojas importadas del libro</caption>
            <thead>
              <tr>
                <th scope="col">Hoja</th>
                <th scope="col" className="num">Servicios</th>
                <th scope="col">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {importadas.map((h) => (
                <tr key={h.nombre}>
                  <th scope="row" className="celda-nombre">{h.nombre}</th>
                  <td className="num">{entero(h.servicios)}</td>
                  <td className="celda-nota">
                    {h.columnasFaltantes.length > 0 ? (
                      <span className="marca marca--revisar">
                        sin columna {h.columnasFaltantes.join(', ')} · se cuenta como 0
                      </span>
                    ) : <span className="tenue">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="boton boton--plano"
          onClick={() => setVerOmitidas((v) => !v)}
          aria-expanded={verOmitidas}
        >
          {verOmitidas ? 'Ocultar' : `Ver las ${omitidas.length} hojas que se han dejado fuera`}
        </button>

        {verOmitidas && (
          <div className="tabla-envoltorio">
            <table className="tabla tabla--tenue">
              <caption className="visualmente-oculto">Hojas no importadas y su motivo</caption>
              <thead>
                <tr>
                  <th scope="col">Hoja</th>
                  <th scope="col">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {omitidas.map((h) => (
                  <tr key={h.nombre}>
                    <th scope="row" className="celda-nombre">{h.nombre}</th>
                    <td className="celda-nota">{h.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Avisos ────────────────────────────────────────────── */}
      {(avisosAnio.length > 0 || avisosColumna.length > 0) && (
        <section className="bloque bloque--aviso">
          <div className="bloque__cab">
            <h3>Cosas que conviene que mires</h3>
            <p className="bloque__cifra">
              <strong className="texto-revisar">{entero(lectura.avisos.length)}</strong> avisos
            </p>
          </div>

          {avisosColumna.map((a) => (
            <p key={a.hoja} className="aviso-linea">{a.mensaje}</p>
          ))}

          {avisosAnio.length > 0 && (
            <>
              <p className="aviso-linea">
                <strong>{entero(avisosAnio.length)} filas llevan un año que no
                es el de su hoja.</strong> Suele pasar al copiar las filas del mes
                anterior y no cambiar la fecha. No se ha corregido nada: los
                servicios se han guardado con la fecha que tienen escrita.
              </p>
              <button
                type="button"
                className="boton boton--plano"
                onClick={() => setVerAvisos((v) => !v)}
                aria-expanded={verAvisos}
              >
                {verAvisos ? 'Ocultar el detalle' : 'Ver qué filas son'}
              </button>

              {verAvisos && (
                <div className="tabla-envoltorio tabla-envoltorio--alta">
                  <table className="tabla tabla--tenue">
                    <caption className="visualmente-oculto">Filas con año discrepante</caption>
                    <thead>
                      <tr>
                        <th scope="col">Hoja</th>
                        <th scope="col" className="num">Fila</th>
                        <th scope="col">Cliente</th>
                        <th scope="col">Fecha leída</th>
                      </tr>
                    </thead>
                    <tbody>
                      {avisosAnio.map((a, i) => (
                        <tr key={`${a.hoja}-${a.fila}-${i}`}>
                          <td className="celda-nota">{a.hoja}</td>
                          <td className="num">{a.fila}</td>
                          <td className="celda-nombre">{a.cliente}</td>
                          <td className="num texto-revisar">{fecha(a.detalle.fecha)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── Nombres ───────────────────────────────────────────── */}
      <h2 className="seccion__titulo">Nombres que parecen la misma persona</h2>
      <p className="seccion__intro">
        Vienen todos marcados. <strong>Desmarca los que no sean la misma
        persona</strong> y deja el resto como está. Los marcados como
        «revisar» se diferencian sólo en la terminación —Mariano y Mariana,
        Ramón y Ramona— y casi siempre son gente distinta.
      </p>

      <Grupo
        titulo="Clientes"
        cual="clientes"
        agrupacion={agClientes}
        rechazadas={rechazadas}
        alAlternar={alAlternar}
        descripcion="Los nombres iguales salvo tildes o mayúsculas ya se han unido solos."
      />

      <Grupo
        titulo="Colaboradores"
        cual="colab"
        agrupacion={agColab}
        rechazadas={rechazadas}
        alAlternar={alAlternar}
        descripcion="Salen de la celda COLABORADORES, separando por comas y guiones cuando hay varias personas en un mismo servicio."
      />

      <div className="acciones">
        <button
          type="button"
          className="boton boton--principal"
          onClick={alConfirmar}
          disabled={!!ocupado}
        >
          {ocupado || `Ver el panel · ${entero(lectura.servicios.length)} servicios`}
        </button>
        <button type="button" className="boton" onClick={alReiniciar} disabled={!!ocupado}>
          Empezar de nuevo
        </button>
        <p className="acciones__nota">
          Se aplicarán {entero(pendientes)} agrupaciones.
        </p>
      </div>
    </section>
  );
}
