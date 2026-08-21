import Link from 'next/link';
import { notFound } from 'next/navigation';

import EditarPersona from '../../../../componentes/EditarPersona.jsx';
import { cliente, serviciosDeCliente, listaColaboradores } from '../../../../lib/consultas.js';
import { euros, numero, entero, porcentaje, fecha, nombrePeriodo, codigo } from '../../../../lib/formato.js';
import { tonoDinero } from '../../../../componentes/formato.js';

export const dynamic = 'force-dynamic';

export default async function Cliente({ params }) {
  const { id } = await params;
  const c = await cliente(id);
  if (!c) notFound();

  const suyos = await serviciosDeCliente(id);
  const colaboradores = await listaColaboradores();
  const facturado = suyos.reduce((a, s) => a + s.valor, 0);
  const margen = suyos.reduce((a, s) => a + s.margen, 0);
  const horas = suyos.reduce((a, s) => a + s.horas, 0);

  // Un cliente puede dejar dinero en conjunto y perderlo en meses sueltos. Es
  // justo lo que no se ve en una hoja ordenada por fecha.
  const porMes = new Map();
  for (const s of suyos) {
    const m = porMes.get(s.periodo) ?? { periodo: s.periodo, servicios: 0, valor: 0, margen: 0 };
    m.servicios++; m.valor += s.valor; m.margen += s.margen;
    porMes.set(s.periodo, m);
  }
  const meses = [...porMes.values()].sort((a, b) => b.periodo.localeCompare(a.periodo));

  return (
    <>
      <p className="nota"><Link href="/clientes">← Clientes</Link></p>
      <h1>{c.nombre} <span className="titulo__codigo">{codigo(c.id)}</span></h1>

      <dl className="ficha">
        <div><dt>Dirección</dt><dd>{c.direccion || '—'}</dd></div>
        <div><dt>Código postal</dt><dd>{c.codigo_postal || '—'}</dd></div>
        <div><dt>Provincia</dt><dd>{c.provincia || '—'}</dd></div>
        <div>
          <dt>Teléfono</dt>
          <dd>{c.telefono ? <a href={`tel:${c.telefono}`}>{c.telefono}</a> : '—'}</dd>
        </div>
        <div>
          <dt>Colaborador habitual</dt>
          <dd>
            {c.colaborador_nombre ? (
              <>
                {c.colaborador_nombre}{' '}
                <span className="tenue">{codigo(c.colaborador_id)}</span>
                {c.colaborador_telefono
                  ? <> · <a href={`tel:${c.colaborador_telefono}`}>{c.colaborador_telefono}</a></>
                  : <span className="tenue"> · sin teléfono</span>}
              </>
            ) : '—'}
          </dd>
        </div>
        <div><dt>Servicios</dt><dd>{entero(suyos.length)}</dd></div>
        <div><dt>Horas</dt><dd>{numero(horas)}</dd></div>
        <div><dt>Facturado</dt><dd className="dinero">{euros(facturado)}</dd></div>
        <div>
          <dt>Margen</dt>
          <dd className={`dinero ${tonoDinero(margen)}`}>
            {euros(margen)} <span className="tenue">({porcentaje(margen, facturado)})</span>
          </dd>
        </div>
      </dl>

      {c.notas && <p className="nota">{c.notas}</p>}

      <EditarPersona tipo="cliente" persona={c} colaboradores={colaboradores} />

      <h2>Por mes</h2>
      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col" className="num">Servicios</th>
              <th scope="col" className="num">Facturado</th>
              <th scope="col" className="num">Margen</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.periodo} className={m.margen < 0 ? 'fila--perdida' : undefined}>
                <th scope="row">{nombrePeriodo(m.periodo)}</th>
                <td className="num">{entero(m.servicios)}</td>
                <td className="dinero">{euros(m.valor)}</td>
                <td className={`dinero ${tonoDinero(m.margen)}`}>{euros(m.margen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Servicios</h2>
      <div className="tabla-envoltorio tabla-envoltorio--alta">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Quién</th>
              <th scope="col" className="num">Horas</th>
              <th scope="col" className="num">Valor</th>
              <th scope="col" className="num">Colaboradores</th>
              <th scope="col" className="num">Margen</th>
            </tr>
          </thead>
          <tbody>
            {suyos.map((s) => (
              <tr key={s.id} className={s.margen < 0 ? 'fila--perdida' : undefined}>
                <th scope="row">{fecha(s.fecha) || <span className="tenue">sin fecha</span>}</th>
                <td className="celda-nota">{s.colaboradores || <span className="tenue">nadie</span>}</td>
                <td className="num">{numero(s.horas)}</td>
                <td className="dinero">{euros(s.valor)}</td>
                <td className="dinero">{euros(s.pago_colab)}</td>
                <td className={`dinero ${tonoDinero(s.margen)}`}>{euros(s.margen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bloque__pie">
        Para editar un servicio, búscalo en <Link href="/servicios">Servicios</Link>.
      </p>
    </>
  );
}
