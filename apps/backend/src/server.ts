import { buildApp } from './app.js';
import { loadServerConfig } from './config.js';

const config = loadServerConfig();
const app = await buildApp(config);

async function start(): Promise<void> {
  try {
    await app.listen({ host: config.BACKEND_HOST, port: config.BACKEND_PORT });
  } catch (error) {
    app.log.error(error, 'Unable to start backend');
    process.exitCode = 1;
  }
}

void start();
