'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { guardarCierre } from '../lib/acciones.js';

/**
 * Las cargas que él apuntaba a mano bajo la tabla de cada mes: seguridad
 * social, gestoría y retenciones. No salen de ningún servicio, así que no
 * pueden deducirse: hay que escribirlas.
 */
export default function FormularioCierre({ periodo, cierre }) {
  const router = useRouter();
  const [enviando, empezar] = useTransition();
  const [estado, setEstado] = useState(null);

  function enviar(evento) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEstado(null);
    empezar(async () => {
      const r = await guardarCierre(datos);
      setEstado(r?.error ? { error: r.error } : { ok: 'Guardado.' });
      if (!r?.error) router.refresh();
    });
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <input type="hidden" name="periodo" value={periodo} />

      {estado?.error && <p className="alerta alerta--error campo--ancho">{estado.error}</p>}

      <label className="campo">
        <span>Seguridad social</span>
        <input type="text" inputMode="decimal" name="seg_soc"
          defaultValue={cierre?.seg_soc ?? ''} />
      </label>

      <label className="campo">
        <span>Gestoría</span>
        <input type="text" inputMode="decimal" name="gestoria"
          defaultValue={cierre?.gestoria ?? ''} />
      </label>

      <label className="campo">
        <span>IVA / IRPF</span>
        <input type="text" inputMode="decimal" name="iva_irpf"
          defaultValue={cierre?.iva_irpf ?? ''} />
      </label>

      <label className="campo campo--ancho">
        <span>Notas del mes</span>
        <textarea name="notas" defaultValue={cierre?.notas ?? ''} />
      </label>

      <div className="formulario__acciones">
        <button type="submit" className="boton boton--principal" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar cargas'}
        </button>
        {estado?.ok && <span className="tenue">{estado.ok}</span>}
      </div>
    </form>
  );
}
