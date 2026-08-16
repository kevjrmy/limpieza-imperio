import Link from 'next/link';

import { porMes } from '../../lib/consultas.js';
import { euros, numero, entero, nombrePeriodo } from '../../lib/formato.js';
import { tonoDinero } from '../../componentes/formato.js';

export const dynamic = 'force-dynamic';

export default async function Meses() {
  const meses = await porMes();

  const suma = (campo) => meses.reduce((a, m) => a + (Number(m[campo]) || 0), 0);

  return (
    <>
      <h1>Meses</h1>

      <p className="nota-metodo">
        De arriba abajo: lo que se factura, lo que cuesta hacerlo y lo que queda.
        El <strong>margen</strong> es de los servicios; el <strong>resultado</strong> ya
        descuenta gastos de empresa, costes fijos, seguridad social, gestoría y retenciones.
      </p>

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
              <th scope="col" className="num">Fijos</th>
              <th scope="col" className="num">Seg. social</th>
              <th scope="col" className="num">Gestoría</th>
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
                <td className="dinero">{euros(m.gastos)}</td>
                <td className="dinero">{euros(m.fijos)}</td>
                <td className="dinero">{euros(m.segSoc)}</td>
                <td className="dinero">{euros(m.gestoria)}</td>
                <td className={`dinero ${tonoDinero(m.resultado)}`}>{euros(m.resultado)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num">{entero(suma('servicios'))}</td>
              <td className="num">{numero(suma('horas'))}</td>
              <td className="dinero">{euros(suma('facturado'))}</td>
              <td className="dinero">{euros(suma('pagoColab'))}</td>
              <td className="dinero">{euros(suma('margen'))}</td>
              <td className="dinero">{euros(suma('gastos'))}</td>
              <td className="dinero">{euros(suma('fijos'))}</td>
              <td className="dinero">{euros(suma('segSoc'))}</td>
              <td className="dinero">{euros(suma('gestoria'))}</td>
              <td className={`dinero ${tonoDinero(suma('resultado'))}`}>
                {euros(suma('resultado'))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
