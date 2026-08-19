import Link from 'next/link';

import FichaPersona from '../../../componentes/FichaPersona.jsx';
import AvisoNuevo from '../../../componentes/AvisoNuevo.jsx';
import { clientes, cliente, listaColaboradores } from '../../../lib/consultas.js';
import { euros, numero, entero, porcentaje, fecha, codigo } from '../../../lib/formato.js';
import { tonoDinero } from '../../../componentes/formato.js';

export const dynamic = 'force-dynamic';

export default async function Clientes({ searchParams }) {
  const p = await searchParams;
  const busqueda = typeof p?.q === 'string' ? p.q : '';
  const lista = await clientes({ busqueda });
  const colaboradores = await listaColaboradores();

  // Id del cliente recién dado de alta, si viene de guardar. La tabla va por
  // margen, así que uno nuevo —que no tiene— se hunde hasta el final: sin esto
  // el alta funciona y no se ve, que desde fuera es lo mismo que no funcionar.
  const nuevo = Number(p?.nuevo) || 0;
  const recien = nuevo ? lista.find((c) => Number(c.id) === nuevo) : null;
  // Si el filtro de búsqueda lo deja fuera, hay que decirlo en vez de callar.
  const fueraDelFiltro = nuevo && !recien ? await cliente(nuevo) : null;

  return (
    <>
      <h1>Clientes</h1>

      <form className="filtros" action="/clientes">
        <label className="campo">
          <span>Buscar</span>
          <input type="search" name="q" defaultValue={busqueda} placeholder="Nombre o número…" />
        </label>
        <button type="submit" className="boton">Buscar</button>
        {busqueda && <Link className="boton boton--plano" href="/clientes">Quitar filtro</Link>}
      </form>

      <FichaPersona tipo="cliente" colaboradores={colaboradores} />

      {recien && (
        <AvisoNuevo id={recien.id}>
          <strong>{recien.nombre}</strong> queda dado de alta con el número{' '}
          <strong>{codigo(recien.id)}</strong>. Está en la tabla, más abajo de lo que
          parece: la lista va por margen y todavía no tiene ninguno.
        </AvisoNuevo>
      )}

      {fueraDelFiltro && (
        <AvisoNuevo id={0}>
          <strong>{fueraDelFiltro.nombre}</strong> queda dado de alta, pero no sale
          aquí porque tienes puesto el filtro «{busqueda}».{' '}
          <Link href={`/clientes?nuevo=${fueraDelFiltro.id}`}>Verlo en la lista completa</Link>.
        </AvisoNuevo>
      )}

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col" className="num">Nº</th>
              <th scope="col">Cliente</th>
              <th scope="col">Dirección</th>
              <th scope="col">Teléfono</th>
              <th scope="col">Colaborador</th>
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
              <tr key={c.id} data-fila={c.id}
                className={[c.margen < 0 ? 'fila--perdida' : '',
                  Number(c.id) === nuevo ? 'fila--nueva' : ''].filter(Boolean).join(' ') || undefined}>
                <td className="celda-codigo">{codigo(c.id)}</td>
                <th scope="row" className="celda-nombre">
                  <Link href={`/clientes/${c.id}`}>{c.nombre}</Link>
                </th>
                <td className="celda-nota">{c.direccion}</td>
                <td className="celda-nota">{c.telefono}</td>
                <td className="celda-nota">
                  {c.colaborador_nombre ? (
                    <>
                      {c.colaborador_nombre}
                      {c.colaborador_telefono
                        ? <span className="celda-nota__pie">{c.colaborador_telefono}</span>
                        : <span className="celda-nota__pie tenue">sin teléfono</span>}
                    </>
                  ) : <span className="tenue">—</span>}
                </td>
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
