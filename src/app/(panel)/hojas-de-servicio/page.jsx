import { ListaDocumentos } from '../../../componentes/PaginasDocumento.jsx';

export const dynamic = 'force-dynamic';

export default function HojasDeServicio(props) {
  return <ListaDocumentos tipo="hoja" {...props} />;
}
