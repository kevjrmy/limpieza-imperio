'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { nombrePeriodo } from '../lib/formato.js';

/**
 * Filtros de mes, de búsqueda y de "sólo lo que hay que revisar".
 *
 * Van a la URL en vez de a un estado interno: así un mes concreto se puede
 * guardar en marcadores, volver atrás funciona y recargar no pierde el sitio.
 * Cambiar cualquier filtro vuelve además a la primera página, que es lo que se
 * espera: si buscas un nombre, lo quieres ver, no seguir en la página 3.
 *
 * Es un `form` y no un `div` para que buscar funcione con Intro además de con
 * el botón. El resto de páginas lo usan igual, sin nada que enviar.
 */
export default function Filtros({ ruta, periodos, periodo, revisar, borrador,
  busqueda = '', conRevisar = true, conBorrador = false, conBusqueda = false,
  pista = 'Cliente, quién o notas…' }) {
  const router = useRouter();
  const [texto, setTexto] = useState(busqueda);

  // La caja es estado propio (se escribe antes de enviar), pero la URL manda:
  // si cambia por detrás —atrás del navegador, "Quitar filtro"— la caja sigue.
  const [ultimaBusqueda, setUltimaBusqueda] = useState(busqueda);
  if (busqueda !== ultimaBusqueda) {
    setUltimaBusqueda(busqueda);
    setTexto(busqueda);
  }

  function ir(cambios) {
    const q = new URLSearchParams();
    const v = { periodo, revisar, borrador, busqueda: texto, ...cambios };
    if (v.periodo) q.set('periodo', v.periodo);
    if (v.revisar) q.set('revisar', '1');
    if (v.borrador && v.borrador !== 'no') q.set('borrador', v.borrador);
    if (conBusqueda && v.busqueda.trim()) q.set('q', v.busqueda.trim());
    router.push(`${ruta}${q.toString() ? `?${q}` : ''}`);
  }

  return (
    <form className="filtros" onSubmit={(e) => { e.preventDefault(); ir({}); }}>
      <label className="campo">
        <span>Mes</span>
        <select value={periodo ?? ''} onChange={(e) => ir({ periodo: e.target.value })}>
          <option value="">Todos</option>
          {periodos.map((p) => (
            <option key={p} value={p}>{nombrePeriodo(p)}</option>
          ))}
        </select>
      </label>

      {conBorrador && (
        <label className="campo">
          <span>Estado</span>
          <select value={borrador ?? 'no'} onChange={(e) => ir({ borrador: e.target.value })}>
            <option value="no">Confirmados</option>
            <option value="si">Sólo borradores</option>
            <option value="todos">Todos</option>
          </select>
        </label>
      )}

      {conRevisar && (
        <label className="campo campo--casilla">
          <input type="checkbox" checked={Boolean(revisar)}
            onChange={(e) => ir({ revisar: e.target.checked })} />
          <span>Sólo lo que hay que revisar</span>
        </label>
      )}

      {conBusqueda && (
        <>
          <label className="campo campo--busqueda">
            <span>Buscar</span>
            <input type="search" name="q" value={texto} placeholder={pista}
              onChange={(e) => setTexto(e.target.value)} />
          </label>
          <button type="submit" className="boton">Buscar</button>
          {busqueda && (
            <button type="button" className="boton boton--plano"
              onClick={() => { setTexto(''); ir({ busqueda: '' }); }}>
              Quitar búsqueda
            </button>
          )}
        </>
      )}
    </form>
  );
}
