/**
 * El modo de guardado, dicho en voz alta.
 *
 * Sin aislamiento entre orígenes no hay OPFS, y la base vive sólo en memoria:
 * al recargar, la importación desaparece. Callárselo sería regalarle la
 * sorpresa más desagradable posible, así que se dice antes de que importe nada.
 */
export default function AvisoAlmacenamiento({ estado }) {
  if (!estado || estado.modo === 'desconocido') return null;

  if (estado.modo === 'opfs') {
    return (
      <p className="tira tira--ok">
        <span className="tira__punto" aria-hidden="true" />
        Guardando en SQLite dentro del navegador. La importación sigue aquí
        aunque cierres la pestaña.
      </p>
    );
  }

  if (estado.error) {
    return (
      <p className="tira tira--aviso" role="status">
        <span className="tira__punto" aria-hidden="true" />
        <span>
          <strong>SQLite no ha arrancado.</strong> Puedes importar y ver los
          números igualmente, pero no se guardará nada. ({estado.error})
        </span>
      </p>
    );
  }

  return (
    <p className="tira tira--aviso" role="status">
      <span className="tira__punto" aria-hidden="true" />
      <span>
        <strong>La importación no se guardará.</strong> Esta página no está
        sirviéndose con las cabeceras de aislamiento{' '}
        (<code>COOP</code> / <code>COEP</code>), así que el navegador no
        permite el almacenamiento permanente y la base vive sólo en memoria:
        al recargar tendrás que volver a soltar el archivo.
      </span>
    </p>
  );
}
