'use client';

import { useEffect } from 'react';

/**
 * Confirma que algo se acaba de dar de alta, y lleva la pantalla hasta ello.
 *
 * Hace falta porque las tablas están ordenadas por dinero, no por antigüedad, y
 * eso esconde lo recién creado justo donde él está mirando: un cliente nuevo no
 * tiene margen, así que cae detrás de los ciento y pico que sí lo tienen; un
 * colaborador nuevo no ha cobrado nada y queda el último; y un servicio que
 * apunta hoy se va detrás de los que ya tienen fecha posterior en el mismo mes.
 * Se guardaba bien y no se veía, que desde su lado es lo mismo que no funcionar.
 *
 * Así que la fila se marca (`data-fila`) y aquí se la trae a la vista. El aviso
 * va en gris a propósito: el color de esta aplicación es sólo para el margen y
 * para lo que hay que revisar, y un «guardado» no es ninguna de las dos cosas.
 */
export default function AvisoNuevo({ id, children }) {
  useEffect(() => {
    if (!id) return;
    const fila = document.querySelector(`[data-fila="${id}"]`);
    if (!fila) return;

    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    fila.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
  }, [id]);

  return <p className="alerta alerta--hecho">{children}</p>;
}
