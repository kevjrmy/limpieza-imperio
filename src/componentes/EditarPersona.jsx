'use client';

import { useState } from 'react';

import FichaPersona from './FichaPersona.jsx';

/**
 * Botón que despliega la edición de un cliente o colaborador ya existente.
 * `compacto` es para dentro de una celda de tabla, donde la barra de sección
 * sobra y el botón tiene que ir solo.
 */
export default function EditarPersona({ tipo, persona, compacto = false }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    const boton = (
      <button type="button" className={compacto ? 'boton boton--plano' : 'boton'}
        onClick={() => setAbierto(true)}>
        Editar{compacto ? '' : ' datos'}
      </button>
    );
    if (compacto) return boton;
    return <div className="barra-seccion"><span />{boton}</div>;
  }

  return <FichaPersona tipo={tipo} persona={persona} alTerminar={() => setAbierto(false)} />;
}
