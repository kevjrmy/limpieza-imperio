'use client';

import { useState, useTransition } from 'react';

import { entrar } from '../lib/acceso.js';
import { intentar } from './intentar.js';

/**
 * La pantalla de entrada.
 *
 * Aquí vivía la salida de emergencia contra el bucle de redirecciones —el
 * navegador creía tener sesión, el servidor no la veía, y se mandaban el uno al
 * otro sin parar—. Ya no hace falta y por eso no está: aquel bucle existía
 * porque la sesión de Clerk vivía en `accounts.dev`, o sea en un dominio de
 * terceros, y el traspaso al servidor dependía de cookies entre sitios que
 * Safari en el móvil corta. Ahora la cookie es de este mismo dominio y sólo hay
 * una fuente de verdad: si el servidor no reconoce la sesión es que no la hay,
 * y esta pantalla la pide. No hay dos partes que puedan discrepar.
 *
 * Si algún día vuelve a aparecer un bucle entre `/entrar` y el panel, no lo
 * tapes aquí: significa que hay dos sitios decidiendo lo mismo, y el error está
 * en el segundo.
 */
export default function Entrada({ volver = '' }) {
  const [enviando, empezar] = useTransition();
  const [error, setError] = useState(null);
  const [visible, setVisible] = useState(false);

  function enviar(evento) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);
    empezar(async () => {
      // Si acierta no hay nada que hacer aquí: la acción redirige al panel.
      const r = await intentar(() => entrar(datos), 'entrar');
      if (r?.error) setError(r.error);
    });
  }

  return (
    <main className="entrar">
      <form className="entrar__caja" onSubmit={enviar}>
        <p className="entrar__marca">Limpiezas El Imperio</p>

        <h1 className="entrar__titulo">Entrar</h1>
        <p className="entrar__sub">Contabilidad de la empresa</p>

        {error && <p className="alerta alerta--error" role="alert">{error}</p>}

        <label className="campo">
          <span>Usuario</span>
          <input
            type="text"
            name="usuario"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
          />
        </label>

        <div className="campo">
          <span><label htmlFor="clave">Contraseña</label></span>
          <div className="entrar__clave">
            <input
              id="clave"
              type={visible ? 'text' : 'password'}
              name="clave"
              autoComplete="current-password"
              required
            />
            {/* Poder verla importa más de lo que parece: son veinticuatro
                caracteres aleatorios y se teclean en un móvil. */}
            <button
              type="button"
              className="entrar__ver"
              onClick={() => setVisible((v) => !v)}
              aria-pressed={visible}
              aria-controls="clave"
            >
              {visible ? 'ocultar' : 'ver'}
            </button>
          </div>
        </div>

        <input type="hidden" name="volver" value={volver} />

        <button type="submit" className="boton boton--principal entrar__enviar" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
