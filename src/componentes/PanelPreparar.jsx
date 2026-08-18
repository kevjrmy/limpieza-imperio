'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { generarBorradores, confirmarBorradores, descartarBorradores }
  from '../lib/acciones.js';
import { nombrePeriodo, euros, entero, siguienteMes } from '../lib/formato.js';
import { intentar } from './intentar.js';

/**
 * Los tres botones del mes: generar el borrador, confirmarlo y descartarlo.
 *
 * Confirmar y descartar mueven un mes entero de golpe, así que los dos piden
 * confirmación y dicen exactamente cuántas filas van a tocar.
 */
export default function PanelPreparar({ destino, origen, estado, resumen, meses }) {
  const router = useRouter();
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);
  const [hecho, setHecho] = useState(null);

  // El verbo va delante porque los tres botones hacen cosas distintas y el
  // mensaje de un fallo tiene que decir cuál de ellas no salió.
  function lanzar(verbo, fn, ...args) {
    setError(null); setHecho(null);
    empezar(async () => {
      const r = await intentar(() => fn(...args), verbo);
      if (r?.error) { setError(r.error); return; }
      setHecho(r);
      router.refresh();
    });
  }

  // Meses candidatos: los que ya existen y el siguiente al último.
  const candidatos = [...new Set([...meses, siguienteMes(meses[0] ?? '')])]
    .filter(Boolean).sort().reverse();

  return (
    <>
      {error && <p className="alerta alerta--error">{error}</p>}

      {hecho?.confirmados > 0 && (
        <p className="tira tira--ok">
          <span className="tira__punto" aria-hidden="true" />
          <span>
            {entero(hecho.confirmados)} servicios confirmados. Ya cuentan en el margen y en
            el cierre del mes.
          </span>
        </p>
      )}

      <div className="filtros">
        <label className="campo">
          <span>Mes a preparar</span>
          <select value={destino} disabled={enviando}
            onChange={(e) => router.push(`/preparar?mes=${e.target.value}`)}>
            {candidatos.map((m) => (
              <option key={m} value={m}>{nombrePeriodo(m)}</option>
            ))}
          </select>
        </label>
      </div>

      {estado.borradores > 0 ? (
        <section className="bloque bloque--aviso">
          <div className="bloque__cab">
            <h3>{entero(estado.borradores)} servicios en borrador</h3>
            <p className="bloque__cifra">
              <strong>{euros(estado.valorBorradores)}</strong> por confirmar
            </p>
          </div>
          <p className="bloque__desc">
            Repásalos antes de darlos por buenos: cambia lo que haga falta, borra lo que no
            toque y añade lo que falte. Mientras sigan en borrador no cuentan en ningún
            número.
          </p>
          <div className="formulario__acciones">
            <Link className="boton" href={`/servicios?periodo=${destino}&borrador=si`}>
              Revisar los {entero(estado.borradores)}
            </Link>
            <button type="button" className="boton boton--principal" disabled={enviando}
              onClick={() => {
                if (confirm(`¿Confirmar ${estado.borradores} servicios de ${nombrePeriodo(destino)}? A partir de ahí cuentan en el margen y en el cierre.`)) {
                  lanzar('confirmar el mes', confirmarBorradores, destino);
                }
              }}>
              {enviando ? 'Confirmando…' : 'Confirmar el mes'}
            </button>
            <button type="button" className="boton boton--plano" disabled={enviando}
              onClick={() => {
                if (confirm(`¿Descartar los ${estado.borradores} borradores? Se borran y habría que volver a generarlos.`)) {
                  lanzar('descartar los borradores', descartarBorradores, destino);
                }
              }}>
              Descartar
            </button>
          </div>
        </section>
      ) : estado.confirmados === 0 && resumen ? (
        <section className="bloque">
          <div className="bloque__cab">
            <h3>Se propondrían {entero(resumen.propuestas)} servicios</h3>
            <p className="bloque__cifra"><strong>{euros(resumen.valor)}</strong> de facturación</p>
          </div>
          <p className="bloque__desc">
            Salen de <strong>{entero(resumen.pautas)}</strong> rutinas encontradas en{' '}
            {nombrePeriodo(origen)}, que tuvo {entero(resumen.serviciosOrigen)} servicios.
            En <strong>{entero(resumen.conColaborador)}</strong> se puede adelantar quién
            suele ir; en el resto la persona cambia demasiado y la fila sale sin asignar.
            {resumen.irregulares > 0 && <> {entero(resumen.irregulares)} rutinas no caen todas las semanas.</>}
            {resumen.descartados > 0 && <> Se dejan fuera {entero(resumen.descartados)} servicios sueltos.</>}
          </p>
          <div className="formulario__acciones">
            <button type="button" className="boton boton--principal" disabled={enviando}
              onClick={() => lanzar('generar el borrador', generarBorradores, destino, origen)}>
              {enviando ? 'Generando…' : `Generar borrador de ${nombrePeriodo(destino)}`}
            </button>
          </div>
        </section>
      ) : estado.confirmados > 0 ? (
        <p className="vacio">
          Este mes ya está hecho. Elige otro arriba para adelantarlo.
        </p>
      ) : (
        <p className="vacio">
          No hay un mes anterior del que copiar.
        </p>
      )}
    </>
  );
}
