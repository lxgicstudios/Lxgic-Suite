#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  grantRole,
  revokeRole,
  checkAccess,
  listUsers,
  getUser,
  getUserPermissions,
  deleteUser,
  getAllRoles,
  getRole,
  addCustomRole,
  removeCustomRole,
  grantCustomPermission,
  createUser,
} from './core';
import { DEFAULT_ROLES, ACTIONS, RESOURCES, createCustomRole } from './roles';

const program = new Command();

let jsonOutput = false;

function output(data: unknown, message?: string): void {
  if (jsonOutput) {
    console.log(JSON.stringify(data, null, 2));
  } else if (message) {
    console.log(message);
  } else {
    console.log(data);
  }
}

function handleError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    console.log(JSON.stringify({ error: message }));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(1);
}

program
  .name('ai-rbac')
  .description('Role-based access control for AI resources')
  .version('1.0.0')
  .option('--json', 'Output in JSON format')
  .hook('preAction', (thisCommand) => {
    jsonOutput = thisCommand.opts().json || false;
  });

program
  .command('grant <user>')
  .description('Grant a role to a user')
  .requiredOption('-r, --role <role>', 'Role to grant')
  .option('-e, --email <email>', 'User email (for new users)')
  .action((user, options) => {
    try {
      const result = grantRole(user, options.role);

      output(
        { success: true, user: result },
        chalk.green(`Role '${options.role}' granted to user '${user}'`)
      );
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('revoke <user>')
  .description('Revoke role(s) from a user')
  .option('-r, --role <role>', 'Specific role to revoke (revokes all if not specified)')
  .action((user, options) => {
    try {
      const result = revokeRole(user, options.role);

      const message = options.role
        ? `Role '${options.role}' revoked from user '${user}'`
        : `All roles revoked from user '${user}'`;

      output({ success: true, user: result }, chalk.yellow(message));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('check <user>')
  .description('Check if a user has permission for an action')
  .requiredOption('-a, --action <action>', 'Action to check (e.g., use-opus, read, create)')
  .option('-r, --resource <resource>', 'Resource to check against')
  .action((user, options) => {
    try {
      const result = checkAccess(user, options.action, options.resource);

      if (jsonOutput) {
        output(result);
      } else {
        const icon = result.allowed ? chalk.green('[ALLOWED]') : chalk.red('[DENIED]');
        console.log(`\n${icon} ${options.action} on ${options.resource || '*'}`);
        console.log(`Reason: ${result.reason}`);
        if (result.matchedRole) {
          console.log(`Matched Role: ${result.matchedRole}`);
        }
      }

      if (!result.allowed) {
        process.exit(1);
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('list-roles')
  .description('List all available roles')
  .option('-d, --detailed', 'Show detailed role information')
  .action((options) => {
    try {
      const roles = getAllRoles();

      if (jsonOutput) {
        output({ roles });
      } else {
        console.log(chalk.bold('\nAvailable Roles:\n'));

        for (const [name, role] of Object.entries(roles)) {
          const isBuiltIn = DEFAULT_ROLES[name] !== undefined;
          const badge = isBuiltIn ? chalk.blue('[built-in]') : chalk.cyan('[custom]');

          console.log(`  ${chalk.bold(name)} ${badge}`);
          console.log(`    ${role.description}`);

          if (options.detailed) {
            console.log(`    Token Limit: ${role.tokenLimit === -1 ? 'Unlimited' : role.tokenLimit?.toLocaleString() || 'None'}`);
            console.log(`    Model Access: ${role.modelAccess?.join(', ') || 'None'}`);
            console.log(`    Permissions:`);
            role.permissions.forEach(p => {
              console.log(`      - ${p.action} on ${p.resource}`);
            });
          }
          console.log('');
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('list-users')
  .description('List all users with their roles')
  .action(() => {
    try {
      const users = listUsers();

      if (users.length === 0) {
        output({ users: [] }, chalk.yellow('No users configured'));
        return;
      }

      if (jsonOutput) {
        output({ users });
      } else {
        console.log(chalk.bold('\nConfigured Users:\n'));

        for (const user of users) {
          console.log(`  ${chalk.cyan(user.id)}${user.email ? ` (${user.email})` : ''}`);
          console.log(`    Roles: ${user.roles.length > 0 ? user.roles.join(', ') : chalk.gray('none')}`);
          console.log(`    Created: ${user.createdAt}`);
          console.log('');
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('show <user>')
  .description('Show detailed permissions for a user')
  .action((user) => {
    try {
      const userInfo = getUser(user);

      if (!userInfo) {
        throw new Error(`User not found: ${user}`);
      }

      const permissions = getUserPermissions(user);

      if (jsonOutput) {
        output({ user: userInfo, ...permissions });
      } else {
        console.log(chalk.bold(`\nUser: ${user}\n`));
        console.log(`Email: ${userInfo.email || 'Not set'}`);
        console.log(`Roles: ${permissions.roles.join(', ') || 'None'}`);
        console.log(`Token Limit: ${permissions.tokenLimit === -1 ? 'Unlimited' : permissions.tokenLimit.toLocaleString()}`);
        console.log(`Model Access: ${permissions.modelAccess.join(', ') || 'None'}`);

        console.log(chalk.bold('\nEffective Permissions:'));
        const uniquePerms = new Map<string, string>();
        for (const p of permissions.effectivePermissions) {
          const key = `${p.action}:${p.resource}`;
          uniquePerms.set(key, `  - ${p.action} on ${p.resource}`);
        }
        uniquePerms.forEach(v => console.log(v));
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('delete-user <user>')
  .description('Delete a user from the system')
  .action((user) => {
    try {
      deleteUser(user);
      output({ success: true }, chalk.yellow(`User '${user}' deleted`));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('create-role <name>')
  .description('Create a custom role')
  .requiredOption('-d, --description <desc>', 'Role description')
  .option('-p, --permissions <perms>', 'Permissions (format: action:resource,action:resource)')
  .option('-t, --token-limit <limit>', 'Token limit per day', parseInt)
  .option('-m, --models <models>', 'Allowed models (comma-separated)')
  .option('-i, --inherits <roles>', 'Inherit from roles (comma-separated)')
  .action((name, options) => {
    try {
      const permissions = options.permissions
        ? options.permissions.split(',').map((p: string) => {
            const [action, resource] = p.split(':');
            return { action, resource };
          })
        : [];

      const role = createCustomRole(name, options.description, permissions, {
        tokenLimit: options.tokenLimit,
        modelAccess: options.models?.split(','),
        inherits: options.inherits?.split(','),
      });

      addCustomRole(role);

      output({ success: true, role }, chalk.green(`Custom role '${name}' created`));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('delete-role <name>')
  .description('Delete a custom role')
  .action((name) => {
    try {
      removeCustomRole(name);
      output({ success: true }, chalk.yellow(`Role '${name}' deleted`));
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('grant-permission <user>')
  .description('Grant a custom permission to a user')
  .requiredOption('-a, --action <action>', 'Action to grant')
  .requiredOption('-r, --resource <resource>', 'Resource to grant access to')
  .action((user, options) => {
    try {
      // Ensure user exists
      if (!getUser(user)) {
        createUser(user);
      }

      const result = grantCustomPermission(user, {
        action: options.action,
        resource: options.resource,
      });

      output(
        { success: true, user: result },
        chalk.green(`Permission '${options.action}:${options.resource}' granted to user '${user}'`)
      );
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('actions')
  .description('List available actions')
  .action(() => {
    try {
      if (jsonOutput) {
        output({ actions: ACTIONS });
      } else {
        console.log(chalk.bold('\nAvailable Actions:\n'));
        ACTIONS.forEach(a => console.log(`  - ${a}`));
        console.log('\nAction Aliases (for --action flag):');
        console.log('  - use-opus    -> use model:claude-3-opus');
        console.log('  - use-gpt4    -> use model:gpt-4');
        console.log('  - use-sonnet  -> use model:claude-3-sonnet');
        console.log('  - use-haiku   -> use model:claude-3-haiku');
        console.log('  - use-basic   -> use model:gpt-3.5-turbo or claude-3-haiku');
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('resources')
  .description('List available resources')
  .action(() => {
    try {
      if (jsonOutput) {
        output({ resources: RESOURCES });
      } else {
        console.log(chalk.bold('\nAvailable Resources:\n'));
        RESOURCES.forEach(r => console.log(`  - ${r}`));
      }
    } catch (error) {
      handleError(error);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
