/**
 * Genera las credenciales de acceso, listas para pegar en Vercel.
 *
 *   node scripts/clave.mjs                    → contraseña nueva al azar
 *   node scripts/clave.mjs "la que yo quiera" → hash de ésa
 *
 * **Este script no abre la base de datos.** No importa `db.js` ni lo va a
 * importar: la autenticación no guarda nada en la base del cliente, así que
 * generar credenciales no puede, ni por accidente, tocar su contabilidad. Es
 * justo lo contrario que `esquema.mjs` y `sembrar.mjs`, que sí escriben y por
 * eso llevan los avisos que llevan en CLAUDE.md.
 *
 * Tampoco lee `.env.local`, por lo mismo: no necesita saber a qué base apunta
 * nada, porque no va a hablar con ninguna.
 */

import { claveAleatoria, hashDeClave, secretoAleatorio } from '../src/lib/clave.js';

const USUARIO = 'info@limpiezaselimperio.net';

const dada = process.argv[2];
const clave = dada || claveAleatoria();
const hash = await hashDeClave(clave);
const secreto = secretoAleatorio();

const raya = '─'.repeat(72);

console.log(`\n${raya}`);
console.log('  LA CONTRASEÑA — apúntala ahora, no se puede recuperar después');
console.log(raya);
console.log(`\n    ${clave}\n`);
console.log('  Sólo existe aquí y en su cabeza. Lo que se guarda en Vercel es el');
console.log('  hash de abajo, y de un hash no se saca la contraseña de vuelta: si');
console.log('  se pierde, no hay recuperación, hay que generar otra y cambiarla.');

console.log(`\n${raya}`);
console.log('  LAS TRES VARIABLES — en Vercel, entorno de producción');
console.log(raya);
console.log('');
console.log(`USUARIO=${USUARIO}`);
console.log(`CLAVE_HASH=${hash}`);
console.log(`SESION_SECRETO=${secreto}`);

console.log('\n  Pégalas SIN comillas. Un `.env` las guarda entrecomilladas y si esas');
console.log('  comillas llegan al panel de Vercel se quedan dentro del valor, dejan');
console.log('  de coincidir con nada y no entra nadie —tampoco tú—. Ya pasó una vez');
console.log('  con CORREOS_AUTORIZADOS y el síntoma era un 500 sin explicación.');
console.log('');
console.log('  Cambiar SESION_SECRETO cierra en el acto todas las sesiones abiertas.');
console.log('  Es el botón de emergencia si él pierde el móvil.');
console.log(`\n${raya}\n`);
