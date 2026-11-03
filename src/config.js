function readPort(environment) {
  if (environment.PORT === undefined || environment.PORT === '') return 3000;
  const port = Number(environment.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

export function getConfig(environment = process.env) {
  return { port: readPort(environment) };
}

export const config = getConfig();
