#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { VersionCore } from './core.js';

const program = new Command();

interface GlobalOptions {
  json?: boolean;
}

function outputResult(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(data);
  }
}

function handleError(error: unknown, json: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    console.log(JSON.stringify({ error: message }, null, 2));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(1);
}

program
  .name('prompt-version')
  .description('Git-like version control for prompts')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format');

program
  .command('init')
  .description('Initialize prompt versioning in directory')
  .action(async () => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();
      const result = await core.init();

      if (json) {
        outputResult(result, true);
      } else {
        if (result.success) {
          console.log(chalk.green(result.message));
        } else {
          console.log(chalk.yellow(result.message));
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('commit <file>')
  .description('Save a new version of a prompt')
  .option('-m, --message <message>', 'Commit message', 'Update prompt')
  .option('-a, --author <author>', 'Author name', 'anonymous')
  .action(async (file: string, options: { message: string; author: string }) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const spinner = json ? null : ora('Committing version...').start();

      const result = await core.commit(file, options.message, options.author);

      if (spinner) spinner.stop();

      if (json) {
        outputResult(result, true);
      } else {
        if (result.success) {
          if (result.isDuplicate) {
            console.log(chalk.yellow(`Content unchanged. Existing version: ${result.versionId}`));
          } else {
            console.log(chalk.green(`Committed: ${result.versionId}`));
            console.log(chalk.gray(`Message: ${options.message}`));
          }
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('log <file>')
  .description('Show version history')
  .option('-n, --number <count>', 'Number of entries to show', '10')
  .action(async (file: string, options: { number: string }) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const entries = await core.log(file);
      const limit = parseInt(options.number, 10);
      const limitedEntries = entries.slice(0, limit);

      if (json) {
        outputResult({
          file,
          entries: limitedEntries.map(e => ({
            id: e.version.id,
            message: e.version.message,
            author: e.version.author,
            timestamp: e.version.timestamp,
            date: new Date(e.version.timestamp).toISOString(),
            branch: e.version.branch,
            tags: e.tags,
            isHead: e.isHead
          })),
          total: entries.length,
          showing: limitedEntries.length
        }, true);
      } else {
        if (entries.length === 0) {
          console.log(chalk.yellow('No versions found for this file.'));
          return;
        }

        console.log(chalk.bold(`\nVersion History: ${file}\n`));

        for (const entry of limitedEntries) {
          console.log(core.formatLogEntry(entry));
          console.log('');
        }

        if (entries.length > limit) {
          console.log(chalk.gray(`Showing ${limit} of ${entries.length} versions`));
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('diff <file>')
  .description('Compare two versions')
  .requiredOption('--v1 <hash>', 'First version hash')
  .requiredOption('--v2 <hash>', 'Second version hash')
  .action(async (file: string, options: { v1: string; v2: string }) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const result = await core.diff(file, options.v1, options.v2);

      if (!result) {
        handleError('One or both versions not found', json);
        return;
      }

      if (json) {
        outputResult({
          file,
          v1: {
            id: result.v1.id,
            timestamp: result.v1.timestamp
          },
          v2: {
            id: result.v2.id,
            timestamp: result.v2.timestamp
          },
          stats: {
            additions: result.additions,
            deletions: result.deletions,
            unchanged: result.unchanged
          },
          changes: result.changes.map(c => ({
            type: c.added ? 'added' : c.removed ? 'removed' : 'unchanged',
            value: c.value
          }))
        }, true);
      } else {
        console.log(core.formatDiff(result));
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('checkout <file> <version>')
  .description('Restore a specific version')
  .action(async (file: string, version: string) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const result = await core.checkout(file, version);

      if (json) {
        outputResult(result, true);
      } else {
        if (result.success) {
          console.log(chalk.green(result.message));
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('tag <file> <tag-name>')
  .description('Tag a version')
  .option('-v, --version <hash>', 'Version to tag (defaults to latest)')
  .action(async (file: string, tagName: string, options: { version?: string }) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const result = await core.tag(file, tagName, options.version);

      if (json) {
        outputResult(result, true);
      } else {
        if (result.success) {
          console.log(chalk.green(result.message));
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('untag <file> <tag-name>')
  .description('Remove a tag')
  .action(async (file: string, tagName: string) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const result = await core.untag(file, tagName);

      if (json) {
        outputResult(result, true);
      } else {
        if (result.success) {
          console.log(chalk.green(result.message));
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('branch <file> <branch-name>')
  .description('Create a new branch (for A/B testing)')
  .option('-f, --from <hash>', 'Create branch from specific version')
  .action(async (file: string, branchName: string, options: { from?: string }) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const result = await core.branch(file, branchName, options.from);

      if (json) {
        outputResult(result, true);
      } else {
        if (result.success) {
          console.log(chalk.green(result.message));
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('switch <file> <branch-name>')
  .description('Switch to a different branch')
  .action(async (file: string, branchName: string) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const result = await core.switchBranch(file, branchName);

      if (json) {
        outputResult(result, true);
      } else {
        if (result.success) {
          console.log(chalk.green(result.message));
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('branches <file>')
  .description('List all branches')
  .action(async (file: string) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const branches = await core.listBranches(file);

      if (json) {
        outputResult({ file, branches }, true);
      } else {
        console.log(chalk.bold('\nBranches:\n'));
        for (const branch of branches) {
          const created = new Date(branch.createdAt).toLocaleDateString();
          console.log(`  ${chalk.green(branch.name)} (created: ${created})`);
          if (branch.headId) {
            console.log(chalk.gray(`    HEAD: ${branch.headId}`));
          }
        }
        console.log('');
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('status <file>')
  .description('Show status of a prompt file')
  .action(async (file: string) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const status = await core.status(file);

      if (json) {
        outputResult({ file, ...status }, true);
      } else {
        console.log(chalk.bold(`\nStatus: ${file}\n`));
        console.log(`  Tracked: ${status.tracked ? chalk.green('Yes') : chalk.yellow('No')}`);
        console.log(`  Branch:  ${chalk.cyan(status.currentBranch)}`);
        console.log(`  Versions: ${status.versions}`);
        if (status.tracked) {
          console.log(`  Modified: ${status.modified ? chalk.yellow('Yes') : chalk.green('No')}`);
        }
        console.log('');
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('show <file> <version>')
  .description('Show content of a specific version')
  .action(async (file: string, version: string) => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const entry = await core.getVersion(file, version);

      if (!entry) {
        handleError('Version not found', json);
        return;
      }

      if (json) {
        outputResult({
          file,
          version: entry.metadata,
          content: entry.content
        }, true);
      } else {
        console.log(chalk.bold(`\nVersion: ${entry.metadata.id}`));
        console.log(chalk.gray(`Message: ${entry.metadata.message}`));
        console.log(chalk.gray(`Author:  ${entry.metadata.author}`));
        console.log(chalk.gray(`Date:    ${new Date(entry.metadata.timestamp).toLocaleString()}`));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(entry.content);
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program
  .command('list')
  .description('List all tracked prompt files')
  .action(async () => {
    const globalOpts = program.opts<GlobalOptions>();
    const json = globalOpts.json || false;

    try {
      const core = new VersionCore();

      if (!core.isInitialized()) {
        handleError('Not initialized. Run "prompt-version init" first.', json);
        return;
      }

      const files = await core.getTrackedFiles();

      if (json) {
        outputResult({ files }, true);
      } else {
        if (files.length === 0) {
          console.log(chalk.yellow('No tracked files.'));
        } else {
          console.log(chalk.bold('\nTracked Files:\n'));
          for (const file of files) {
            console.log(`  ${chalk.cyan(file)}`);
          }
          console.log('');
        }
      }
    } catch (error) {
      handleError(error, json);
    }
  });

program.parse();
