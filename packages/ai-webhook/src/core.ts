import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface WebhookConfig {
  port: number;
  handlerPath?: string;
  authToken?: string;
  logFile?: string;
  routes?: RouteConfig[];
}

export interface RouteConfig {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: string;
  auth?: boolean;
}

export interface WebhookRequest {
  id: string;
  timestamp: Date;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: any;
  query: Record<string, string>;
}

export interface WebhookResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  requestBody?: any;
  responseBody?: any;
  error?: string;
}

export interface HandlerModule {
  default?: HandlerFunction;
  handler?: HandlerFunction;
  routes?: RouteConfig[];
  [key: string]: any;
}

export type HandlerFunction = (request: WebhookRequest) => Promise<WebhookResponse> | WebhookResponse;

const CONFIG_FILE = '.ai-webhook.json';
const LOG_FILE = '.ai-webhook-logs.json';

export function getConfigPath(): string {
  return path.join(process.cwd(), CONFIG_FILE);
}

export function getLogPath(): string {
  return path.join(process.cwd(), LOG_FILE);
}

export function loadConfig(): WebhookConfig | null {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  return null;
}

export function saveConfig(config: WebhookConfig): void {
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function loadLogs(): LogEntry[] {
  const logPath = getLogPath();
  if (fs.existsSync(logPath)) {
    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return [];
    }
  }
  return [];
}

export function saveLogs(logs: LogEntry[]): void {
  const logPath = getLogPath();
  fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
}

export function addLogEntry(entry: LogEntry): void {
  const logs = loadLogs();
  logs.push(entry);
  // Keep only last 1000 entries
  if (logs.length > 1000) {
    logs.splice(0, logs.length - 1000);
  }
  saveLogs(logs);
}

export function createLogEntry(
  request: WebhookRequest,
  response: WebhookResponse,
  duration: number,
  error?: string
): LogEntry {
  return {
    id: request.id,
    timestamp: request.timestamp.toISOString(),
    method: request.method,
    path: request.path,
    status: response.status,
    duration,
    requestBody: request.body,
    responseBody: response.body,
    error
  };
}

export async function loadHandler(handlerPath: string): Promise<HandlerModule> {
  const absolutePath = path.resolve(process.cwd(), handlerPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Handler file not found: ${absolutePath}`);
  }

  // For TypeScript files, we need to compile or use ts-node
  if (absolutePath.endsWith('.ts')) {
    try {
      require('ts-node/register');
    } catch {
      // ts-node not available, try direct require
    }
  }

  const module = require(absolutePath);
  return module;
}

export function createWebhookRequest(
  method: string,
  urlPath: string,
  headers: Record<string, string>,
  body: any,
  query: Record<string, string>
): WebhookRequest {
  return {
    id: uuidv4(),
    timestamp: new Date(),
    method,
    path: urlPath,
    headers,
    body,
    query
  };
}

export function validateAuthToken(
  request: WebhookRequest,
  expectedToken: string
): boolean {
  const authHeader = request.headers['authorization'] || request.headers['Authorization'];
  if (!authHeader) {
    return false;
  }

  // Support "Bearer <token>" format
  const token = authHeader.replace(/^Bearer\s+/i, '');
  return token === expectedToken;
}

export async function testWebhook(
  url: string,
  method: string = 'POST',
  body?: any,
  headers?: Record<string, string>
): Promise<{ status: number; body: any; duration: number }> {
  const startTime = Date.now();

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const duration = Date.now() - startTime;

  let responseBody;
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }

  return {
    status: response.status,
    body: responseBody,
    duration
  };
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export function getDefaultHandler(): HandlerFunction {
  return async (request: WebhookRequest): Promise<WebhookResponse> => {
    return {
      status: 200,
      body: {
        message: 'Webhook received',
        id: request.id,
        timestamp: request.timestamp.toISOString(),
        method: request.method,
        path: request.path
      }
    };
  };
}
