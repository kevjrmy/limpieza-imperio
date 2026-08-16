'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { guardarCliente, guardarColaborador, borrarCliente, borrarColaborador }
  from '../lib/acciones.js';

/**
 * Alta y edición de un cliente o de un colaborador.
 *
 * Los dos tienen la misma forma —nombre, contacto, notas, activo— así que
 * comparten componente y sólo cambia a qué acción llaman. Duplicar esto en dos
 * archivos casi idénticos es la manera segura de que dentro de un mes uno
 * valide algo que el otro no.
 */
export default function FichaPersona({ tipo, persona, alTerminar }) {
  const esCliente = tipo === 'cliente';
  const router = useRouter();
  const [abierto, setAbierto] = useState(Boolean(persona));
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);

  const guardar = esCliente ? guardarCliente : guardarColaborador;
  const borrarlo = esCliente ? borrarCliente : borrarColaborador;
  const nombreTipo = esCliente ? 'cliente' : 'colaborador';

  function enviar(evento) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);
    empezar(async () => {
      const r = await guardar(persona?.id ?? null, datos);
      if (r?.error) { setError(r.error); return; }
      router.refresh();
      if (persona) alTerminar?.(); else setAbierto(false);
    });
  }

  function borrar() {
    if (!confirm(`¿Borrar este ${nombreTipo}?`)) return;
    empezar(async () => {
      const r = await borrarlo(persona.id);
      if (r?.error) { setError(r.error); return; }
      router.refresh();
      if (esCliente) router.push('/clientes');
      alTerminar?.();
    });
  }

  if (!persona && !abierto) {
    return (
      <div className="barra-seccion">
        <span />
        <button type="button" className="boton boton--principal" onClick={() => setAbierto(true)}>
          Añadir {nombreTipo}
        </button>
      </div>
    );
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      {error && <p className="alerta alerta--error campo--ancho">{error}</p>}

      <label className="campo">
        <span>Nombre</span>
        <input type="text" name="nombre" required defaultValue={persona?.nombre ?? ''} />
      </label>

      {esCliente && (
        <label className="campo">
          <span>Dirección</span>
          <input type="text" name="direccion" defaultValue={persona?.direccion ?? ''} />
        </label>
      )}

      <label className="campo">
        <span>Teléfono</span>
        <input type="tel" name="telefono" defaultValue={persona?.telefono ?? ''} />
      </label>

      <label className="campo campo--ancho">
        <span>Notas</span>
        <textarea name="notas" defaultValue={persona?.notas ?? ''} />
      </label>

      <label className="campo campo--casilla">
        <input type="checkbox" name="activo" defaultChecked={persona ? Boolean(persona.activo) : true} />
        <span>Activo</span>
      </label>

      <div className="formulario__acciones">
        <button type="submit" className="boton boton--principal" disabled={enviando}>
          {enviando ? 'Guardando…' : persona ? 'Guardar cambios' : `Añadir ${nombreTipo}`}
        </button>
        <button type="button" className="boton boton--plano" disabled={enviando}
          onClick={() => (persona ? alTerminar?.() : setAbierto(false))}>
          Cancelar
        </button>
        {persona && (
          <button type="button" className="boton boton--plano" onClick={borrar} disabled={enviando}>
            Borrar
          </button>
        )}
      </div>
    </form>
  );
}
