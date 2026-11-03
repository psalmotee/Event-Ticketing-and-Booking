function compilePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new TypeError('Route path must start with /');
  }

  const segments = path.split('/').filter(Boolean);
  return {
    segments,
    parameterNames: segments
      .filter((segment) => segment.startsWith(':'))
      .map((segment) => segment.slice(1)),
    pattern: new RegExp(`^/${segments.map((segment) => (
      segment.startsWith(':') ? '([^/]+)' : escapeRegExp(segment)
    )).join('/')}/?$`),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class Router {
  #routes = [];

  add(method, path, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Route handler must be a function');
    }
    const compiled = compilePath(path);
    this.#routes.push({
      method: method.toUpperCase(),
      ...compiled,
      handler,
    });
    return this;
  }

  get(path, handler) {
    return this.add('GET', path, handler);
  }

  match(method, path) {
    const requestPath = new URL(path, 'http://localhost').pathname;
    const route = this.#routes.find((candidate) => candidate.method === method.toUpperCase()
      && candidate.pattern.test(requestPath));
    if (!route) return undefined;

    const match = route.pattern.exec(requestPath);
    const params = {};
    route.parameterNames.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1]);
    });
    return { handler: route.handler, params };
  }
}

export function createRouter() {
  return new Router();
}
