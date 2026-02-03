import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import {
  WebhookConfig,
  WebhookRequest,
  createWebhookRequest,
  validateAuthToken,
  addLogEntry,
  createLogEntry,
  formatDuration
} from './core';
import { WebhookHandlerManager, builtInHandlers } from './handlers';

export interface ServerOptions {
  port: number;
  handlerPath?: string;
  authToken?: string;
  verbose?: boolean;
  enableBuiltIn?: boolean;
}

export class WebhookServer {
  private app: express.Application;
  private server: any;
  private handlerManager: WebhookHandlerManager;
  private options: ServerOptions;

  constructor(options: ServerOptions) {
    this.options = options;
    this.app = express();
    this.handlerManager = new WebhookHandlerManager();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Parse JSON bodies
    this.app.use(bodyParser.json({ limit: '10mb' }));

    // Parse URL-encoded bodies
    this.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

    // Parse raw bodies
    this.app.use(bodyParser.raw({ type: '*/*', limit: '10mb' }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Store original end function
      const originalEnd = res.end;
      let responseBody: any;

      // Override end to capture response body
      res.end = function(chunk?: any, ...args: any[]): Response {
        if (chunk) {
          try {
            responseBody = JSON.parse(chunk.toString());
          } catch {
            responseBody = chunk.toString();
          }
        }
        return originalEnd.apply(res, [chunk, ...args] as any);
      };

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        if (this.options.verbose) {
          console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${formatDuration(duration)})`
          );
        }
      });

      next();
    });
  }

  private setupRoutes(): void {
    // Built-in routes
    if (this.options.enableBuiltIn !== false) {
      this.app.get('/health', async (req, res) => {
        const webhookRequest = this.createRequest(req);
        const response = await builtInHandlers.health(webhookRequest);
        res.status(response.status).json(response.body);
      });

      this.app.get('/ping', async (req, res) => {
        const webhookRequest = this.createRequest(req);
        const response = await builtInHandlers.ping(webhookRequest);
        res.status(response.status).json(response.body);
      });

      this.app.all('/echo', async (req, res) => {
        const webhookRequest = this.createRequest(req);
        const response = await builtInHandlers.echo(webhookRequest);
        res.status(response.status).json(response.body);
      });
    }

    // Catch-all route for webhook handling
    this.app.all('*', async (req: Request, res: Response) => {
      const startTime = Date.now();
      const webhookRequest = this.createRequest(req);

      try {
        // Check authentication if required
        if (this.options.authToken) {
          if (!validateAuthToken(webhookRequest, this.options.authToken)) {
            const response = { status: 401, body: { error: 'Unauthorized' } };
            const duration = Date.now() - startTime;
            addLogEntry(createLogEntry(webhookRequest, response, duration, 'Unauthorized'));
            res.status(401).json({ error: 'Unauthorized' });
            return;
          }
        }

        // Get handler for this request
        const handler = this.handlerManager.getHandler(req.path, req.method);
        const response = await handler(webhookRequest);

        // Log the request
        const duration = Date.now() - startTime;
        addLogEntry(createLogEntry(webhookRequest, response, duration));

        // Set custom headers if provided
        if (response.headers) {
          for (const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value);
          }
        }

        res.status(response.status).json(response.body);
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const response = { status: 500, body: { error: errorMessage } };
        addLogEntry(createLogEntry(webhookRequest, response, duration, errorMessage));

        if (this.options.verbose) {
          console.error(`[ERROR] ${errorMessage}`);
        }

        res.status(500).json({ error: errorMessage });
      }
    });
  }

  private createRequest(req: Request): WebhookRequest {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value.join(', ');
      }
    }

    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        query[key] = value;
      }
    }

    return createWebhookRequest(
      req.method,
      req.path,
      headers,
      req.body,
      query
    );
  }

  async loadHandler(handlerPath: string): Promise<void> {
    await this.handlerManager.loadFromModule(handlerPath);
    if (this.options.verbose) {
      console.log(`Loaded handler from: ${handlerPath}`);
      const handlers = this.handlerManager.listHandlers();
      if (handlers.length > 0) {
        console.log('Registered routes:');
        handlers.forEach(h => {
          console.log(`  ${h.methods.join(', ')} ${h.path}`);
        });
      }
    }
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.options.port, () => {
        if (this.options.verbose) {
          console.log(`Webhook server started on port ${this.options.port}`);
          console.log(`Health check: http://localhost:${this.options.port}/health`);
        }
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error | undefined) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getApp(): express.Application {
    return this.app;
  }
}

export async function startServer(options: ServerOptions): Promise<WebhookServer> {
  const server = new WebhookServer(options);

  if (options.handlerPath) {
    await server.loadHandler(options.handlerPath);
  }

  await server.start();
  return server;
}
