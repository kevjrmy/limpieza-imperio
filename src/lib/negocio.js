/**
 * Los datos del negocio que salen impresos en la cabecera de sus documentos.
 *
 * Salen de su web nueva (proyecto `limpiezaselimperio`, `src/datos/negocio.ts`),
 * no de sus hojas de Excel: allí el correo estaba escrito de dos formas y las
 * dos apuntaban al `.net`, que es el dominio viejo. Si cambia algo en la web,
 * se cambia también aquí.
 *
 * El logo es `public/logo.jpg`, el mismo de la web reducido a 480 px.
 *
 * Módulo puro: lo importan componentes de cliente.
 */
export const negocio = {
  nombre: 'Limpiezas El Imperio',
  titular: 'Frank Elías Cuero Palacios',
  telefono: '617 545 397',
  correo: 'info@limpiezaselimperio.es',
  web: 'www.limpiezaselimperio.es',
  lema: 'Somos tu mejor opción',
  despedida: 'Para nosotros el servicio al cliente es nuestra mejor carta de presentación. '
    + 'Esperamos poder servirte nuevamente.',
};
