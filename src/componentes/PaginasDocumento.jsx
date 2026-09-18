import Link from 'next/link';
import { notFound } from 'next/navigation';

import PanelDocumento, { NuevoDocumento } from './PanelDocumento.jsx';
import {
  documentos, documento, siguienteNumero, listaClientes, listaColaboradores,
} from '../lib/consultas.js';
import { TIPOS, ESTADOS_PRESUPUESTO, genero } from '../lib/documentos.js';
import { euros, fecha, codigo } from '../lib/formato.js';

/**
 * Las dos pantallas de cada tipo de documento —la lista y el documento—, que
 * son iguales para presupuestos, hojas de servicio y cuentas de cobro. Las rutas de
 * `app/` sólo dicen de qué tipo son.
 *
 * Componentes de servidor: leen de `consultas.js`, que exige sesión.
 */

export async function ListaDocumentos({ tipo, searchParams }) {
  const t = TIPOS[tipo];
  const p = await searchParams;
  const busqueda = typeof p?.q === 'string' ? p.q : '';

  const [lista, siguiente, clientes, colaboradores] = await Promise.all([
    documentos(tipo, { busqueda }),
    siguienteNumero(tipo),
    listaClientes(),
    tipo === 'hoja' ? listaColaboradores() : [],
  ]);

  return (
    <>
      <h1>{t.plural}</h1>

      <p className="nota-metodo">
        Cada {t.nombre.toLowerCase()} se guarda aparte con su número. Para hacer{' '}
        {genero(t, 'otra parecida, abre una', 'otro parecido, abre uno')} y pulsa{' '}
        <strong>{genero(t, 'Nueva a partir de esta', 'Nuevo a partir de este')}</strong>: sale
        una copia para retocar y {genero(t, 'la original', 'el original')} no cambia.{' '}
        <strong>No cuentan en la contabilidad</strong>: los servicios se siguen apuntando en
        Servicios.
      </p>

      <form className="filtros" action={t.ruta}>
        <label className="campo campo--busqueda">
          <span>Buscar</span>
          <input type="search" name="q" defaultValue={busqueda} placeholder="Cliente o número…" />
        </label>
        <button type="submit" className="boton">Buscar</button>
        {busqueda && <Link className="boton boton--plano" href={t.ruta}>Quitar filtro</Link>}
      </form>

      <NuevoDocumento tipo={tipo} siguiente={siguiente} clientes={clientes}
        colaboradores={colaboradores} />

      {lista.length === 0 ? (
        <p className="vacio">
          {busqueda ? `Nada coincide con «${busqueda}».`
            : `Todavía no hay ${genero(t, 'ninguna', 'ningún')} ${t.nombre.toLowerCase()}.`}
        </p>
      ) : (
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col" className="num">Nº</th>
                <th scope="col">Fecha</th>
                <th scope="col">Cliente</th>
                <th scope="col" className="num">Total</th>
                {tipo === 'presupuesto' && <th scope="col">Estado</th>}
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id}>
                  <td className="celda-codigo">
                    <Link href={`${t.ruta}/${d.id}`}>{codigo(d.numero)}</Link>
                  </td>
                  <td>{fecha(d.fecha)}</td>
                  <th scope="row" className="celda-nombre">
                    <Link href={`${t.ruta}/${d.id}`}>{d.cliente_nombre}</Link>
                  </th>
                  <td className="dinero">{euros(d.total)}</td>
                  {tipo === 'presupuesto' && (
                    <td>{ESTADOS_PRESUPUESTO[d.estado] ?? ESTADOS_PRESUPUESTO.pendiente}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export async function FichaDocumento({ tipo, params, searchParams }) {
  const t = TIPOS[tipo];
  const { id } = await params;
  const p = await searchParams;

  const doc = Number(id) ? await documento(Number(id)) : null;
  // Una hoja pedida por la ruta de las cuentas de cobro no existe ahí.
  if (!doc || doc.tipo !== tipo) notFound();

  const [siguiente, clientes, colaboradores] = await Promise.all([
    siguienteNumero(tipo),
    listaClientes(),
    tipo === 'hoja' ? listaColaboradores() : [],
  ]);

  const desde = Number(p?.desde) || 0;

  return (
    <>
      <p className="nota no-imprimir"><Link href={t.ruta}>← {t.plural}</Link></p>

      {p?.guardado && (
        <p className="alerta alerta--hecho no-imprimir">
          {genero(t, 'Guardada', 'Guardado')} como {t.articulo} <strong>{codigo(doc.numero)}</strong>.
          {desde ? <> {cap(t.articulo)} {codigo(desde)}, {genero(t, 'de la que', 'del que')} sale,
            sigue como estaba.</> : null}
        </p>
      )}

      {doc.cliente_id && (
        <p className="nota no-imprimir">
          Cliente: <Link href={`/clientes/${doc.cliente_id}`}>ficha {codigo(doc.cliente_id)}</Link>
        </p>
      )}

      <PanelDocumento doc={doc} siguiente={siguiente} clientes={clientes}
        colaboradores={colaboradores} />
    </>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
