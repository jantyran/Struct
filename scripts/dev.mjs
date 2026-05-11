import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = process.env.DEV_HOST ?? '0.0.0.0';
const START_PORT = Number.parseInt(process.env.DEV_PORT ?? process.env.PORT ?? '3002', 10);
const MAX_PORT = Number.parseInt(process.env.DEV_MAX_PORT ?? '3099', 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEXT_CLI = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');

if (!Number.isInteger(START_PORT) || START_PORT < 1 || START_PORT > 65535) {
  console.error(`Invalid start port: ${process.env.DEV_PORT ?? process.env.PORT}`);
  process.exit(1);
}

if (!Number.isInteger(MAX_PORT) || MAX_PORT < START_PORT || MAX_PORT > 65535) {
  console.error(`Invalid max port: ${process.env.DEV_MAX_PORT ?? MAX_PORT}`);
  process.exit(1);
}

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, HOST);
  });
}

async function findAvailablePort() {
  for (let port = START_PORT; port <= MAX_PORT; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available port found from ${START_PORT} to ${MAX_PORT}.`);
}

const port = await findAvailablePort();
console.log(`Starting Next.js dev server on http://localhost:${port}`);

const nextDev = spawn(
  process.execPath,
  [NEXT_CLI, 'dev', '-p', String(port), '-H', HOST, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  },
);

nextDev.on('error', (error) => {
  console.error(`Failed to start Next.js dev server: ${error.message}`);
  process.exit(1);
});

nextDev.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
