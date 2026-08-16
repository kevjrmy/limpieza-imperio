'use client';

import { useRouter } from 'next/navigation';

import { nombrePeriodo } from '../lib/formato.js';

/**
 * Filtros de mes y de "sólo lo que hay que revisar".
 *
 * Van a la URL en vez de a un estado interno: así un mes concreto se puede
 * guardar en marcadores, volver atrás funciona y recargar no pierde el sitio.
 */
export default function Filtros({ ruta, periodos, periodo, revisar, conRevisar = true }) {
  const router = useRouter();

  function ir(cambios) {
    const q = new URLSearchParams();
    const v = { periodo, revisar, ...cambios };
    if (v.periodo) q.set('periodo', v.periodo);
    if (v.revisar) q.set('revisar', '1');
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
