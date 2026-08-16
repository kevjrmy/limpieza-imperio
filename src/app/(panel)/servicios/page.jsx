import Link from 'next/link';

import PanelServicios from '../../../componentes/PanelServicios.jsx';
import Filtros from '../../../componentes/Filtros.jsx';
import {
  servicios, contarServicios, clientes, colaboradores, periodos
} from '../../../lib/consultas.js';
import { euros, entero, nombrePeriodo } from '../../../lib/formato.js';

export const dynamic = 'force-dynamic';

const POR_PAGINA = 200;

export default async function Servicios({ searchParams }) {
  const p = await searchParams;
  const periodo = typeof p?.periodo === 'string' ? p.periodo : '';
  const revisar = p?.revisar === '1';
  const borrador = p?.borrador === 'si' ? 'si' : p?.borrador === 'todos' ? 'todos' : 'no';
  const pagina = Math.max(1, Number(p?.pagina) || 1);

  const filtro = { periodo, revisar, borrador };

  const [lista, total, listaClientes, listaColab, listaPeriodos] = await Promise.all([
    servicios({ ...filtro, limite: POR_PAGINA, desde: (pagina - 1) * POR_PAGINA }),
    contarServicios(filtro),
    clientes(),
    colaboradores(),
    periodos(),
  ]);

  const sumaValor = lista.reduce((a, s) => a + s.valor, 0);
  const sumaMargen = lista.reduce((a, s) => a + s.margen, 0);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const enlace = (cambios) => {
    const q = new URLSearchParams();
    const v = { periodo, revisar: revisar ? '1' : '', borrador,
      pagina: String(pagina), ...cambios };
    if (v.periodo) q.set('periodo', v.periodo);
    if (v.revisar) q.set('revisar', '1');
    if (v.borrador && v.borrador !== 'no') q.set('borrador', v.borrador);
    if (v.pagina && v.pagina !== '1') q.set('pagina', v.pagina);
    return `/servicios${q.toString() ? `?${q}` : ''}`;
  };

  return (
    <>
      <h1>Servicios</h1>

      <Filtros ruta="/servicios" periodos={listaPeriodos} periodo={periodo}
        revisar={revisar} borrador={borrador} conBorrador />

      <p className="nota-metodo">
        {entero(total)} servicios{periodo && ` en ${nombrePeriodo(periodo)}`}
        {revisar && ', marcados para revisar'}. En pantalla: {euros(sumaValor)} facturados,{' '}
        {euros(sumaMargen)} de margen.
      </p>

      <PanelServicios servicios={lista} clientes={listaClientes} colaboradores={listaColab}
        periodo={periodo} />

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
