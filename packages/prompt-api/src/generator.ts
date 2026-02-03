import * as fs from 'fs';
import * as path from 'path';
import {
  PromptDefinition,
  OpenAPISpec,
  APIEndpoint,
  GeneratedAPI,
  scanPromptFiles,
  parsePromptFile,
  validateInput,
  renderTemplate,
  generateEndpointPath,
  SchemaProperty
} from './core';

export interface GeneratorOptions {
  title?: string;
  version?: string;
  description?: string;
  baseUrl?: string;
}

export async function generateAPI(
  promptsDir: string,
  options: GeneratorOptions = {}
): Promise<GeneratedAPI> {
  const files = await scanPromptFiles(promptsDir);

  if (files.length === 0) {
    throw new Error(`No prompt files found in: ${promptsDir}`);
  }

  const prompts: PromptDefinition[] = [];
  const endpoints: APIEndpoint[] = [];

  for (const file of files) {
    try {
      const prompt = parsePromptFile(file);
      prompts.push(prompt);

      const endpoint = createEndpoint(prompt);
      endpoints.push(endpoint);
    } catch (error) {
      console.warn(`Warning: Failed to parse ${file}: ${error}`);
    }
  }

  const openapi = generateOpenAPISpec(endpoints, options);

  return { endpoints, openapi, prompts };
}

function createEndpoint(prompt: PromptDefinition): APIEndpoint {
  const path = generateEndpointPath(prompt);
  const method = prompt.method || 'POST';

  const handler = async (input: any): Promise<any> => {
    // Validate input
    const validation = validateInput(input, prompt.input);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Render the template
    const renderedPrompt = renderTemplate(prompt.template, input);

    // Return the result
    // In a real implementation, this would call an AI model
    return {
      prompt: prompt.name,
      rendered: renderedPrompt,
      input,
      model: prompt.model,
      parameters: prompt.parameters
    };
  };

  return {
    path,
    method,
    promptName: prompt.name,
    prompt,
    handler
  };
}

export function generateOpenAPISpec(
  endpoints: APIEndpoint[],
  options: GeneratorOptions = {}
): OpenAPISpec {
  const paths: Record<string, any> = {};
  const schemas: Record<string, any> = {};

  for (const endpoint of endpoints) {
    const pathItem: any = {};
    const method = endpoint.method.toLowerCase();

    const operation: any = {
      operationId: endpoint.promptName,
      summary: endpoint.prompt.description || `Execute ${endpoint.promptName} prompt`,
      tags: ['Prompts']
    };

    // Add request body for non-GET methods
    if (method !== 'get' && endpoint.prompt.input) {
      const schemaName = `${endpoint.promptName}Input`;
      schemas[schemaName] = convertToOpenAPISchema(endpoint.prompt.input);

      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${schemaName}` }
          }
        }
      };
    }

    // Add query parameters for GET methods
    if (method === 'get' && endpoint.prompt.input?.properties) {
      operation.parameters = Object.entries(endpoint.prompt.input.properties).map(
        ([name, prop]) => ({
          name,
          in: 'query',
          required: endpoint.prompt.input?.required?.includes(name) || false,
          schema: { type: prop.type },
          description: prop.description
        })
      );
    }

    // Add response
    if (endpoint.prompt.output) {
      const schemaName = `${endpoint.promptName}Output`;
      schemas[schemaName] = convertToOpenAPISchema(endpoint.prompt.output);

      operation.responses = {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${schemaName}` }
            }
          }
        },
        '400': {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' }
                }
              }
            }
          }
        }
      };
    } else {
      operation.responses = {
        '200': {
          description: 'Successful response'
        }
      };
    }

    pathItem[method] = operation;
    paths[endpoint.path] = pathItem;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: options.title || 'Prompt API',
      version: options.version || '1.0.0',
      description: options.description || 'Auto-generated API from prompt definitions'
    },
    paths,
    components: {
      schemas
    }
  };
}

function convertToOpenAPISchema(schema: any): any {
  const result: any = {
    type: schema.type
  };

  if (schema.description) {
    result.description = schema.description;
  }

  if (schema.properties) {
    result.properties = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
      result.properties[key] = convertPropertyToOpenAPI(prop as SchemaProperty);
    }
  }

  if (schema.required) {
    result.required = schema.required;
  }

  if (schema.items) {
    result.items = convertPropertyToOpenAPI(schema.items);
  }

  return result;
}

function convertPropertyToOpenAPI(prop: SchemaProperty): any {
  const result: any = {
    type: prop.type
  };

  if (prop.description) {
    result.description = prop.description;
  }

  if (prop.default !== undefined) {
    result.default = prop.default;
  }

  if (prop.enum) {
    result.enum = prop.enum;
  }

  if (prop.items) {
    result.items = convertPropertyToOpenAPI(prop.items);
  }

  if (prop.properties) {
    result.properties = {};
    for (const [key, p] of Object.entries(prop.properties)) {
      result.properties[key] = convertPropertyToOpenAPI(p);
    }
  }

  return result;
}

export async function writeGeneratedAPI(
  api: GeneratedAPI,
  outputDir: string
): Promise<void> {
  const absoluteDir = path.resolve(process.cwd(), outputDir);

  // Create output directory
  if (!fs.existsSync(absoluteDir)) {
    fs.mkdirSync(absoluteDir, { recursive: true });
  }

  // Write OpenAPI spec
  const openapiPath = path.join(absoluteDir, 'openapi.json');
  fs.writeFileSync(openapiPath, JSON.stringify(api.openapi, null, 2));

  // Write endpoints file
  const endpointsPath = path.join(absoluteDir, 'endpoints.json');
  const endpointsData = api.endpoints.map(e => ({
    path: e.path,
    method: e.method,
    promptName: e.promptName,
    description: e.prompt.description
  }));
  fs.writeFileSync(endpointsPath, JSON.stringify(endpointsData, null, 2));

  // Write server file
  const serverPath = path.join(absoluteDir, 'server.js');
  const serverCode = generateServerCode(api);
  fs.writeFileSync(serverPath, serverCode);

  // Write prompts
  const promptsDir = path.join(absoluteDir, 'prompts');
  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });
  }

  for (const prompt of api.prompts) {
    const promptPath = path.join(promptsDir, `${prompt.name}.json`);
    fs.writeFileSync(promptPath, JSON.stringify(prompt, null, 2));
  }
}

function generateServerCode(api: GeneratedAPI): string {
  const routes = api.endpoints.map(e => {
    return `
app.${e.method.toLowerCase()}('${e.path}', async (req, res) => {
  try {
    const input = req.method === 'GET' ? req.query : req.body;
    const prompt = prompts['${e.promptName}'];

    // Validate input
    if (prompt.input && prompt.input.required) {
      for (const field of prompt.input.required) {
        if (!(field in input)) {
          return res.status(400).json({ error: \`Missing required field: \${field}\` });
        }
      }
    }

    // Render template
    let rendered = prompt.template;
    for (const [key, value] of Object.entries(input)) {
      rendered = rendered.replace(new RegExp(\`\\\\{\\\\{\\\\s*\${key}\\\\s*\\\\}\\\\}\`, 'g'), String(value));
    }

    res.json({
      prompt: '${e.promptName}',
      rendered,
      input,
      model: prompt.model,
      parameters: prompt.parameters
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});`;
  }).join('\n');

  return `const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Load prompts
const promptsDir = path.join(__dirname, 'prompts');
const prompts = {};
for (const file of fs.readdirSync(promptsDir)) {
  if (file.endsWith('.json')) {
    const name = file.replace('.json', '');
    prompts[name] = JSON.parse(fs.readFileSync(path.join(promptsDir, file), 'utf-8'));
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', prompts: Object.keys(prompts).length });
});

// OpenAPI spec
app.get('/openapi.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'openapi.json'));
});

// API documentation
app.get('/docs', (req, res) => {
  res.send(\`<!DOCTYPE html>
<html>
<head>
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui'
    });
  </script>
</body>
</html>\`);
});

// Generated routes
${routes}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`API server running on http://localhost:\${PORT}\`);
  console.log(\`Documentation: http://localhost:\${PORT}/docs\`);
});
`;
}

export function generateDocs(api: GeneratedAPI): string {
  let docs = `# ${api.openapi.info.title}\n\n`;
  docs += `${api.openapi.info.description || ''}\n\n`;
  docs += `Version: ${api.openapi.info.version}\n\n`;
  docs += `## Endpoints\n\n`;

  for (const endpoint of api.endpoints) {
    docs += `### ${endpoint.method} ${endpoint.path}\n\n`;
    docs += `${endpoint.prompt.description || ''}\n\n`;

    if (endpoint.prompt.input?.properties) {
      docs += `**Parameters:**\n\n`;
      docs += `| Name | Type | Required | Description |\n`;
      docs += `|------|------|----------|-------------|\n`;

      for (const [name, prop] of Object.entries(endpoint.prompt.input.properties)) {
        const required = endpoint.prompt.input.required?.includes(name) ? 'Yes' : 'No';
        docs += `| ${name} | ${prop.type} | ${required} | ${prop.description || '-'} |\n`;
      }
      docs += '\n';
    }

    docs += `**Example:**\n\n`;
    docs += '```bash\n';
    if (endpoint.method === 'GET') {
      docs += `curl -X GET "http://localhost:3000${endpoint.path}?param=value"\n`;
    } else {
      docs += `curl -X ${endpoint.method} "http://localhost:3000${endpoint.path}" \\\n`;
      docs += `  -H "Content-Type: application/json" \\\n`;
      docs += `  -d '{"key": "value"}'\n`;
    }
    docs += '```\n\n';
  }

  return docs;
}
