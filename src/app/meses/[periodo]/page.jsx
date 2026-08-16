import Link from 'next/link';
import { notFound } from 'next/navigation';

import FormularioCierre from '../../../componentes/FormularioCierre.jsx';
import {
  porMes, cierre, gastos, costesFijos
} from '../../../lib/consultas.js';
import { euros, numero, entero, nombrePeriodo } from '../../../lib/formato.js';
import { tonoDinero } from '../../../componentes/formato.js';

export const dynamic = 'force-dynamic';

export default async function Mes({ params }) {
  const { periodo } = await params;
  if (!/^\d{4}-\d{2}$/.test(periodo)) notFound();

  const meses = await porMes();
  const m = meses.find((x) => x.periodo === periodo);
  if (!m) notFound();

  const [c, listaGastos, fijos] = await Promise.all([
    cierre(periodo), gastos({ periodo }), costesFijos({ periodo }),
  ]);

  // Cada línea que separa el margen del resultado, en el orden en que se resta.
  const lineas = [
    ['Facturado', m.facturado, ''],
    ['Pago a colaboradores', -m.pagoColab, ''],
    ['Transporte', -m.transporte, ''],
    ['Margen de los servicios', m.margen, 'suma'],
    ['Gastos de empresa', -m.gastos, ''],
    ['Costes fijos', -m.fijos, ''],
    ['Seguridad social', -m.segSoc, ''],
    ['Gestoría', -m.gestoria, ''],
    ['IVA / IRPF', -m.ivaIrpf, ''],
    ['Resultado del mes', m.resultado, 'suma'],
  ];

  return (
    <>
      <p className="nota"><Link href="/meses">← Meses</Link></p>
      <h1>{nombrePeriodo(periodo)}</h1>

      <dl className="ficha">
        <div><dt>Servicios</dt><dd>{entero(m.servicios)}</dd></div>
        <div><dt>Horas</dt><dd>{numero(m.horas)}</dd></div>
        <div><dt>Facturado</dt><dd className="dinero">{euros(m.facturado)}</dd></div>
        <div>
          <dt>Resultado</dt>
          <dd className={`dinero ${tonoDinero(m.resultado)}`}>{euros(m.resultado)}</dd>
        </div>
      </dl>

      <h2>De lo facturado al resultado</h2>
      <div className="tabla-envoltorio">
        <table className="tabla">
          <tbody>
            {lineas.map(([etiqueta, importe, tipo]) => (
              <tr key={etiqueta} className={tipo === 'suma' ? 'fila-suma' : undefined}>
                <th scope="row" style={tipo === 'suma' ? { fontWeight: 600 } : undefined}>
                  {etiqueta}
                </th>
                <td className={`dinero ${tipo === 'suma' ? tonoDinero(importe) : ''}`}>
                  {euros(importe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {m.facturadoLibro != null && Math.abs(m.facturado - m.facturadoLibro) > 0.005 && (
        <p className="tira tira--aviso">
          <span className="tira__punto" aria-hidden="true" />
          <span>
            El Excel daba <strong>{euros(m.facturadoLibro)}</strong> de facturación para este
            mes y sumando las filas salen <strong>{euros(m.facturado)}</strong>. La diferencia
            está explicada en <Link href="/revisar">Revisar</Link>.
          </span>
        </p>
      )}

      <h2>Cargas del mes</h2>
      <FormularioCierre periodo={periodo} cierre={c} />

      <h2>Gastos ({entero(listaGastos.length)})</h2>
      {listaGastos.length === 0 ? (
        <p className="vacio">Ningún gasto apuntado en este mes.</p>
      ) : (
        <div className="tabla-envoltorio tabla-envoltorio--alta">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Comercio</th>
                <th scope="col">Concepto</th>
                <th scope="col" className="num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {listaGastos.map((g) => (
                <tr key={g.id}>
                  <th scope="row" className="celda-nombre">{g.comercio || '—'}</th>
                  <td className="celda-nota">{g.concepto}</td>
                  <td className="dinero">{euros(g.importe)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>Total</th>
                <td className="dinero">{euros(m.gastos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="bloque__pie">
        Se añaden y se editan en <Link href={`/gastos?periodo=${periodo}`}>Gastos</Link>.
      </p>

      {fijos.length > 0 && (
        <>
          <h2>Costes fijos</h2>
          <div className="tabla-envoltorio">
            <table className="tabla">
              <tbody>
                {fijos.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">{f.concepto}</th>
                    <td className="dinero">{euros(f.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
