import Link from 'next/link';

import PanelServicios from '../../../componentes/PanelServicios.jsx';
import Filtros from '../../../componentes/Filtros.jsx';
import AvisoNuevo from '../../../componentes/AvisoNuevo.jsx';
import {
  servicios, contarServicios, clientes, colaboradores, periodos, servicio
} from '../../../lib/consultas.js';
import { euros, entero, nombrePeriodo } from '../../../lib/formato.js';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 200;

export default async function Servicios({ searchParams }) {
  const p = await searchParams;
  const periodo = typeof p?.periodo === 'string' ? p.periodo : '';
  const revisar = p?.revisar === '1';
  const borrador = p?.borrador === 'si' ? 'si' : p?.borrador === 'todos' ? 'todos' : 'no';
  const busqueda = typeof p?.q === 'string' ? p.q.trim() : '';
  const pagina = Math.max(1, Number(p?.pagina) || 1);

  const filtro = { periodo, revisar, borrador, busqueda };

  const [lista, total, listaClientes, listaColab, listaPeriodos] = await Promise.all([
    servicios({ ...filtro, limite: POR_PAGINA, desde: (pagina - 1) * POR_PAGINA }),
    contarServicios(filtro),
    clientes(),
    colaboradores(),
    periodos(),
  ]);

  // El servicio recién apuntado. No cae arriba del todo: la tabla va por fecha
  // y el mes en curso ya tiene servicios con fecha posterior a hoy. Y si él
  // estaba mirando otro mes, directamente no está en esta lista — eso hay que
  // decirlo, no dejar que parezca que no se guardó.
  const nuevo = Number(p?.nuevo) || 0;
  const recien = nuevo ? lista.find((s) => Number(s.id) === nuevo) : null;
  const fueraDelFiltro = nuevo && !recien ? await servicio(nuevo) : null;

  const sumaValor = lista.reduce((a, s) => a + s.valor, 0);
  const sumaMargen = lista.reduce((a, s) => a + s.margen, 0);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlace = (cambios) => {
    const q = new URLSearchParams();
    const v = { periodo, revisar: revisar ? '1' : '', borrador, busqueda,
      pagina: String(pagina), ...cambios };
    if (v.periodo) q.set('periodo', v.periodo);
    if (v.revisar) q.set('revisar', '1');
    if (v.borrador && v.borrador !== 'no') q.set('borrador', v.borrador);
    if (v.busqueda) q.set('q', v.busqueda);
    if (v.pagina && v.pagina !== '1') q.set('pagina', v.pagina);
    return `/servicios${q.toString() ? `?${q}` : ''}`;
  };

  return (
    <>
      <h1>Servicios</h1>

      <Filtros ruta="/servicios" periodos={listaPeriodos} periodo={periodo}
        revisar={revisar} borrador={borrador} busqueda={busqueda} conBorrador conBusqueda />

      <p className="nota-metodo">
        {entero(total)} servicios{periodo && ` en ${nombrePeriodo(periodo)}`}
        {busqueda && ` con «${busqueda}»`}
        {revisar && ', marcados para revisar'}. En pantalla: {euros(sumaValor)} facturados,{' '}
        {euros(sumaMargen)} de margen.
      </p>

      {recien && (
        <AvisoNuevo id={recien.id}>
          Servicio de <strong>{recien.cliente}</strong> apuntado, {euros(recien.valor)}.
          Está señalado en la tabla.
        </AvisoNuevo>
      )}

      {fueraDelFiltro && (
        <AvisoNuevo id={0}>
          Servicio de <strong>{fueraDelFiltro.cliente}</strong> apuntado en{' '}
          {nombrePeriodo(fueraDelFiltro.periodo)}, y aquí estás viendo{' '}
          {periodo ? nombrePeriodo(periodo) : 'otra selección'}: por eso no sale.{' '}
          <Link href={`/servicios?periodo=${fueraDelFiltro.periodo}&nuevo=${fueraDelFiltro.id}`}>
            Ver {nombrePeriodo(fueraDelFiltro.periodo)}
          </Link>.
        </AvisoNuevo>
      )}

      <PanelServicios servicios={lista} clientes={listaClientes} colaboradores={listaColab}
        periodo={periodo} nuevo={nuevo} />

      {paginas > 1 && (
        <nav className="paginacion" aria-label="Páginas">
          {pagina > 1 && <Link href={enlace({ pagina: String(pagina - 1) })}>← Anteriores</Link>}
          <span>Página {pagina} de {paginas}</span>
          {pagina < paginas && <Link href={enlace({ pagina: String(pagina + 1) })}>Siguientes →</Link>}
        </nav>
      )}
    </>
  );
}
