import { useCallback, useRef, useState } from 'react';

const EXTENSIONES = ['.xlsx', '.xlsm', '.xls'];

const esLibro = (archivo) =>
  !!archivo && EXTENSIONES.some((e) => archivo.name.toLowerCase().endsWith(e));

/**
 * Primera etapa: entra el archivo.
 *
 * No hay datos de ejemplo a propósito. La demo tiene que enseñarle SUS números,
 * no unos inventados que se parezcan.
 */
export default function SoltarArchivo({ alSoltar, ocupado }) {
  const [encima, setEncima] = useState(false);
  const [rechazo, setRechazo] = useState(null);
  const entradaRef = useRef(null);

  const aceptar = useCallback((archivo) => {
    if (!esLibro(archivo)) {
      setRechazo('Ese archivo no es un libro de Excel. Se espera un .xlsx.');
      return;
    }
    setRechazo(null);
    alSoltar(archivo);
  }, [alSoltar]);

  const alArrastrar = useCallback((ev) => {
    ev.preventDefault();
    setEncima(true);
  }, []);

  const alSalir = useCallback((ev) => {
    ev.preventDefault();
    setEncima(false);
  }, []);

  const alSoltarEvento = useCallback((ev) => {
    ev.preventDefault();
    setEncima(false);
    aceptar(ev.dataTransfer?.files?.[0]);
  }, [aceptar]);

  return (
    <section className="soltar">
      <div
        className={'zona' + (encima ? ' zona--encima' : '') + (ocupado ? ' zona--ocupada' : '')}
        onDragOver={alArrastrar}
        onDragEnter={alArrastrar}
        onDragLeave={alSalir}
        onDrop={alSoltarEvento}
        onClick={() => !ocupado && entradaRef.current?.click()}
        onKeyDown={(ev) => {
          if (ocupado) return;
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            entradaRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-busy={!!ocupado}
        aria-label="Seleccionar el libro de Excel"
      >
        <input
          ref={entradaRef}
          type="file"
          accept={EXTENSIONES.join(',')}
          className="zona__input"
          onChange={(ev) => {
            aceptar(ev.target.files?.[0]);
            ev.target.value = '';
          }}
          tabIndex={-1}
        />

        {ocupado ? (
          <>
            <p className="zona__estado" role="status">{ocupado}</p>
            <div className="barra" aria-hidden="true"><span /></div>
          </>
        ) : (
          <>
            <p className="zona__titulo">Suelta aquí tu libro de contabilidad</p>
            <p className="zona__ayuda">
              o pulsa para buscarlo · <code>.xlsx</code>
            </p>
          </>
        )}
      </div>

      {rechazo && (
        <p className="alerta alerta--error" role="alert">{rechazo}</p>
      )}

      <div className="explica">
        <h2>Qué va a pasar</h2>
        <ol className="explica__lista">
          <li>
            <strong>Se leen sólo las hojas de 2026.</strong> Son las que llevan
            las columnas <em>VALOR DEL SERVICIO</em> y <em>COLABORADORES</em>.
            Las anteriores tienen otra estructura: se listan por nombre y se
            dejan fuera, sin tocarlas.
          </li>
          <li>
            <strong>Se agrupan los nombres repetidos.</strong> Los que sólo
            cambian en tildes o mayúsculas se unen solos. Los que se parecen
            pero podrían ser dos personas se proponen y los confirmas tú.
          </li>
          <li>
            <strong>Se calcula el margen real</strong> de cada cliente y lo
            cobrado por cada colaborador, servicio a servicio.
          </li>
        </ol>
        <p className="explica__nota">
          Nada de esto sale de tu ordenador. El archivo se lee aquí, en el
          navegador, y se guarda en una base de datos local. Si cierras la
          pestaña, se queda donde estaba.
        </p>
      </div>
    </section>
  );
}
