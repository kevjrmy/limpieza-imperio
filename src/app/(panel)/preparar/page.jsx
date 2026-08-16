import Link from 'next/link';

import PanelPreparar from '../../../componentes/PanelPreparar.jsx';
import {
  periodos, mesAnteriorCon, estadoDelMes, analizarRecurrencia,
} from '../../../lib/consultas.js';
import { nombrePeriodo, siguienteMes, euros, entero } from '../../../lib/formato.js';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Preparar el mes · Limpiezas El Imperio' };

export default async function Preparar({ searchParams }) {
  const p = await searchParams;
  const meses = await periodos();
  const ultimo = meses[0] ?? null;

  const destino = typeof p?.mes === 'string' && /^\d{4}-\d{2}$/.test(p.mes)
    ? p.mes
    : (ultimo ? siguienteMes(ultimo) : '');

  if (!destino) {
    return (
      <>
        <h1>Preparar el mes</h1>
        <p className="vacio">Todavía no hay ningún mes del que copiar.</p>
      </>
    );
  }

  const origen = await mesAnteriorCon(destino);
  const estado = await estadoDelMes(destino);
  const analisis = origen ? await analizarRecurrencia(origen, destino) : null;

  return (
    <>
      <h1>Preparar {nombrePeriodo(destino)}</h1>

      <p className="nota-metodo">
        Casi todo se repite: si una persona va a casa de un cliente todos los lunes,
        el mes que viene irá otra vez todos los lunes. Esto mira{' '}
        {origen ? <strong>{nombrePeriodo(origen)}</strong> : 'el mes anterior'} y deja el mes
        siguiente escrito en <strong>borrador</strong>, para que sólo tengas que corregir lo
        que haya cambiado. <strong>Los borradores no cuentan para nada</strong> —ni margen, ni
        cierres, ni exportaciones— hasta que los confirmas.
      </p>

      {estado.confirmados > 0 && (
        <p className="tira tira--aviso">
          <span className="tira__punto" aria-hidden="true" />
          <span>
            {nombrePeriodo(destino)} ya tiene <strong>{entero(estado.confirmados)}</strong>{' '}
            servicios confirmados. No se puede generar encima: duplicaría lo que ya está
            hecho. Elige otro mes o añade los que falten a mano en{' '}
            <Link href={`/servicios?periodo=${destino}`}>Servicios</Link>.
          </span>
        </p>
      )}

      <PanelPreparar
        destino={destino}
        origen={origen}
        estado={estado}
        resumen={analisis?.resumen ?? null}
        meses={meses}
      />

      {analisis && estado.borradores === 0 && estado.confirmados === 0 && (
        <>
          <h2>Lo que se repite en {nombrePeriodo(origen)}</h2>
          <div className="tabla-envoltorio tabla-envoltorio--alta">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Día</th>
                  <th scope="col" className="num">Veces al día</th>
                  <th scope="col" className="num">En {nombrePeriodo(origen)}</th>
                  <th scope="col" className="num">Importe</th>
                  <th scope="col">Quién</th>
                </tr>
              </thead>
              <tbody>
                {analisis.pautas.map((p2) => (
                  <tr key={`${p2.clienteId}-${p2.dia}`}>
                    <th scope="row" className="celda-nombre">{p2.cliente}</th>
                    <td>{p2.nombreDia}</td>
                    <td className="num">{p2.repeticiones}</td>
                    <td className="num">{entero(p2.vecesEnOrigen)}</td>
                    <td className="dinero">{euros(p2.valor)}</td>
                    <td className="celda-nota">
                      {p2.colaborador
                        ? <span className="tenue">habitual</span>
                        : <span className="tenue">sin asignar</span>}
                      {!p2.firme && <> · <span className="texto-revisar">no todas las semanas</span></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analisis.descartados.length > 0 && (
            <>
              <h2>No se copia ({entero(analisis.descartados.length)})</h2>
              <p className="bloque__desc">
                Servicios que en {nombrePeriodo(origen)} ocurrieron una sola vez. Un trabajo
                suelto no es una rutina, y proponerlo sería darte filas que borrar. Si alguno
                se repite este mes, añádelo a mano.
              </p>
              <p className="celda-nota">
                {analisis.descartados.map((d) => `${d.cliente} (${d.dia})`).join(' · ')}
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
