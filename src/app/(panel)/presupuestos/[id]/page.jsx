import { FichaDocumento } from '../../../../componentes/PaginasDocumento.jsx';

export const dynamic = 'force-dynamic';

export default function Presupuesto(props) {
  return <FichaDocumento tipo="presupuesto" {...props} />;
}
