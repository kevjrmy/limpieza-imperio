'use client';

import { useRouter } from 'next/navigation';

import { nombrePeriodo } from '../lib/formato.js';

/**
 * Filtros de mes y de "sólo lo que hay que revisar".
 *
 * Van a la URL en vez de a un estado interno: así un mes concreto se puede
 * guardar en marcadores, volver atrás funciona y recargar no pierde el sitio.
 */
export default function Filtros({ ruta, periodos, periodo, revisar, borrador,
  conRevisar = true, conBorrador = false }) {
  const router = useRouter();

  function ir(cambios) {
    const q = new URLSearchParams();
    const v = { periodo, revisar, borrador, ...cambios };
    if (v.periodo) q.set('periodo', v.periodo);
    if (v.revisar) q.set('revisar', '1');
    if (v.borrador && v.borrador !== 'no') q.set('borrador', v.borrador);
    router.push(`${ruta}${q.toString() ? `?${q}` : ''}`);
  }

  return (
    <div className="filtros">
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
    </div>
  );
}
