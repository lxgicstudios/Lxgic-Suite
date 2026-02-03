import * as fs from 'fs';
import * as path from 'path';
import {
  Role,
  RoleDefinitions,
  Permission,
  DEFAULT_ROLES,
  hasPermission,
  canUseModel,
  getTokenLimit,
  resolveInheritedPermissions,
  MODEL_ALIASES,
  matchesPattern,
} from './roles';

export interface User {
  id: string;
  email?: string;
  roles: string[];
  customPermissions?: Permission[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RBACStore {
  users: Record<string, User>;
  customRoles: RoleDefinitions;
  lastUpdated: string;
}

const DEFAULT_STORE_PATH = path.join(process.cwd(), '.ai-rbac.json');

export function getStorePath(): string {
  return process.env.AI_RBAC_STORE || DEFAULT_STORE_PATH;
}

export function loadStore(): RBACStore {
  const storePath = getStorePath();
  if (fs.existsSync(storePath)) {
    const data = fs.readFileSync(storePath, 'utf-8');
    return JSON.parse(data);
  }
  return {
    users: {},
    customRoles: {},
    lastUpdated: new Date().toISOString(),
  };
}

export function saveStore(store: RBACStore): void {
  const storePath = getStorePath();
  store.lastUpdated = new Date().toISOString();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
}

export function getAllRoles(): RoleDefinitions {
  const store = loadStore();
  return { ...DEFAULT_ROLES, ...store.customRoles };
}

export function getRole(roleName: string): Role | undefined {
  const allRoles = getAllRoles();
  return allRoles[roleName];
}

export function getUser(userId: string): User | undefined {
  const store = loadStore();
  return store.users[userId];
}

export function createUser(userId: string, email?: string): User {
  const store = loadStore();

  if (store.users[userId]) {
    throw new Error(`User already exists: ${userId}`);
  }

  const user: User = {
    id: userId,
    email,
    roles: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.users[userId] = user;
  saveStore(store);

  return user;
}

export function grantRole(userId: string, roleName: string): User {
  const store = loadStore();

  // Ensure user exists
  if (!store.users[userId]) {
    store.users[userId] = {
      id: userId,
      roles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const user = store.users[userId];

  // Check if role exists
  const allRoles = getAllRoles();
  if (!allRoles[roleName]) {
    throw new Error(`Role not found: ${roleName}`);
  }

  // Add role if not already present
  if (!user.roles.includes(roleName)) {
    user.roles.push(roleName);
    user.updatedAt = new Date().toISOString();
    saveStore(store);
  }

  return user;
}

export function revokeRole(userId: string, roleName?: string): User {
  const store = loadStore();
  const user = store.users[userId];

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  if (roleName) {
    // Revoke specific role
    user.roles = user.roles.filter(r => r !== roleName);
  } else {
    // Revoke all roles
    user.roles = [];
  }

  user.updatedAt = new Date().toISOString();
  saveStore(store);

  return user;
}

export function checkAccess(
  userId: string,
  action: string,
  resource?: string
): { allowed: boolean; reason: string; matchedRole?: string } {
  const store = loadStore();
  const user = store.users[userId];

  if (!user) {
    return { allowed: false, reason: 'User not found' };
  }

  if (user.roles.length === 0) {
    return { allowed: false, reason: 'User has no roles assigned' };
  }

  const allRoles = getAllRoles();

  // Resolve action aliases (e.g., use-opus -> model:claude-3-opus)
  let resolvedResources: string[] = [];
  if (MODEL_ALIASES[action]) {
    resolvedResources = MODEL_ALIASES[action];
    action = 'use';
  } else if (resource) {
    resolvedResources = [resource];
  }

  // Check each role
  for (const roleName of user.roles) {
    const role = allRoles[roleName];
    if (!role) continue;

    // Get all permissions including inherited
    const permissions = resolveInheritedPermissions(role, allRoles);
    const effectiveRole = { ...role, permissions };

    // If no resource specified, check if action is allowed on any resource
    if (resolvedResources.length === 0) {
      if (hasPermission(effectiveRole, action, '*')) {
        return { allowed: true, reason: `Allowed by role: ${roleName}`, matchedRole: roleName };
      }
    } else {
      // Check each resolved resource
      for (const res of resolvedResources) {
        if (hasPermission(effectiveRole, action, res)) {
          return { allowed: true, reason: `Allowed by role: ${roleName}`, matchedRole: roleName };
        }
      }
    }
  }

  // Check custom permissions
  if (user.customPermissions) {
    for (const permission of user.customPermissions) {
      if (resolvedResources.length === 0) {
        if (matchesPattern(permission.action, action)) {
          return { allowed: true, reason: 'Allowed by custom permission' };
        }
      } else {
        for (const res of resolvedResources) {
          if (matchesPattern(permission.action, action) && matchesPattern(permission.resource, res)) {
            return { allowed: true, reason: 'Allowed by custom permission' };
          }
        }
      }
    }
  }

  return {
    allowed: false,
    reason: `Action '${action}' on resource '${resolvedResources.join(', ') || '*'}' not permitted by user's roles`,
  };
}

export function getUserPermissions(userId: string): {
  roles: string[];
  effectivePermissions: Permission[];
  tokenLimit: number;
  modelAccess: string[];
} {
  const store = loadStore();
  const user = store.users[userId];

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const allRoles = getAllRoles();
  const effectivePermissions: Permission[] = [];
  let tokenLimit = 0;
  const modelAccess: Set<string> = new Set();

  for (const roleName of user.roles) {
    const role = allRoles[roleName];
    if (!role) continue;

    const permissions = resolveInheritedPermissions(role, allRoles);
    effectivePermissions.push(...permissions);

    const roleTokenLimit = getTokenLimit(role);
    if (roleTokenLimit === -1) {
      tokenLimit = -1; // Unlimited
    } else if (tokenLimit !== -1) {
      tokenLimit = Math.max(tokenLimit, roleTokenLimit);
    }

    if (role.modelAccess) {
      role.modelAccess.forEach(m => modelAccess.add(m));
    }
  }

  // Add custom permissions
  if (user.customPermissions) {
    effectivePermissions.push(...user.customPermissions);
  }

  return {
    roles: user.roles,
    effectivePermissions,
    tokenLimit,
    modelAccess: Array.from(modelAccess),
  };
}

export function listUsers(): User[] {
  const store = loadStore();
  return Object.values(store.users);
}

export function deleteUser(userId: string): void {
  const store = loadStore();

  if (!store.users[userId]) {
    throw new Error(`User not found: ${userId}`);
  }

  delete store.users[userId];
  saveStore(store);
}

export function addCustomRole(role: Role): void {
  const store = loadStore();

  if (DEFAULT_ROLES[role.name]) {
    throw new Error(`Cannot override built-in role: ${role.name}`);
  }

  store.customRoles[role.name] = role;
  saveStore(store);
}

export function removeCustomRole(roleName: string): void {
  const store = loadStore();

  if (DEFAULT_ROLES[roleName]) {
    throw new Error(`Cannot remove built-in role: ${roleName}`);
  }

  if (!store.customRoles[roleName]) {
    throw new Error(`Custom role not found: ${roleName}`);
  }

  delete store.customRoles[roleName];
  saveStore(store);
}

export function grantCustomPermission(userId: string, permission: Permission): User {
  const store = loadStore();
  const user = store.users[userId];

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  if (!user.customPermissions) {
    user.customPermissions = [];
  }

  user.customPermissions.push(permission);
  user.updatedAt = new Date().toISOString();
  saveStore(store);

  return user;
}

export function revokeCustomPermission(userId: string, action: string, resource: string): User {
  const store = loadStore();
  const user = store.users[userId];

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  if (user.customPermissions) {
    user.customPermissions = user.customPermissions.filter(
      p => !(p.action === action && p.resource === resource)
    );
    user.updatedAt = new Date().toISOString();
    saveStore(store);
  }

  return user;
}
