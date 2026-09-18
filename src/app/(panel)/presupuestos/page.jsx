import { ListaDocumentos } from '../../../componentes/PaginasDocumento.jsx';

export const dynamic = 'force-dynamic';

export default function Presupuestos(props) {
  return <ListaDocumentos tipo="presupuesto" {...props} />;
}
