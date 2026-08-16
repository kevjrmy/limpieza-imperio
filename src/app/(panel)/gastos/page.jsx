import PanelGastos from '../../../componentes/PanelGastos.jsx';
import Filtros from '../../../componentes/Filtros.jsx';
import { gastos, periodos } from '../../../lib/consultas.js';

export const dynamic = 'force-dynamic';

export default async function Gastos({ searchParams }) {
  const p = await searchParams;
  const periodo = typeof p?.periodo === 'string' ? p.periodo : '';

  const [lista, listaPeriodos] = await Promise.all([
    gastos({ periodo }),
    periodos(),
  ]);

  return (
    <>
      <h1>Gastos de empresa</h1>

      <p className="nota-metodo">
        Las compras del negocio: supermercado, ferretería, óptica, gasolina. <strong>No se
        reparten entre los clientes</strong> — se descuentan del resultado del mes. En el
        Excel iban escritas dentro de las filas de servicio, lo que le achacaba una compra
        del súper al cliente que hubiera en esa fila.
      </p>

      <Filtros ruta="/gastos" periodos={listaPeriodos} periodo={periodo} conRevisar={false} />

      <PanelGastos gastos={lista} />
    </>
  );
}
