// Starts the Vite dev server for capture scripts and returns its URL.
import { createServer } from 'vite';
export async function startDev(port = 5199) {
  const server = await createServer({ server: { port, host: '127.0.0.1', strictPort: true }, logLevel: 'error' });
  await server.listen();
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}
