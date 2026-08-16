'use client';

import { useState } from 'react';
import Link from 'next/link';

import FormularioServicio from './FormularioServicio.jsx';
import { tonoDinero } from './formato.js';
import { euros, numero, fecha as comoFecha } from '../lib/formato.js';

/**
 * Tabla de servicios con edición en la propia fila.
 *
 * Se edita donde se lee: al pulsar una fila se abre el formulario debajo, sin
 * cambiar de página y sin perder de vista el resto del mes. Es la pantalla en
 * la que va a pasar el tiempo, y es la que sustituye a desplazarse por una hoja
 * de 224 filas buscando dónde escribir.
 */
export default function PanelServicios({ servicios, clientes, colaboradores }) {
  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);

  return (
    <>
      <div className="barra-seccion">
        <p className="bloque__cifra">
          <strong>{numero(servicios.length)}</strong> servicios
        </p>
        <button type="button" className="boton boton--principal"
          onClick={() => { setCreando((v) => !v); setEditando(null); }}>
          {creando ? 'Cerrar' : 'Añadir servicio'}
        </button>
      </div>

      {creando && (
        <FormularioServicio clientes={clientes} colaboradores={colaboradores}
          alTerminar={() => setCreando(false)} />
      )}

      {servicios.length === 0 ? (
        <p className="vacio">No hay servicios con estos filtros.</p>
      ) : (
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Cliente</th>
                <th scope="col">Quién</th>
                <th scope="col" className="num">Horas</th>
                <th scope="col" className="num">Valor</th>
                <th scope="col" className="num">Colaboradores</th>
                <th scope="col" className="num">Transporte</th>
                <th scope="col" className="num">Margen</th>
                <th scope="col"><span className="visualmente-oculto">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {servicios.map((s) => (
                <Fila key={s.id} servicio={s}
                  abierto={editando === s.id}
                  alAbrir={() => { setEditando(editando === s.id ? null : s.id); setCreando(false); }}
                  clientes={clientes} colaboradores={colaboradores}
                  alCerrar={() => setEditando(null)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Fila({ servicio: s, abierto, alAbrir, alCerrar, clientes, colaboradores }) {
  return (
    <>
      <tr className={[s.margen < 0 ? 'fila--perdida' : '',
        s.borrador ? 'fila--borrador' : ''].filter(Boolean).join(' ') || undefined}>
        <td>
          {comoFecha(s.fecha) || <span className="tenue">sin fecha</span>}
          {Boolean(s.borrador) && <> <span className="marca marca--borrador">borrador</span></>}
          {Boolean(s.revisar) && <> <span className="marca marca--revisar">revisar</span></>}
        </td>
        <th scope="row" className="celda-nombre">
          <Link href={`/clientes/${s.cliente_id}`}>{s.cliente}</Link>
        </th>
        <td className="celda-nota">{s.colaboradores || <span className="tenue">nadie</span>}</td>
        <td className="num">{numero(s.horas)}</td>
        <td className="dinero">{euros(s.valor)}</td>
        <td className="dinero">{euros(s.pago_colab)}</td>
        <td className="dinero">{euros(s.transporte)}</td>
        <td className={`dinero ${tonoDinero(s.margen)}`}>{euros(s.margen)}</td>
        <td className="acciones-fila">
          <button type="button" className="boton boton--plano" onClick={alAbrir}
            aria-expanded={abierto}>
            {abierto ? 'Cerrar' : 'Editar'}
          </button>
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={9}>
            <FormularioServicio servicio={s} clientes={clientes}
              colaboradores={colaboradores} alTerminar={alCerrar} />
          </td>
        </tr>
      )}
    </>
  );
}
