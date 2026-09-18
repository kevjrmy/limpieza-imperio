import { negocio } from '../lib/negocio.js';
import { TIPOS, IMPORTES_HOJA, calcular, leerNumero } from '../lib/documentos.js';
import { euros, numero as cifra, fecha as comoFecha, codigo } from '../lib/formato.js';

/**
 * El papel tal y como se imprime: una hoja de servicio o una cuenta de cobro.
 *
 * Sigue la maquetación de sus hojas de Excel —logo y datos arriba, el cliente,
 * la tabla, los importes y las firmas debajo— para que al imprimirlo se
 * encuentre lo que ya entregaba. Sin estado ni efectos: se pinta igual desde el
 * servidor que dentro del formulario.
 *
 * Tinta sobre papel, como el resto de la aplicación. El único color es el del
 * logo, que es suyo.
 */
export default function Documento({ tipo, numero, contenido }) {
  const d = contenido ?? {};
  return (
    <article className="documento" aria-label={`${TIPOS[tipo].nombre} ${codigo(numero)}`}>
      <Cabecera tipo={tipo} numero={numero} d={d} />
      {tipo === 'hoja' ? <CuerpoHoja d={d} /> : <CuerpoCobro d={d} />}
      <Firmas />
      <p className="documento__despedida">{negocio.despedida}</p>
    </article>
  );
}

function Cabecera({ tipo, numero, d }) {
  return (
    <header className="documento__cabecera">
      <img src="/logo.jpg" alt={negocio.nombre} className="documento__logo"
        width={96} height={96} />
      <div className="documento__empresa">
        <p className="documento__nombre">{negocio.nombre}</p>
        <p className="documento__lema">{negocio.lema}</p>
        <p className="documento__contacto">{negocio.web} · {negocio.correo}</p>
        <p className="documento__contacto">Tel. {negocio.telefono} · {negocio.titular}</p>
      </div>
      <div className="documento__identidad">
        <h2 className="documento__tipo">{TIPOS[tipo].nombre}</h2>
        <p className="documento__numero">{codigo(numero)}</p>
        <p>{comoFecha(d.fecha)}{d.hora ? ` · ${d.hora} h` : ''}</p>
        {tipo === 'cobro' && d.ciudad && <p>{d.ciudad}</p>}
      </div>
    </header>
  );
}

/** Una etiqueta y su valor. Un dato vacío deja la raya, como un impreso. */
function Dato({ etiqueta, children, ancho = false }) {
  const vacio = children === '' || children === null || children === undefined;
  return (
    <div className={ancho ? 'documento__dato documento__dato--ancho' : 'documento__dato'}>
      <dt>{etiqueta}</dt>
      <dd>{vacio ? ' ' : children}</dd>
    </div>
  );
}

function DatosCliente({ c = {} }) {
  return (
    <section className="documento__bloque">
      <h3 className="documento__seccion">Datos del cliente</h3>
      <dl className="documento__datos">
        <Dato etiqueta="Nombre y apellidos" ancho>{c.nombre}</Dato>
        <Dato etiqueta="DNI / NIF">{c.nif}</Dato>
        <Dato etiqueta="Teléfono">{c.telefono}</Dato>
        <Dato etiqueta="Dirección" ancho>{c.direccion}</Dato>
        <Dato etiqueta="Localidad">{c.localidad}</Dato>
        <Dato etiqueta="Código postal">{c.codigoPostal}</Dato>
      </dl>
    </section>
  );
}

function CuerpoHoja({ d }) {
  const t = calcular('hoja', d);
  const tareas = d.tareas ?? [];
  const personal = d.personal ?? [];

  return (
    <>
      <div className="documento__columnas">
        <DatosCliente c={d.cliente} />
        <section className="documento__bloque">
          <h3 className="documento__seccion">Servicio</h3>
          <dl className="documento__datos">
            <Dato etiqueta="Tipo de limpieza" ancho>{d.tipoLimpieza}</Dato>
            <Dato etiqueta="Fecha">{comoFecha(d.fecha)}</Dato>
            <Dato etiqueta="Hora">{d.hora}</Dato>
            <Dato etiqueta="Horas contratadas">{cifra(d.horasContratadas)}</Dato>
            <Dato etiqueta="Facturado">{d.facturado ? 'Sí' : 'No'}</Dato>
          </dl>
        </section>
      </div>

      <section className="documento__bloque">
        <h3 className="documento__seccion">Descripción del servicio</h3>
        <table className="documento__tabla">
          <thead>
            <tr>
              <th scope="col">Descripción</th>
              <th scope="col" className="num">Cantidad</th>
              <th scope="col">Observaciones</th>
              <th scope="col" className="documento__marca-col">Realizada</th>
              <th scope="col">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {tareas.map((f, i) => (
              <tr key={i}>
                <td>{f.descripcion}</td>
                <td className="num">{f.cantidad}</td>
                <td>{f.observaciones}</td>
                <td className="documento__marca-col">{f.realizada ? '✓' : ''}</td>
                <td>{f.responsable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="documento__columnas">
        <section className="documento__bloque">
          <h3 className="documento__seccion">
            Personal asignado{personal.length ? ` (${personal.length})` : ''}
          </h3>
          {personal.length
            ? <ul className="documento__personal">{personal.map((p) => <li key={p}>{p}</li>)}</ul>
            : <p className="documento__vacio">Sin asignar.</p>}

          <dl className="documento__datos documento__datos--horas">
            <Dato etiqueta="Horas contratadas">{cifra(d.horasContratadas)}</Dato>
            <Dato etiqueta="Horas extras">{cifra(d.horasExtras)}</Dato>
            <Dato etiqueta="Total horas">{cifra(t.totalHoras)}</Dato>
          </dl>
          <p className="documento__linea">
            Productos de limpieza incluidos: <strong>{d.productosIncluidos ? 'Sí' : 'No'}</strong>
          </p>
        </section>

        <section className="documento__bloque">
          <h3 className="documento__seccion">Importes</h3>
          <table className="documento__tabla documento__importes">
            <tbody>
              {IMPORTES_HOJA.map((i) => (
                <tr key={i.campo}>
                  <th scope="row">
                    {i.campo === 'servicio' && leerNumero(d.horasContratadas)
                      ? `Valor ${cifra(d.horasContratadas)} horas contratadas` : i.texto}
                  </th>
                  <td className="dinero">{euros(d.importes?.[i.campo])}</td>
                </tr>
              ))}
              <tr className="documento__subtotal">
                <th scope="row">Subtotal</th>
                <td className="dinero">{euros(t.subtotal)}</td>
              </tr>
              <tr>
                <th scope="row">IVA {cifra(t.ivaPorcentaje)} %</th>
                <td className="dinero">{euros(t.iva)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Valor total del servicio</th>
                <td className="dinero">{euros(t.total)}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      </div>

      {d.observaciones && (
        <section className="documento__bloque">
          <h3 className="documento__seccion">Observaciones</h3>
          <p className="documento__texto">{d.observaciones}</p>
        </section>
      )}
    </>
  );
}

function CuerpoCobro({ d }) {
  const t = calcular('cobro', d);
  const lineas = d.lineas ?? [];

  return (
    <>
      <DatosCliente c={d.cliente} />

      <section className="documento__bloque">
        <h3 className="documento__seccion">{d.concepto || 'Detalle'}</h3>
        <table className="documento__tabla">
          <thead>
            <tr>
              <th scope="col">Descripción</th>
              <th scope="col">Fecha</th>
              <th scope="col" className="num">Cantidad</th>
              <th scope="col" className="num">Valor unitario</th>
              <th scope="col" className="num">Valor total</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={i}>
                <td>{l.descripcion}</td>
                <td>{comoFecha(l.fecha)}</td>
                <td className="num">{cifra(t.lineas[i].cantidad)}</td>
                <td className="dinero">{euros(t.lineas[i].unitario)}</td>
                <td className="dinero">{euros(t.lineas[i].importe)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2}>
                {leerNumero(d.totalHoras) ? `Total horas: ${cifra(d.totalHoras)}` : ''}
              </th>
              <th scope="row" colSpan={2} className="num">Total</th>
              <td className="dinero">{euros(t.total)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {d.observaciones && (
        <section className="documento__bloque">
          <h3 className="documento__seccion">Observaciones</h3>
          <p className="documento__texto">{d.observaciones}</p>
        </section>
      )}
    </>
  );
}

function Firmas() {
  return (
    <footer className="documento__firmas">
      <div>
        <span className="documento__firma-raya" />
        <p>Representante legal</p>
        <p className="documento__firma-nombre">{negocio.titular}</p>
      </div>
      <div>
        <span className="documento__firma-raya" />
        <p>Cliente</p>
      </div>
    </footer>
  );
}
