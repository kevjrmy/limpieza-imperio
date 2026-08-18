import Link from 'next/link';

import FichaPersona from '../../../componentes/FichaPersona.jsx';
import EditarPersona from '../../../componentes/EditarPersona.jsx';
import Filtros from '../../../componentes/Filtros.jsx';
import AvisoNuevo from '../../../componentes/AvisoNuevo.jsx';
import { colaboradores, colaborador, periodos } from '../../../lib/consultas.js';
import { euros, numero, entero, fecha, nombrePeriodo, codigo } from '../../../lib/formato.js';

export const dynamic = 'force-dynamic';

export default async function Colaboradores({ searchParams }) {
  const p = await searchParams;
  const periodo = typeof p?.periodo === 'string' ? p.periodo : '';
  const busqueda = typeof p?.q === 'string' ? p.q.trim() : '';

  const [lista, listaPeriodos] = await Promise.all([
    colaboradores({ periodo, busqueda }),
    periodos(),
  ]);

  const total = lista.reduce((a, c) => a + c.pago, 0);

  // Igual que en clientes: la tabla va por lo cobrado, así que quien acaba de
  // entrar y no ha cobrado nada queda el último de la lista.
  const nuevo = Number(p?.nuevo) || 0;
  const recien = nuevo ? lista.find((c) => Number(c.id) === nuevo) : null;
  // Y si la búsqueda lo deja fuera, se dice: callar ahí es el mismo problema.
  const fueraDelFiltro = nuevo && !recien ? await colaborador(nuevo) : null;

  return (
    <>
      <h1>Colaboradores</h1>

      <Filtros ruta="/colaboradores" periodos={listaPeriodos} periodo={periodo}
        busqueda={busqueda} conRevisar={false} conBusqueda pista="Nombre o número…" />

      <p className="nota-metodo">
        Cuando un servicio lo hacen varias personas, <strong>el pago se reparte a partes
        iguales</strong> en céntimos enteros: la suma de las partes es exactamente el pago
        del servicio. {periodo && `Filtrado por ${nombrePeriodo(periodo)}. `}
        {busqueda && `Sólo los que llevan «${busqueda}» en el nombre. `}
        Total repartido: {euros(total)}
        {busqueda && ' de los que se ven aquí'}.
      </p>

      <FichaPersona tipo="colaborador" />

      {recien && (
        <AvisoNuevo id={recien.id}>
          <strong>{recien.nombre}</strong> queda dado de alta con el número{' '}
          <strong>{codigo(recien.id)}</strong>. Está al final de la tabla: la lista va
          por lo cobrado y todavía no ha hecho ningún servicio.
        </AvisoNuevo>
      )}

      {fueraDelFiltro && (
        <AvisoNuevo id={0}>
          <strong>{fueraDelFiltro.nombre}</strong> queda dado de alta, pero no sale
          aquí porque tienes puesto el filtro «{busqueda}».{' '}
          <Link href={`/colaboradores?nuevo=${fueraDelFiltro.id}`}>
            Verlo en la lista completa
          </Link>.
        </AvisoNuevo>
      )}

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col" className="num">Nº</th>
              <th scope="col">Nombre</th>
              <th scope="col">Teléfono</th>
              <th scope="col" className="num">Servicios</th>
              <th scope="col" className="num">Horas</th>
              <th scope="col" className="num">Pagado</th>
              <th scope="col">Último</th>
              <th scope="col"><span className="visualmente-oculto">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id} data-fila={c.id}
                className={Number(c.id) === nuevo ? 'fila--nueva' : undefined}>
                <td className="celda-codigo">{codigo(c.id)}</td>
                <th scope="row" className="celda-nombre">{c.nombre}</th>
                <td className="celda-nota">{c.telefono}</td>
                <td className="num">{entero(c.servicios)}</td>
                <td className="num">{numero(c.horas)}</td>
                <td className="dinero">{euros(c.pago)}</td>
                <td>{fecha(c.ultimo)}</td>
                <td className="acciones-fila">
                  <EditarPersona tipo="colaborador" persona={c} compacto />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lista.length === 0 && (
        <p className="vacio">Ningún colaborador con ese nombre.</p>
      )}
    </>
  );
}
