import process from 'node:process';

if (process.env.SAFEWORD_RETRO_RELAY_RUN === '1') {
  throw new Error('configure and start the relay through the deployment composition root');
}

export { startRelayServer } from './http-server.js';
