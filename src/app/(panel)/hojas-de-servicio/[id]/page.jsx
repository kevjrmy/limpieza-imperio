import { FichaDocumento } from '../../../../componentes/PaginasDocumento.jsx';

export const dynamic = 'force-dynamic';

export default function HojaDeServicio(props) {
  return <FichaDocumento tipo="hoja" {...props} />;
}
