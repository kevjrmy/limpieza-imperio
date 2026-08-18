/**
 * Llama a una acción de servidor sin que un fallo se quede mudo.
 *
 * Las acciones devuelven `{ error }` cuando algo no cuadra, y eso ya se enseña.
 * Lo que no se veía es cuando la llamada NI SIQUIERA LLEGA a ejecutarse: ahí la
 * promesa revienta en vez de devolver nada, y como la llamada vive dentro de un
 * `useTransition` sin `catch`, el error se lo tragaba la transición. El
 * formulario se quedaba igual que antes de pulsar, sin mensaje: guardar y no
 * guardar se parecían demasiado. Es lo que él reportó como «lo ingreso y no
 * queda dado de alta».
 *
 * No es rebuscado, y pasa justo el día que se despliega: cada despliegue cambia
 * el identificador de las acciones de servidor, así que una pestaña abierta
 * desde antes manda el de un build que ya no existe y el servidor la rechaza.
 * Lo mismo si se corta la cobertura a media pulsación, que con el móvil en casa
 * de un cliente es lo normal.
 *
 * Por eso el mensaje dice recargar: es lo único que arregla los dos casos.
 */
export async function intentar(fn, verbo = 'guardar') {
  try {
    return await fn();
  } catch (e) {
    // Next señaliza redirecciones y 404 lanzando un error con `digest`. La
    // redirección al login de `exigirSesion()` tiene que seguir su camino, no
    // convertirse en un mensaje rojo que deja a la persona donde estaba.
    if (typeof e?.digest === 'string'
      && (e.digest.startsWith('NEXT_REDIRECT') || e.digest === 'NEXT_NOT_FOUND')) throw e;

    console.error(e);
    return {
      error: `No se ha podido ${verbo}: la petición no ha llegado al servidor. `
        + 'Recarga la página e inténtalo otra vez —si la aplicación se acaba de '
        + 'actualizar, con eso se arregla.',
    };
  }
}
