import Link from 'next/link';

import { totales, porMes, clientes, pendientes } from '../../lib/consultas.js';
import { euros, numero, entero, porcentaje, nombrePeriodo } from '../../lib/formato.js';
import { tonoDinero } from '../../componentes/formato.js';

export const dynamic = 'force-dynamic';

function Cifra({ etiqueta, valor, pie, dinero = true }) {
  return (
    <div className="cifra">
      <dt>{etiqueta}</dt>
      <dd className={`cifra__valor${dinero ? ' cifra__valor--dinero' : ''}`}>{valor}</dd>
      {pie && <dd className="cifra__pie">{pie}</dd>}
    </div>
  );
}

export default async function Resumen() {
  const [t, meses, listaClientes, pend] = await Promise.all([
    totales(), porMes(), clientes(), pendientes(),
  ]);

  const activos = listaClientes.filter((c) => c.servicios > 0);
  const enPerdida = activos.filter((c) => c.margen < 0).sort((a, b) => a.margen - b.margen);
  const mejores = activos.slice(0, 8);

  return (
    <>
      <h1>Resumen</h1>

      <dl className="cifras">
        <Cifra etiqueta="Facturado" valor={euros(t.facturado)}
          pie={`${entero(t.servicios)} servicios · ${numero(t.horas)} h`} />
        <Cifra etiqueta="Pagado a colaboradores" valor={euros(t.pagoColab)}
          pie={`${porcentaje(t.pagoColab, t.facturado)} de lo facturado`} />
        <Cifra etiqueta="Margen de los servicios" valor={euros(t.margen)}
          pie={`${porcentaje(t.margen, t.facturado)} de lo facturado`} />
      </dl>

      <p className="nota-metodo">
        <strong>Margen</strong> = facturado − (pago a colaboradores + transporte).
        Los gastos de empresa no se reparten entre clientes: se descuentan del mes,
        en <Link href="/meses">Meses</Link>.
      </p>

      {(pend?.avisos > 0 || pend?.fusiones > 0) && (
        <p className="tira tira--aviso">
          <span className="tira__punto" aria-hidden="true" />
          <span>
            Quedan <strong>{entero(pend.avisos)}</strong> avisos y{' '}
            <strong>{entero(pend.fusiones)}</strong> nombres por decidir, heredados del
            Excel. <Link href="/revisar">Revisarlos</Link>.
          </span>
        </p>
      )}

      <h2>Por mes</h2>
      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col" className="num">Servicios</th>
              <th scope="col" className="num">Horas</th>
              <th scope="col" className="num">Facturado</th>
              <th scope="col" className="num">Colaboradores</th>
              <th scope="col" className="num">Margen</th>
              <th scope="col" className="num">Gastos</th>
              <th scope="col" className="num">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.periodo}>
                <th scope="row">
                  <Link href={`/meses/${m.periodo}`}>{nombrePeriodo(m.periodo)}</Link>
                </th>
                <td className="num">{entero(m.servicios)}</td>
                <td className="num">{numero(m.horas)}</td>
                <td className="dinero">{euros(m.facturado)}</td>
                <td className="dinero">{euros(m.pagoColab)}</td>
                <td className={`dinero ${tonoDinero(m.margen)}`}>{euros(m.margen)}</td>
                <td className="dinero">{euros(m.gastos + m.fijos)}</td>
                <td className={`dinero ${tonoDinero(m.resultado)}`}>{euros(m.resultado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bloque__pie">
        El resultado descuenta del margen los gastos de empresa, los costes fijos, la
        seguridad social, la gestoría y las retenciones de cada mes.
      </p>

      {enPerdida.length > 0 && (
        <section className="bloque bloque--perdida">
          <div className="bloque__cab">
            <h3>Clientes en pérdida</h3>
            <p className="bloque__cifra"><strong>{entero(enPerdida.length)}</strong> de {entero(activos.length)}</p>
          </div>
          <p className="bloque__desc">
            Le cuestan más de lo que le pagan. Es lo primero que hay que mirar.
          </p>
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col" className="num">Servicios</th>
                  <th scope="col" className="num">Facturado</th>
                  <th scope="col" className="num">Margen</th>
                </tr>
              </thead>
              <tbody>
                {enPerdida.map((c) => (
                  <tr key={c.id} className="fila--perdida">
                    <th scope="row" className="celda-nombre">
                      <Link href={`/clientes/${c.id}`}>{c.nombre}</Link>
                    </th>
                    <td className="num">{entero(c.servicios)}</td>
                    <td className="dinero">{euros(c.facturado)}</td>
                    <td className="dinero dinero--perdida">{euros(c.margen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <h2>Los que más dejan</h2>
      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col" className="num">Servicios</th>
              <th scope="col" className="num">Facturado</th>
              <th scope="col" className="num">Margen</th>
              <th scope="col" className="num">%</th>
            </tr>
          </thead>
          <tbody>
            {mejores.map((c) => (
              <tr key={c.id}>
                <th scope="row" className="celda-nombre">
                  <Link href={`/clientes/${c.id}`}>{c.nombre}</Link>
                </th>
                <td className="num">{entero(c.servicios)}</td>
                <td className="dinero">{euros(c.facturado)}</td>
                <td className={`dinero ${tonoDinero(c.margen)}`}>{euros(c.margen)}</td>
                <td className="num">{porcentaje(c.margen, c.facturado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
