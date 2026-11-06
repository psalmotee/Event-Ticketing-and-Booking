import { createServer } from 'node:http';
import { createApp } from './http/app.js';
import { config } from './config.js';

export function startServer({
  port = config.port,
  repository,
  paymentGateway,
} = {}) {
  const server = createServer(createApp({ repository, paymentGateway }));
  server.listen(port, () => {
    console.log(`Event Ticketing server listening on port ${port}`);
  });
  return server;
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  startServer();
}
