import {
  WebhookRequest,
  WebhookResponse,
  HandlerFunction,
  HandlerModule,
  loadHandler,
  getDefaultHandler
} from './core';

export interface HandlerRegistry {
  [path: string]: {
    [method: string]: HandlerFunction;
  };
}

export class WebhookHandlerManager {
  private handlers: HandlerRegistry = {};
  private defaultHandler: HandlerFunction;

  constructor() {
    this.defaultHandler = getDefaultHandler();
  }

  registerHandler(path: string, method: string, handler: HandlerFunction): void {
    if (!this.handlers[path]) {
      this.handlers[path] = {};
    }
    this.handlers[path][method.toUpperCase()] = handler;
  }

  registerDefaultHandler(handler: HandlerFunction): void {
    this.defaultHandler = handler;
  }

  getHandler(path: string, method: string): HandlerFunction {
    const pathHandlers = this.handlers[path];
    if (pathHandlers) {
      const handler = pathHandlers[method.toUpperCase()];
      if (handler) {
        return handler;
      }
    }

    // Try wildcard paths
    for (const registeredPath of Object.keys(this.handlers)) {
      if (this.matchPath(registeredPath, path)) {
        const handler = this.handlers[registeredPath][method.toUpperCase()];
        if (handler) {
          return handler;
        }
      }
    }

    return this.defaultHandler;
  }

  private matchPath(pattern: string, path: string): boolean {
    // Simple wildcard matching
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(path);
    }
    return pattern === path;
  }

  async loadFromModule(handlerPath: string): Promise<void> {
    const module: HandlerModule = await loadHandler(handlerPath);

    // Register default handler if provided
    if (module.default) {
      this.registerDefaultHandler(module.default);
    } else if (module.handler) {
      this.registerDefaultHandler(module.handler);
    }

    // Register routes if provided
    if (module.routes && Array.isArray(module.routes)) {
      for (const route of module.routes) {
        const handlerFn = module[route.handler];
        if (typeof handlerFn === 'function') {
          this.registerHandler(route.path, route.method, handlerFn);
        }
      }
    }

    // Register any exported functions as handlers
    for (const [name, value] of Object.entries(module)) {
      if (typeof value === 'function' && name !== 'default' && name !== 'handler') {
        // Check if it's a named route handler (e.g., GET_users, POST_data)
        const match = name.match(/^(GET|POST|PUT|DELETE|PATCH)_(.+)$/);
        if (match) {
          const [, method, pathName] = match;
          const routePath = '/' + pathName.replace(/_/g, '/');
          this.registerHandler(routePath, method, value as HandlerFunction);
        }
      }
    }
  }

  listHandlers(): { path: string; methods: string[] }[] {
    return Object.entries(this.handlers).map(([path, methods]) => ({
      path,
      methods: Object.keys(methods)
    }));
  }
}

export function createHandler(
  fn: (request: WebhookRequest) => Promise<any> | any
): HandlerFunction {
  return async (request: WebhookRequest): Promise<WebhookResponse> => {
    try {
      const result = await fn(request);

      // If result is already a WebhookResponse, return it
      if (result && typeof result === 'object' && 'status' in result && 'body' in result) {
        return result as WebhookResponse;
      }

      // Otherwise wrap in response
      return {
        status: 200,
        body: result
      };
    } catch (error) {
      return {
        status: 500,
        body: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  };
}

export function jsonResponse(data: any, status: number = 200): WebhookResponse {
  return {
    status,
    body: data,
    headers: {
      'Content-Type': 'application/json'
    }
  };
}

export function errorResponse(message: string, status: number = 400): WebhookResponse {
  return {
    status,
    body: {
      error: message
    }
  };
}

export function successResponse(data?: any): WebhookResponse {
  return {
    status: 200,
    body: data || { success: true }
  };
}

// Built-in handlers for common use cases
export const builtInHandlers = {
  echo: createHandler((request: WebhookRequest) => {
    return {
      method: request.method,
      path: request.path,
      headers: request.headers,
      body: request.body,
      query: request.query,
      timestamp: request.timestamp.toISOString()
    };
  }),

  health: createHandler(() => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }),

  ping: createHandler(() => {
    return { pong: true };
  })
};
