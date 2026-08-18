'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { crearServicio, actualizarServicio, borrarServicio } from '../lib/acciones.js';
import { fechaDeHoy } from './formato.js';
import { useLlevarANuevo } from './rutas.js';
import { euros } from '../lib/formato.js';

/**
 * Alta y edición de un servicio.
 *
 * El margen se calcula en vivo mientras escribe, con el mismo criterio que la
 * base: es la cifra por la que existe todo esto, y verla cambiar al teclear el
 * pago del colaborador es la mitad del valor de la pantalla.
 */
export default function FormularioServicio({ servicio, clientes, colaboradores, alTerminar }) {
  const router = useRouter();
  const llevarANuevo = useLlevarANuevo();
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);

  const [valor, setValor] = useState(servicio?.valor ?? '');
  const [pagoColab, setPagoColab] = useState(servicio?.pago_colab ?? '');
  const [transporte, setTransporte] = useState(servicio?.transporte ?? '');

  // 'nuevo' = va a escribir un cliente que todavía no está en la lista.
  const [cliente, setCliente] = useState(String(servicio?.cliente_id ?? ''));

  // La consulta devuelve los id asignados como '3,17,42'.
  const elegidos = String(servicio?.colaboradorIds ?? '')
    .split(',').map((t) => t.trim()).filter(Boolean);

  const aNumero = (v) => {
    const n = Number.parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  const margen = aNumero(valor) - aNumero(pagoColab) - aNumero(transporte);

  // Las listas llegan ordenadas por dinero: `clientes()` por margen y
  // `colaboradores()` por pago. Eso es lo correcto en sus pantallas —de eso van—
  // pero aquí son un desplegable donde hay que ENCONTRAR un nombre entre ciento
  // y pico. Ordenados por rentabilidad no hay forma de buscar nada. Se ordenan
  // alfabéticamente sólo para elegir, sin tocar las consultas.
  const porNombre = (lista) => [...lista].sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  const clientesOrdenados = porNombre(clientes);
  const colaboradoresOrdenados = porNombre(colaboradores);

  function enviar(evento) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    empezar(async () => {
      const r = servicio
        ? await actualizarServicio(servicio.id, datos)
        : await crearServicio(datos);

      if (r?.error) { setError(r.error); return; }

      // Lo recién apuntado tampoco cae arriba: la tabla va por fecha y el mes
      // en curso ya tiene servicios con fecha posterior a hoy. Se marca en la
      // URL para señalar la fila y llevarle hasta ella.
      if (servicio) router.refresh(); else llevarANuevo(r?.id);
      alTerminar?.();
    });
  }

  function borrar() {
    if (!confirm('¿Borrar este servicio? No se puede deshacer.')) return;
    empezar(async () => {
      const r = await borrarServicio(servicio.id);
      if (r?.error) { setError(r.error); return; }
      router.refresh();
      alTerminar?.();
    });
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      {error && <p className="alerta alerta--error campo--ancho">{error}</p>}

      <label className="campo">
        <span>Fecha</span>
        <input type="date" name="fecha" required
          defaultValue={servicio?.fecha || fechaDeHoy()} />
      </label>

      <label className="campo">
        <span>Mes contable</span>
        <input type="month" name="periodo" defaultValue={servicio?.periodo || ''} />
        <span className="campo__ayuda">Si se deja vacío, sale de la fecha.</span>
      </label>

      <label className="campo">
        <span>Hora</span>
        <input type="time" name="hora" defaultValue={servicio?.hora || ''} />
      </label>

      <label className="campo">
        <span>Cliente</span>
        <select name="cliente_id" required value={cliente}
          onChange={(e) => setCliente(e.target.value)}>
          <option value="" disabled>Elegir…</option>
          <option value="nuevo">+ Cliente nuevo…</option>
          {clientesOrdenados.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>

      {cliente === 'nuevo' && (
        <label className="campo">
          <span>Nombre del cliente nuevo</span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus -- aparece al pedirlo
              él, y el cursor tiene que estar donde acaba de decir que escribe. */}
          <input type="text" name="cliente_nuevo" required autoFocus
            autoComplete="off" placeholder="Tal y como quiera verlo escrito" />
          <span className="campo__ayuda">
            Se da de alta al guardar el servicio. Si ese nombre ya existe, se usa
            el que hay en vez de duplicarlo.
          </span>
        </label>
      )}

      <label className="campo">
        <span>Horas</span>
        <input type="text" inputMode="decimal" name="horas"
          defaultValue={servicio?.horas ?? ''} />
      </label>

      <label className="campo">
        <span>Personas</span>
        <input type="text" inputMode="decimal" name="personas"
          defaultValue={servicio?.personas ?? ''} />
      </label>

      <label className="campo">
        <span>Valor del servicio</span>
        <input type="text" inputMode="decimal" name="valor" required
          value={valor} onChange={(e) => setValor(e.target.value)} />
      </label>

      <label className="campo">
        <span>Pago a colaboradores</span>
        <input type="text" inputMode="decimal" name="pago_colab"
          value={pagoColab} onChange={(e) => setPagoColab(e.target.value)} />
      </label>

      <label className="campo">
        <span>Transporte</span>
        <input type="text" inputMode="decimal" name="transporte"
          value={transporte} onChange={(e) => setTransporte(e.target.value)} />
      </label>

      <div className="campo">
        <span>Margen</span>
        <output className={`cifra__valor cifra__valor--dinero ${
          margen > 0 ? 'dinero--margen' : margen < 0 ? 'dinero--perdida' : ''}`}>
          {euros(margen)}
        </output>
      </div>

      <label className="campo campo--ancho">
        <span>Quién lo hizo</span>
        <select name="colaboradores" multiple defaultValue={elegidos}>
          {colaboradoresOrdenados.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <span className="campo__ayuda">
          El pago se reparte a partes iguales entre los elegidos, al céntimo.
        </span>
      </label>

      <label className="campo campo--ancho">
        <span>Notas</span>
        <textarea name="notas" defaultValue={servicio?.notas ?? ''} />
      </label>

      <label className="campo campo--casilla">
        <input type="checkbox" name="pagado" defaultChecked={Boolean(servicio?.pagado)} />
        <span>Pagado</span>
      </label>

      <label className="campo campo--casilla">
        <input type="checkbox" name="revisar" defaultChecked={Boolean(servicio?.revisar)} />
        <span>Marcar para revisar</span>
      </label>

      <div className="formulario__acciones">
        <button type="submit" className="boton boton--principal" disabled={enviando}>
          {enviando ? 'Guardando…' : servicio ? 'Guardar cambios' : 'Añadir servicio'}
        </button>
        {alTerminar && (
          <button type="button" className="boton boton--plano" onClick={alTerminar}
            disabled={enviando}>
            Cancelar
          </button>
        )}
        {servicio && (
          <button type="button" className="boton boton--plano" onClick={borrar}
            disabled={enviando}>
            Borrar
          </button>
        )}
      </div>
    </form>
  );
}
