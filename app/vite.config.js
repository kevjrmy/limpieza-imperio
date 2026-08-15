import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * SQLite en el navegador guarda en OPFS (el sistema de archivos privado del
 * origen). Ese backend usa `Atomics.wait` sobre memoria compartida, y el
 * navegador sólo lo permite si la página está aislada entre orígenes. Eso exige
 * estas dos cabeceras. Sin ellas la aplicación sigue funcionando, pero en
 * memoria: al recargar se pierde la importación, y la interfaz lo dice.
 */
const cabecerasAislamiento = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  server: { headers: cabecerasAislamiento },
  preview: { headers: cabecerasAislamiento },
  // sqlite-wasm trae su propio .wasm y su worker: si Vite lo pre-empaqueta,
  // rompe la resolución del binario.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
