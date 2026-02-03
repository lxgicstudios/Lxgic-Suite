export type RoleName = 'admin' | 'developer' | 'analyst' | 'viewer' | 'custom';

export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, unknown>;
}

export interface Role {
  name: RoleName | string;
  description: string;
  permissions: Permission[];
  inherits?: string[];
  tokenLimit?: number;
  modelAccess?: string[];
}

export interface RoleDefinitions {
  [key: string]: Role;
}

// Default role definitions
export const DEFAULT_ROLES: RoleDefinitions = {
  admin: {
    name: 'admin',
    description: 'Full administrative access to all AI resources',
    permissions: [
      { action: '*', resource: '*' },
    ],
    tokenLimit: -1, // Unlimited
    modelAccess: ['*'],
  },
  developer: {
    name: 'developer',
    description: 'Development access to AI models and prompts',
    permissions: [
      { action: 'use', resource: 'model:*' },
      { action: 'create', resource: 'prompt:*' },
      { action: 'read', resource: 'prompt:*' },
      { action: 'update', resource: 'prompt:own' },
      { action: 'delete', resource: 'prompt:own' },
      { action: 'read', resource: 'usage:own' },
    ],
    tokenLimit: 1000000, // 1M tokens per day
    modelAccess: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet', 'claude-3-haiku'],
  },
  analyst: {
    name: 'analyst',
    description: 'Read-only access with analytics capabilities',
    permissions: [
      { action: 'use', resource: 'model:basic' },
      { action: 'read', resource: 'prompt:*' },
      { action: 'read', resource: 'usage:*' },
      { action: 'read', resource: 'analytics:*' },
    ],
    tokenLimit: 500000, // 500K tokens per day
    modelAccess: ['gpt-3.5-turbo', 'claude-3-haiku'],
  },
  viewer: {
    name: 'viewer',
    description: 'Read-only access to prompts and basic usage',
    permissions: [
      { action: 'read', resource: 'prompt:public' },
      { action: 'read', resource: 'usage:own' },
    ],
    tokenLimit: 100000, // 100K tokens per day
    modelAccess: ['gpt-3.5-turbo'],
  },
};

// Available actions
export const ACTIONS = [
  'use',           // Use AI models
  'create',        // Create resources
  'read',          // Read resources
  'update',        // Update resources
  'delete',        // Delete resources
  'approve',       // Approve workflows
  'manage',        // Manage settings
  '*',             // Wildcard (all actions)
] as const;

// Available resources
export const RESOURCES = [
  'model:gpt-4',
  'model:gpt-4-turbo',
  'model:gpt-3.5-turbo',
  'model:claude-3-opus',
  'model:claude-3-sonnet',
  'model:claude-3-haiku',
  'model:*',
  'model:basic',
  'prompt:*',
  'prompt:own',
  'prompt:public',
  'usage:*',
  'usage:own',
  'analytics:*',
  'settings:*',
  '*',
] as const;

// Model aliases for convenience
export const MODEL_ALIASES: Record<string, string[]> = {
  'use-opus': ['model:claude-3-opus'],
  'use-gpt4': ['model:gpt-4', 'model:gpt-4-turbo'],
  'use-sonnet': ['model:claude-3-sonnet'],
  'use-haiku': ['model:claude-3-haiku'],
  'use-basic': ['model:gpt-3.5-turbo', 'model:claude-3-haiku'],
};

export function matchesPattern(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (pattern === value) return true;

  // Handle wildcard patterns like "model:*"
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -1);
    return value.startsWith(prefix);
  }

  // Handle patterns like "prompt:own" - these are special cases
  // that need context-aware evaluation
  return false;
}

export function hasPermission(role: Role, action: string, resource: string): boolean {
  for (const permission of role.permissions) {
    if (matchesPattern(permission.action, action) && matchesPattern(permission.resource, resource)) {
      return true;
    }
  }
  return false;
}

export function canUseModel(role: Role, modelName: string): boolean {
  if (!role.modelAccess) return false;
  if (role.modelAccess.includes('*')) return true;

  // Normalize model name
  const normalizedModel = modelName.toLowerCase().replace(/[_\s]/g, '-');

  for (const model of role.modelAccess) {
    if (model === '*') return true;
    if (model.toLowerCase() === normalizedModel) return true;
    if (normalizedModel.includes(model.toLowerCase())) return true;
  }

  return false;
}

export function getTokenLimit(role: Role): number {
  return role.tokenLimit ?? 0;
}

export function resolveInheritedPermissions(
  role: Role,
  allRoles: RoleDefinitions
): Permission[] {
  const permissions = [...role.permissions];

  if (role.inherits) {
    for (const parentRoleName of role.inherits) {
      const parentRole = allRoles[parentRoleName];
      if (parentRole) {
        const parentPermissions = resolveInheritedPermissions(parentRole, allRoles);
        permissions.push(...parentPermissions);
      }
    }
  }

  return permissions;
}

export function createCustomRole(
  name: string,
  description: string,
  permissions: Permission[],
  options?: {
    inherits?: string[];
    tokenLimit?: number;
    modelAccess?: string[];
  }
): Role {
  return {
    name: name as RoleName,
    description,
    permissions,
    inherits: options?.inherits,
    tokenLimit: options?.tokenLimit ?? 100000,
    modelAccess: options?.modelAccess ?? [],
  };
}
