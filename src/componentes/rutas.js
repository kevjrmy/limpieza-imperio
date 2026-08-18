'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Deja en la URL el id de lo que se acaba de crear, sin tocar los filtros que
 * ya hubiera puestos. La pantalla lo lee de `searchParams`, confirma el alta y
 * lleva la vista hasta esa fila (ver `AvisoNuevo`).
 *
 * Va por la URL y no por estado de React a propósito: así sobrevive al refresco
 * y la fila sigue marcada aunque recargue la página.
 */
export function useLlevarANuevo() {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();

  return (id) => {
    router.refresh();
    if (!id) return;

    const q = new URLSearchParams(parametros);
    q.set('nuevo', String(id));
    router.replace(`${ruta}?${q}`);
  };
}
