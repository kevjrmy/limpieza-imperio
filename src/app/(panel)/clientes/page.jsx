import Link from 'next/link';

import FichaPersona from '../../../componentes/FichaPersona.jsx';
import { clientes } from '../../../lib/consultas.js';
import { euros, numero, entero, porcentaje, fecha } from '../../../lib/formato.js';
import { tonoDinero } from '../../../componentes/formato.js';

export const dynamic = 'force-dynamic';

export default async function Clientes({ searchParams }) {
  const p = await searchParams;
  const busqueda = typeof p?.q === 'string' ? p.q : '';
  const lista = await clientes({ busqueda });

  return (
    <>
      <h1>Clientes</h1>

      <form className="filtros" action="/clientes">
        <label className="campo">
          <span>Buscar</span>
          <input type="search" name="q" defaultValue={busqueda} placeholder="Nombre…" />
        </label>
        <button type="submit" className="boton">Buscar</button>
        {busqueda && <Link className="boton boton--plano" href="/clientes">Quitar filtro</Link>}
      </form>

      <FichaPersona tipo="cliente" />

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Dirección</th>
              <th scope="col">Teléfono</th>
              <th scope="col" className="num">Servicios</th>
              <th scope="col" className="num">Horas</th>
              <th scope="col" className="num">Facturado</th>
              <th scope="col" className="num">Margen</th>
              <th scope="col" className="num">%</th>
              <th scope="col">Último</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} className={c.margen < 0 ? 'fila--perdida' : undefined}>
                <th scope="row" className="celda-nombre">
                  <Link href={`/clientes/${c.id}`}>{c.nombre}</Link>
                </th>
                <td className="celda-nota">{c.direccion}</td>
                <td className="celda-nota">{c.telefono}</td>
                <td className="num">{entero(c.servicios)}</td>
                <td className="num">{numero(c.horas)}</td>
                <td className="dinero">{euros(c.facturado)}</td>
                <td className={`dinero ${tonoDinero(c.margen)}`}>{euros(c.margen)}</td>
                <td className="num">{porcentaje(c.margen, c.facturado)}</td>
                <td>{fecha(c.ultimo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lista.length === 0 && <p className="vacio">Ningún cliente con ese nombre.</p>}
    </>
  );
}
