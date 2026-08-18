'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { guardarGasto, borrarGasto } from '../lib/acciones.js';
import { fechaDeHoy } from './formato.js';
import { intentar } from './intentar.js';
import { euros, fecha as comoFecha, nombrePeriodo } from '../lib/formato.js';

/**
 * Gastos de empresa: la compra del mes, la ferretería, el seguro.
 *
 * Estos importes NO se reparten entre los clientes. En el Excel vivían dentro
 * de las filas de servicio, y eso le cargaba una compra del súper al cliente
 * que hubiera en esa fila. Aquí son del mes, y sólo del mes.
 */
export default function PanelGastos({ gastos }) {
  const router = useRouter();
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);

  function enviar(evento, id) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);
    empezar(async () => {
      const r = await intentar(() => guardarGasto(id, datos));
      if (r?.error) { setError(r.error); return; }
      router.refresh();
      setEditando(null);
      setCreando(false);
    });
  }

  function borrar(id) {
    if (!confirm('¿Borrar este gasto?')) return;
    empezar(async () => {
      const r = await intentar(() => borrarGasto(id), 'borrar');
      if (r?.error) { setError(r.error); return; }
      router.refresh();
    });
  }

  const formulario = (gasto, id) => (
    <form className="formulario" onSubmit={(e) => enviar(e, id)}>
      <label className="campo">
        <span>Fecha</span>
        <input type="date" name="fecha" defaultValue={gasto?.fecha || fechaDeHoy()} />
      </label>
      <label className="campo">
        <span>Mes contable</span>
        <input type="month" name="periodo" defaultValue={gasto?.periodo || ''} />
      </label>
      <label className="campo">
        <span>Comercio</span>
        <input type="text" name="comercio" defaultValue={gasto?.comercio ?? ''} />
      </label>
      <label className="campo">
        <span>Concepto</span>
        <input type="text" name="concepto" defaultValue={gasto?.concepto ?? ''} />
      </label>
      <label className="campo">
        <span>Importe</span>
        <input type="text" inputMode="decimal" name="importe" required
          defaultValue={gasto?.importe ?? ''} />
      </label>
      <div className="formulario__acciones">
        <button type="submit" className="boton boton--principal" disabled={enviando}>
          {enviando ? 'Guardando…' : gasto ? 'Guardar' : 'Añadir gasto'}
        </button>
        <button type="button" className="boton boton--plano" disabled={enviando}
          onClick={() => { setEditando(null); setCreando(false); }}>
          Cancelar
        </button>
      </div>
    </form>
  );

  const total = gastos.reduce((a, g) => a + g.importe, 0);

  return (
    <>
      {error && <p className="alerta alerta--error">{error}</p>}

      <div className="barra-seccion">
        <p className="bloque__cifra">
          <strong>{gastos.length}</strong> apuntes · <strong>{euros(total)}</strong>
        </p>
        <button type="button" className="boton boton--principal"
          onClick={() => { setCreando((v) => !v); setEditando(null); }}>
          {creando ? 'Cerrar' : 'Añadir gasto'}
        </button>
      </div>

      {creando && formulario(null, null)}

      {gastos.length === 0 ? (
        <p className="vacio">No hay gastos apuntados en este mes.</p>
      ) : (
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Fecha</th>
                <th scope="col">Comercio</th>
                <th scope="col">Concepto</th>
                <th scope="col" className="num">Importe</th>
                <th scope="col"><span className="visualmente-oculto">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((g) => (
                <Fragment key={g.id}>
                  <tr>
                    <th scope="row">{nombrePeriodo(g.periodo)}</th>
                    <td>{comoFecha(g.fecha) || <span className="tenue">—</span>}</td>
                    <td className="celda-nota">{g.comercio}</td>
                    <td className="celda-nota">{g.concepto}</td>
                    <td className="dinero">{euros(g.importe)}</td>
                    <td className="acciones-fila">
                      <button type="button" className="boton boton--plano"
                        onClick={() => setEditando(editando === g.id ? null : g.id)}>
                        {editando === g.id ? 'Cerrar' : 'Editar'}
                      </button>
                      <button type="button" className="boton boton--plano"
                        onClick={() => borrar(g.id)} disabled={enviando}>
                        Borrar
                      </button>
                    </td>
                  </tr>
                  {editando === g.id && (
                    <tr>
                      <td colSpan={6}>{formulario(g, g.id)}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={4}>Total</th>
                <td className="dinero">{euros(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
