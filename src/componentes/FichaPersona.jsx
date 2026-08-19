'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { guardarCliente, guardarColaborador, borrarCliente, borrarColaborador }
  from '../lib/acciones.js';
import { useLlevarANuevo } from './rutas.js';
import { codigo } from '../lib/formato.js';
import { intentar } from './intentar.js';

/**
 * Alta y edición de un cliente o de un colaborador.
 *
 * Los dos tienen casi la misma forma —nombre, contacto, notas, activo— así que
 * comparten componente y sólo cambia a qué acción llaman. Duplicar esto en dos
 * archivos casi idénticos es la manera segura de que dentro de un mes uno
 * valide algo que el otro no.
 *
 * Lo único que tiene el cliente y no el colaborador, además de la dirección, es
 * el colaborador habitual: quién suele ir. `colaboradores` es la lista para el
 * desplegable y sólo hace falta cuando `tipo` es cliente.
 */
export default function FichaPersona({ tipo, persona, alTerminar, colaboradores = [] }) {
  const esCliente = tipo === 'cliente';
  const router = useRouter();
  const llevarANuevo = useLlevarANuevo();
  const [abierto, setAbierto] = useState(Boolean(persona));
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);

  // Se lleva en estado para poder enseñar el teléfono de quien elija sin ir al
  // servidor: la lista ya viene con los teléfonos dentro.
  const [colabId, setColabId] = useState(String(persona?.colaborador_id ?? ''));
  const elegido = colaboradores.find((c) => String(c.id) === colabId) ?? null;

  const guardar = esCliente ? guardarCliente : guardarColaborador;
  const borrarlo = esCliente ? borrarCliente : borrarColaborador;
  const nombreTipo = esCliente ? 'cliente' : 'colaborador';

  function enviar(evento) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);
    empezar(async () => {
      const r = await intentar(() => guardar(persona?.id ?? null, datos));
      if (r?.error) { setError(r.error); return; }

      // Al crear, la fila nueva no queda a la vista: estas tablas se ordenan
      // por dinero y lo que acaba de nacer no tiene ninguno. Se marca en la URL
      // para que la pantalla la señale y se desplace hasta ella.
      if (persona) { router.refresh(); alTerminar?.(); }
      else { setAbierto(false); llevarANuevo(r?.id); }
    });
  }

  function borrar() {
    if (!confirm(`¿Borrar este ${nombreTipo}?`)) return;
    empezar(async () => {
      const r = await intentar(() => borrarlo(persona.id), 'borrar');
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

      {esCliente && (
        <div className="campo">
          <span><label htmlFor="colaborador_id">Colaborador habitual</label></span>
          <select id="colaborador_id" name="colaborador_id" value={colabId}
            onChange={(e) => setColabId(e.target.value)}>
            <option value="">— sin asignar —</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {codigo(c.id)}{c.activo ? '' : ' · inactivo'}
              </option>
            ))}
          </select>
          <span className="campo__ayuda">Quien suele ir. Puede quedar en blanco.</span>
        </div>
      )}

      {esCliente && (
        <div className="campo">
          <span>Teléfono del colaborador</span>
          {/* No es un campo: se lee de la ficha de esa persona. Si se pudiera
              escribir aquí, el mismo número acabaría copiado en hasta siete
              fichas de cliente y ninguna avisaría al quedarse vieja. */}
          <p className="campo__leido">
            {!elegido && <span className="tenue">elige antes un colaborador</span>}
            {elegido && elegido.telefono && <a href={`tel:${elegido.telefono}`}>{elegido.telefono}</a>}
            {elegido && !elegido.telefono && (
              <span className="campo__falta">
                sin teléfono — <Link href={`/colaboradores?nuevo=${elegido.id}`}>ponérselo</Link>
              </span>
            )}
          </p>
          <span className="campo__ayuda">Se guarda en su ficha, no aquí.</span>
        </div>
      )}

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
