import { periodos } from '../../../lib/consultas.js';
import { nombrePeriodo } from '../../../lib/formato.js';

export const dynamic = 'force-dynamic';

const TABLAS = [
  { id: 'servicios', titulo: 'Servicios', desc: 'Una fila por servicio, con cliente, quién lo hizo y el margen.' },
  { id: 'clientes', titulo: 'Clientes', desc: 'Cada cliente con sus totales y su margen.' },
  { id: 'colaboradores', titulo: 'Colaboradores', desc: 'Horas y pago repartido de cada persona.' },
  { id: 'gastos', titulo: 'Gastos', desc: 'Las compras del negocio, mes a mes.' },
  { id: 'meses', titulo: 'Meses', desc: 'El cierre de cada mes, de lo facturado al resultado.' },
];

export default async function Exportar({ searchParams }) {
  const p = await searchParams;
  const periodo = typeof p?.periodo === 'string' ? p.periodo : '';
  const listaPeriodos = await periodos();

  const sufijo = periodo ? `?periodo=${periodo}` : '';

  return (
    <>
      <h1>Exportar</h1>

      <p className="nota-metodo">
        Se descargan en CSV, en <strong>UTF-8 con BOM y separados por punto y coma</strong>,
        que es lo que Excel en español abre bien a la primera: sin acentos rotos y con los
        importes como números que se pueden sumar, no como texto.
      </p>

      <form className="filtros" action="/exportar">
        <label className="campo">
          <span>Mes</span>
          <select name="periodo" defaultValue={periodo}>
            <option value="">Todos los meses</option>
            {listaPeriodos.map((x) => (
              <option key={x} value={x}>{nombrePeriodo(x)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="boton">Aplicar</button>
      </form>

      <section className="bloque">
        <div className="bloque__cab">
          <h3>El mes entero, en un archivo</h3>
        </div>
        <p className="bloque__desc">
          Servicios, resumen por cliente, resumen por colaborador, gastos y el cierre —todo
          en un solo CSV, en bloques uno debajo de otro. Es la misma maquetación que tenía
          en Excel: la tabla y, debajo, los totales.
        </p>
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col"><span className="visualmente-oculto">Descarga</span></th>
              </tr>
            </thead>
            <tbody>
              {listaPeriodos.map((x) => (
                <tr key={x}>
                  <th scope="row">{nombrePeriodo(x)}</th>
                  <td className="acciones-fila">
                    <a className="boton boton--principal" href={`/api/exportar/mes/${x}`}>
                      Descargar {nombrePeriodo(x)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <h2>Por tabla</h2>
      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">Tabla</th>
              <th scope="col">Qué lleva</th>
              <th scope="col"><span className="visualmente-oculto">Descarga</span></th>
            </tr>
          </thead>
          <tbody>
            {TABLAS.map((t) => (
              <tr key={t.id}>
                <th scope="row" className="celda-nombre">{t.titulo}</th>
                <td className="celda-nota">{t.desc}</td>
                <td className="acciones-fila">
                  <a className="boton" href={`/api/exportar/${t.id}${sufijo}`}>
                    Descargar CSV
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {periodo && (
        <p className="bloque__pie">
          Las descargas llevan sólo {nombrePeriodo(periodo)}. Quita el filtro para bajarlo todo.
        </p>
      )}
    </>
  );
}
