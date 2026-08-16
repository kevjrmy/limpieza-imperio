import Link from 'next/link';

import PanelRevisar from '../../../componentes/PanelRevisar.jsx';
import { avisos, resumenAvisos, fusiones, pendientes } from '../../../lib/consultas.js';
import { entero } from '../../../lib/formato.js';

export const dynamic = 'force-dynamic';

export default async function Revisar() {
  const [lista, resumen, listaFusiones, pend] = await Promise.all([
    avisos(), resumenAvisos(), fusiones(), pendientes(),
  ]);

  return (
    <>
      <h1>Revisar</h1>

      <p className="nota-metodo">
        Todo lo que no cuadraba en el Excel está aquí, sin tocar. La regla al importarlo fue
        <strong> avisar, nunca corregir en silencio</strong>: un número arreglado por su cuenta
        es peor que un número señalado. Hay además{' '}
        <Link href="/servicios?revisar=1">{entero(pend?.servicios ?? 0)} servicios marcados</Link>{' '}
        para mirar de cerca.
      </p>

      <PanelRevisar avisos={lista} fusiones={listaFusiones} resumen={resumen} />
    </>
  );
}
