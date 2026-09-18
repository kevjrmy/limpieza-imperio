import { ListaDocumentos } from '../../../componentes/PaginasDocumento.jsx';

export const dynamic = 'force-dynamic';

export default function CuentasDeCobro(props) {
  return <ListaDocumentos tipo="cobro" {...props} />;
}
