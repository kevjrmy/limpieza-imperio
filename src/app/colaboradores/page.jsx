import FichaPersona from '../../componentes/FichaPersona.jsx';
import EditarPersona from '../../componentes/EditarPersona.jsx';
import Filtros from '../../componentes/Filtros.jsx';
import { colaboradores, periodos } from '../../lib/consultas.js';
import { euros, numero, entero, fecha, nombrePeriodo } from '../../lib/formato.js';

export const dynamic = 'force-dynamic';

export default async function Colaboradores({ searchParams }) {
  const p = await searchParams;
  const periodo = typeof p?.periodo === 'string' ? p.periodo : '';

  const [lista, listaPeriodos] = await Promise.all([
    colaboradores({ periodo }),
    periodos(),
  ]);

  const total = lista.reduce((a, c) => a + c.pago, 0);

  return (
    <>
      <h1>Colaboradores</h1>

      <Filtros ruta="/colaboradores" periodos={listaPeriodos} periodo={periodo}
        conRevisar={false} />

      <p className="nota-metodo">
        Cuando un servicio lo hacen varias personas, <strong>el pago se reparte a partes
        iguales</strong> en céntimos enteros: la suma de las partes es exactamente el pago
        del servicio. {periodo && `Filtrado por ${nombrePeriodo(periodo)}. `}
        Total repartido: {euros(total)}.
      </p>

      <FichaPersona tipo="colaborador" />

      <div className="tabla-envoltorio">
        <table className="tabla">
          <thead>
            <tr>
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
              <tr key={c.id}>
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
    </>
  );
}
