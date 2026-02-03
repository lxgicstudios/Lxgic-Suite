import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  PromptDefinition,
  validateInput,
  renderTemplate
} from './core';
import { generateAPI, GeneratorOptions } from './generator';

export interface ServerOptions {
  port: number;
  promptsDir?: string;
  outputDir?: string;
  verbose?: boolean;
  title?: string;
  version?: string;
}

export class PromptAPIServer {
  private app: express.Application;
  private server: any;
  private options: ServerOptions;
  private prompts: Map<string, PromptDefinition> = new Map();
  private openAPISpec: any;

  constructor(options: ServerOptions) {
    this.options = options;
    this.app = express();
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // Request logging
    if (this.options.verbose) {
      this.app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
      });
    }
  }

  async loadFromDirectory(promptsDir: string): Promise<void> {
    const generatorOptions: GeneratorOptions = {
      title: this.options.title,
      version: this.options.version
    };

    const api = await generateAPI(promptsDir, generatorOptions);
    this.openAPISpec = api.openapi;

    // Register prompts
    for (const prompt of api.prompts) {
      this.prompts.set(prompt.name, prompt);
    }

    // Setup routes
    this.setupBuiltInRoutes();
    this.setupPromptRoutes(api.endpoints);

    if (this.options.verbose) {
      console.log(`Loaded ${api.prompts.length} prompts`);
    }
  }

  async loadFromOutput(outputDir: string): Promise<void> {
    const promptsDir = path.join(outputDir, 'prompts');
    const openapiPath = path.join(outputDir, 'openapi.json');

    if (!fs.existsSync(promptsDir)) {
      throw new Error(`Prompts directory not found: ${promptsDir}`);
    }

    // Load prompts
    const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(promptsDir, file), 'utf-8');
      const prompt = JSON.parse(content) as PromptDefinition;
      this.prompts.set(prompt.name, prompt);
    }

    // Load OpenAPI spec
    if (fs.existsSync(openapiPath)) {
      this.openAPISpec = JSON.parse(fs.readFileSync(openapiPath, 'utf-8'));
    }

    // Setup routes
    this.setupBuiltInRoutes();
    this.setupPromptRoutesFromPrompts();

    if (this.options.verbose) {
      console.log(`Loaded ${this.prompts.size} prompts from ${outputDir}`);
    }
  }

  private setupBuiltInRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        prompts: this.prompts.size,
        timestamp: new Date().toISOString()
      });
    });

    // OpenAPI spec
    this.app.get('/openapi.json', (req, res) => {
      res.json(this.openAPISpec);
    });

    // API documentation
    this.app.get('/docs', (req, res) => {
      res.send(this.generateDocsHTML());
    });

    // List prompts
    this.app.get('/prompts', (req, res) => {
      const prompts = Array.from(this.prompts.values()).map(p => ({
        name: p.name,
        description: p.description,
        endpoint: p.endpoint,
        method: p.method
      }));
      res.json(prompts);
    });

    // Get specific prompt
    this.app.get('/prompts/:name', (req, res) => {
      const prompt = this.prompts.get(req.params.name);
      if (!prompt) {
        res.status(404).json({ error: 'Prompt not found' });
        return;
      }
      res.json(prompt);
    });
  }

  private setupPromptRoutes(endpoints: any[]): void {
    for (const endpoint of endpoints) {
      const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
      this.app[method](endpoint.path, (req: Request, res: Response) => {
        this.handlePromptRequest(endpoint.promptName, req, res);
      });
    }
  }

  private setupPromptRoutesFromPrompts(): void {
    for (const [name, prompt] of this.prompts) {
      const path = prompt.endpoint || `/${name.toLowerCase().replace(/\s+/g, '-')}`;
      const method = (prompt.method || 'POST').toLowerCase() as 'get' | 'post' | 'put' | 'delete';

      this.app[method](path, (req: Request, res: Response) => {
        this.handlePromptRequest(name, req, res);
      });
    }
  }

  private handlePromptRequest(promptName: string, req: Request, res: Response): void {
    try {
      const prompt = this.prompts.get(promptName);
      if (!prompt) {
        res.status(404).json({ error: 'Prompt not found' });
        return;
      }

      const input = req.method === 'GET' ? req.query : req.body;

      // Validate input
      const validation = validateInput(input, prompt.input);
      if (!validation.valid) {
        res.status(400).json({
          error: 'Validation failed',
          details: validation.errors
        });
        return;
      }

      // Render template
      const rendered = renderTemplate(prompt.template, input as Record<string, any>);

      res.json({
        prompt: promptName,
        rendered,
        input,
        model: prompt.model,
        parameters: prompt.parameters
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Internal error'
      });
    }
  }

  private generateDocsHTML(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.options.port, () => {
        if (this.options.verbose) {
          console.log(`API server running on http://localhost:${this.options.port}`);
          console.log(`Documentation: http://localhost:${this.options.port}/docs`);
        }
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: Error | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getApp(): express.Application {
    return this.app;
  }

  getPrompts(): PromptDefinition[] {
    return Array.from(this.prompts.values());
  }
}

export async function startServer(options: ServerOptions): Promise<PromptAPIServer> {
  const server = new PromptAPIServer(options);

  if (options.outputDir && fs.existsSync(path.join(options.outputDir, 'prompts'))) {
    await server.loadFromOutput(options.outputDir);
  } else if (options.promptsDir) {
    await server.loadFromDirectory(options.promptsDir);
  }

  await server.start();
  return server;
}
