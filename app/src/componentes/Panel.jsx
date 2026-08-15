import { useMemo, useState } from 'react';
import { entero, euros, numero, porcentaje, fecha } from '../lib/formato.js';
import { comoTitulo } from '../lib/texto.js';

/** Importe con signo cromático. El color se reserva para esto y para «revisar». */
function Dinero({ v, coloreado = false, className = '' }) {
  const clase = [
    'dinero',
    coloreado ? (v < 0 ? 'dinero--perdida' : 'dinero--margen') : '',
    className,
  ].filter(Boolean).join(' ');
  return <td className={clase}>{euros(v)}</td>;
}

/**
 * Tercera etapa: los números.
 *
 * Sustituye a una hoja que lleva dos años leyendo cada mes, así que se parece
 * a un libro de cuentas: filas finas, cifras alineadas por la coma, y nada de
 * color salvo donde hay una decisión que tomar.
 */
export default function Panel({
  metricas, lectura, resumenBase, almacen, alReiniciar, alVolverARevisar,
}) {
  const { totales, porPeriodo, porCliente, porColaborador, clientesEnPerdida, reparto } = metricas;
  const [verTodosClientes, setVerTodosClientes] = useState(false);
  const [verTodosColab, setVerTodosColab] = useState(false);

  const clientesVisibles = verTodosClientes ? porCliente : porCliente.slice(0, 20);
  const colabVisibles = verTodosColab ? porColaborador : porColaborador.slice(0, 20);

  const perdidaTotal = useMemo(
    () => clientesEnPerdida.reduce((a, c) => a + c.margen, 0), [clientesEnPerdida]);

  const descuadre = Math.abs(reparto.repartido - reparto.asignado);

  return (
    <section className="panel">
      {/* ── Totales ───────────────────────────────────────────── */}
      <div className="resumen">
        <h2 className="seccion__titulo">De {porPeriodo[0]?.etiqueta} a {porPeriodo.at(-1)?.etiqueta}</h2>
        <dl className="cifras cifras--panel">
          <div className="cifra">
            <dt>Facturado</dt>
            <dd className="cifra__valor cifra__valor--dinero">{euros(totales.valor)}</dd>
          </div>
          <div className="cifra">
            <dt>Costes</dt>
            <dd className="cifra__valor cifra__valor--dinero">
              {euros(totales.pagoColab + totales.transporte + totales.gasto)}
            </dd>
          </div>
          <div className="cifra cifra--destacada">
            <dt>Margen</dt>
            <dd className={'cifra__valor cifra__valor--dinero ' +
              (totales.margen < 0 ? 'dinero--perdida' : 'dinero--margen')}>
              {euros(totales.margen)}
            </dd>
            <dd className="cifra__pie">{porcentaje(totales.margen, totales.valor)} de lo facturado</dd>
          </div>
          <div className="cifra">
            <dt>Servicios</dt>
            <dd className="cifra__valor">{entero(totales.servicios)}</dd>
            <dd className="cifra__pie">{numero(totales.horas)} horas</dd>
          </div>
        </dl>
        <p className="nota-metodo">
          El margen es <strong>lo facturado menos lo pagado a colaboradores,
          el transporte y el gasto</strong> de cada servicio. No se usa la
          columna «RENTABILIDAD» del libro: está escrita a mano y no sigue el
          mismo criterio de una hoja a otra.
        </p>
      </div>

      {/* ── Lo que pierde dinero ──────────────────────────────── */}
      {clientesEnPerdida.length > 0 && (
        <section className="bloque bloque--perdida">
          <div className="bloque__cab">
            <h3>Clientes que cuestan más de lo que pagan</h3>
            <p className="bloque__cifra">
              <strong className="dinero--perdida">{euros(perdidaTotal)}</strong> al
              año entre {entero(clientesEnPerdida.length)}{' '}
              {clientesEnPerdida.length === 1 ? 'cliente' : 'clientes'}
            </p>
          </div>
          <div className="tabla-envoltorio">
            <table className="tabla tabla--cifras">
              <caption className="visualmente-oculto">Clientes con margen negativo</caption>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col" className="num">Serv.</th>
                  <th scope="col" className="num">Facturado</th>
                  <th scope="col" className="num">Costes</th>
                  <th scope="col" className="num">Margen</th>
                  <th scope="col" className="num">%</th>
                </tr>
              </thead>
              <tbody>
                {clientesEnPerdida.map((c) => (
                  <tr key={c.cliente}>
                    <th scope="row" className="celda-nombre">{comoTitulo(c.cliente)}</th>
                    <td className="num">{entero(c.servicios)}</td>
                    <Dinero v={c.valor} />
                    <Dinero v={c.pagoColab + c.transporte + c.gasto} />
                    <Dinero v={c.margen} coloreado />
                    <td className="num dinero dinero--perdida">{porcentaje(c.margen, c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="bloque__pie">
            Cada uno de estos servicios se hizo. La diferencia entre lo que
            cobras y lo que cuesta sale de tu bolsillo.
          </p>
        </section>
      )}

      {/* ── Por mes ───────────────────────────────────────────── */}
      <section className="bloque">
        <div className="bloque__cab"><h3>Mes a mes</h3></div>
        <div className="tabla-envoltorio">
          <table className="tabla tabla--cifras">
            <caption className="visualmente-oculto">Resultado por mes</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col" className="num">Serv.</th>
                <th scope="col" className="num">Horas</th>
                <th scope="col" className="num">Facturado</th>
                <th scope="col" className="num">Colaboradores</th>
                <th scope="col" className="num">Transporte</th>
                <th scope="col" className="num">Gastos</th>
                <th scope="col" className="num">Margen</th>
                <th scope="col" className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {porPeriodo.map((p) => (
                <tr key={p.periodo}>
                  <th scope="row" className="celda-nombre">{p.etiqueta}</th>
                  <td className="num">{entero(p.servicios)}</td>
                  <td className="num">{numero(p.horas)}</td>
                  <Dinero v={p.valor} />
                  <Dinero v={p.pagoColab} />
                  <Dinero v={p.transporte} />
                  <Dinero v={p.gasto} />
                  <Dinero v={p.margen} coloreado />
                  <td className={'num dinero ' + (p.margen < 0 ? 'dinero--perdida' : 'dinero--margen')}>
                    {porcentaje(p.margen, p.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="num">{entero(totales.servicios)}</td>
                <td className="num">{numero(totales.horas)}</td>
                <Dinero v={totales.valor} />
                <Dinero v={totales.pagoColab} />
                <Dinero v={totales.transporte} />
                <Dinero v={totales.gasto} />
                <Dinero v={totales.margen} coloreado />
                <td className={'num dinero ' + (totales.margen < 0 ? 'dinero--perdida' : 'dinero--margen')}>
                  {porcentaje(totales.margen, totales.valor)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── Por cliente ───────────────────────────────────────── */}
      <section className="bloque">
        <div className="bloque__cab">
          <h3>Margen por cliente</h3>
          <p className="bloque__cifra">{entero(porCliente.length)} clientes</p>
        </div>
        <div className="tabla-envoltorio">
          <table className="tabla tabla--cifras">
            <caption className="visualmente-oculto">Margen por cliente, de mayor a menor</caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col" className="num">Serv.</th>
                <th scope="col" className="num">Horas</th>
                <th scope="col" className="num">Facturado</th>
                <th scope="col" className="num">Costes</th>
                <th scope="col" className="num">Margen</th>
                <th scope="col" className="num">%</th>
                <th scope="col" className="num">Último</th>
              </tr>
            </thead>
            <tbody>
              {clientesVisibles.map((c) => (
                <tr key={c.cliente} className={c.margen < 0 ? 'fila--perdida' : undefined}>
                  <th scope="row" className="celda-nombre">{comoTitulo(c.cliente)}</th>
                  <td className="num">{entero(c.servicios)}</td>
                  <td className="num">{numero(c.horas)}</td>
                  <Dinero v={c.valor} />
                  <Dinero v={c.pagoColab + c.transporte + c.gasto} />
                  <Dinero v={c.margen} coloreado />
                  <td className={'num dinero ' + (c.margen < 0 ? 'dinero--perdida' : 'dinero--margen')}>
                    {porcentaje(c.margen, c.valor)}
                  </td>
                  <td className="num tenue">{fecha(c.ultimaFecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {porCliente.length > 20 && (
          <button type="button" className="boton boton--plano"
            onClick={() => setVerTodosClientes((v) => !v)}>
            {verTodosClientes ? 'Ver sólo los 20 primeros' : `Ver los ${porCliente.length - 20} clientes restantes`}
          </button>
        )}
      </section>

      {/* ── Por colaborador ───────────────────────────────────── */}
      <section className="bloque">
        <div className="bloque__cab">
          <h3>Pagos por colaborador</h3>
          <p className="bloque__cifra">{entero(porColaborador.length)} personas</p>
        </div>
        <p className="bloque__desc">
          Cuando un servicio lo hacen varias personas, su pago se reparte entre
          ellas a partes iguales. El reparto cuadra al céntimo con lo anotado
          en el libro.
        </p>
        <div className="tabla-envoltorio">
          <table className="tabla tabla--cifras">
            <caption className="visualmente-oculto">Pagos por colaborador, de mayor a menor</caption>
            <thead>
              <tr>
                <th scope="col">Colaborador</th>
                <th scope="col" className="num">Serv.</th>
                <th scope="col" className="num">Horas</th>
                <th scope="col" className="num">Cobrado</th>
                <th scope="col" className="num">Facturado a cliente</th>
                <th scope="col" className="num">Último</th>
              </tr>
            </thead>
            <tbody>
              {colabVisibles.map((t) => (
                <tr key={t.colaborador}>
                  <th scope="row" className="celda-nombre">{comoTitulo(t.colaborador)}</th>
                  <td className="num">{entero(t.servicios)}</td>
                  <td className="num">{numero(t.horas)}</td>
                  <Dinero v={t.pago} />
                  <Dinero v={t.valorGenerado} />
                  <td className="num tenue">{fecha(t.ultimaFecha)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total repartido</th>
                <td className="num" />
                <td className="num" />
                <Dinero v={reparto.repartido} />
                <td className="num" />
                <td className="num" />
              </tr>
            </tfoot>
          </table>
        </div>
        {porColaborador.length > 20 && (
          <button type="button" className="boton boton--plano"
            onClick={() => setVerTodosColab((v) => !v)}>
            {verTodosColab ? 'Ver sólo los 20 primeros' : `Ver los ${porColaborador.length - 20} restantes`}
          </button>
        )}

        <div className="cuadre">
          <p>
            <span>Anotado en el libro para servicios con colaborador</span>
            <span className="dinero">{euros(reparto.asignado)}</span>
          </p>
          <p>
            <span>Sumado en el reparto por persona</span>
            <span className="dinero">{euros(reparto.repartido)}</span>
          </p>
          <p className={descuadre < 0.005 ? 'cuadre--ok' : 'cuadre--mal'}>
            <span>Diferencia</span>
            <span className="dinero">{euros(reparto.repartido - reparto.asignado)}</span>
          </p>
          {reparto.sinColaborador > 0 && (
            <p className="cuadre__nota">
              Quedan {entero(reparto.sinColaborador)} servicios sin colaborador
              anotado ({euros(reparto.pagoSinColaborador)} en pagos). No se
              reparten porque no consta a quién.
            </p>
          )}
        </div>
      </section>

      {/* ── Trazabilidad ──────────────────────────────────────── */}
      <section className="bloque bloque--tenue">
        <div className="bloque__cab"><h3>De dónde sale cada número</h3></div>
        <p className="bloque__desc">
          Cada servicio guarda la hoja y la fila de las que salió, así que
          cualquier cifra de esta pantalla se puede rastrear hasta una línea
          concreta de tu archivo.
        </p>
        {resumenBase ? (
          <dl className="cifras cifras--minimas">
            <div className="cifra"><dt>Clientes</dt><dd className="cifra__valor">{entero(resumenBase.clientes)}</dd></div>
            <div className="cifra"><dt>Trabajadores</dt><dd className="cifra__valor">{entero(resumenBase.trabajadores)}</dd></div>
            <div className="cifra"><dt>Servicios</dt><dd className="cifra__valor">{entero(resumenBase.servicios)}</dd></div>
            <div className="cifra"><dt>Asignaciones</dt><dd className="cifra__valor">{entero(resumenBase.asignaciones)}</dd></div>
          </dl>
        ) : (
          <p className="vacio">No se ha podido guardar en SQLite, pero los números de arriba son correctos.</p>
        )}
        <p className="bloque__pie tenue">
          {almacen.modo === 'opfs'
            ? 'Guardado en SQLite (OPFS), dentro de este navegador.'
            : 'Guardado en SQLite en memoria: se pierde al recargar.'}
          {' '}Origen: {entero(lectura.hojas.filter((h) => h.estado === 'importada').length)} de{' '}
          {entero(lectura.hojas.length)} hojas con nombre CLIENTES.
        </p>
      </section>

      <div className="acciones">
        {alVolverARevisar && (
          <button type="button" className="boton" onClick={alVolverARevisar}>
            Volver a la revisión de nombres
          </button>
        )}
        <button type="button" className="boton boton--plano" onClick={alReiniciar}>
          Cargar otro archivo
        </button>
      </div>
    </section>
  );
}
