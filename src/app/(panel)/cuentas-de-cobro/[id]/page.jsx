import { FichaDocumento } from '../../../../componentes/PaginasDocumento.jsx';

export const dynamic = 'force-dynamic';

export default function CuentaDeCobro(props) {
  return <FichaDocumento tipo="cobro" {...props} />;
}
