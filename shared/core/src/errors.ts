export class LxgicError extends Error {
  public code: string;
  public exitCode: number;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', exitCode: number = 1) {
    super(message);
    this.name = 'LxgicError';
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class ValidationError extends LxgicError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 1);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends LxgicError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 2);
    this.name = 'ConfigurationError';
  }
}

export class ApiError extends LxgicError {
  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message, 'API_ERROR', 3);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export class FileError extends LxgicError {
  public path: string;

  constructor(message: string, path: string) {
    super(message, 'FILE_ERROR', 4);
    this.name = 'FileError';
    this.path = path;
  }
}

export function handleError(error: unknown, json: boolean = false): never {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof LxgicError ? error.code : 'UNKNOWN_ERROR';
  const exitCode = error instanceof LxgicError ? error.exitCode : 1;

  if (json) {
    console.log(JSON.stringify({
      success: false,
      error: message,
      code,
    }));
  } else {
    console.error(`Error: ${message}`);
    if (error instanceof Error && process.env.DEBUG) {
      console.error(error.stack);
    }
  }

  process.exit(exitCode);
}
