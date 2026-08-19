'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { salir } from '../lib/acceso.js';
import { intentar } from './intentar.js';

/**
 * El botón de la cuenta, arriba a la derecha. Ocupa el sitio del `UserButton`
 * de Clerk y hace lo mismo que él hacía aquí: enseñar quién ha entrado y dejar
 * salir.
 *
 * De aquel desplegable no falta nada porque no hay nada más que ofrecer — no se
 * cambia la contraseña, no hay perfil y no hay otras cuentas—. Que el menú sea
 * corto no es una carencia: es que el sistema entero cabe en dos verbos.
 *
 * Sin esto sería imposible salir: el único camino para cerrar sesión es este
 * menú, así que tiene que estar en todas las páginas y no esconderse en
 * ninguna.
 */
export default function BotonUsuario({ usuario }) {
  const [abierto, setAbierto] = useState(false);
  const [saliendo, empezar] = useTransition();
  const [error, setError] = useState(null);

  const caja = useRef(null);
  const disparador = useRef(null);

  // Cerrar al pulsar fuera o con Escape. Un menú que sólo se cierra volviendo a
  // pulsar el botón se queda abierto tapando la tabla.
  useEffect(() => {
    if (!abierto) return undefined;

    const fuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      disparador.current?.focus();
    };

    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  function cerrarSesion() {
    setError(null);
    empezar(async () => {
      const r = await intentar(() => salir(), 'salir');
      if (r?.error) setError(r.error);
    });
  }

  const inicial = (usuario || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="usuario" ref={caja}>
      <button
        type="button"
        ref={disparador}
        className="usuario__avatar"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
      >
        <span aria-hidden="true">{inicial}</span>
        <span className="visualmente-oculto">Cuenta de {usuario}</span>
      </button>

      {abierto && (
        <div className="usuario__menu" role="menu">
          <p className="usuario__quien">
            <span className="usuario__avatar usuario__avatar--fijo" aria-hidden="true">
              {inicial}
            </span>
            <span className="usuario__correo">{usuario}</span>
          </p>

          {error && <p className="usuario__error" role="alert">{error}</p>}

          <button
            type="button"
            role="menuitem"
            className="usuario__salir"
            onClick={cerrarSesion}
            disabled={saliendo}
          >
            {saliendo ? 'Saliendo…' : 'Salir'}
          </button>
        </div>
      )}
    </div>
  );
}
