#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  createTemplate,
  applyTemplate,
  listTemplates,
  deleteTemplate,
  exportTemplate,
  importTemplate,
  getTemplateByIdOrName,
  previewTemplate,
} from './core.js';
import { parseKeyValuePairs } from './parser.js';

const program = new Command();

interface GlobalOptions {
  json?: boolean;
}

/**
 * Output helper for JSON or formatted output
 */
function output(data: unknown, options: GlobalOptions): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(data);
  }
}

/**
 * Error output helper
 */
function outputError(message: string, options: GlobalOptions, exitCode = 1): never {
  if (options.json) {
    console.log(JSON.stringify({ success: false, error: message }));
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(exitCode);
}

program
  .name('prompt-template')
  .description('Generate reusable prompt templates from examples')
  .version('1.0.0')
  .option('--json', 'Output results in JSON format');

/**
 * Create command - Generate template from examples
 */
program
  .command('create')
  .description('Generate a template from example prompts')
  .requiredOption('--from <directory>', 'Directory containing example prompt files (.txt, .md, .prompt)')
  .option('--name <name>', 'Name for the template')
  .option('--no-ai', 'Disable AI-powered analysis (use pattern matching only)')
  .action(async (cmdOptions) => {
    const globalOptions = program.opts() as GlobalOptions;
    const spinner = globalOptions.json ? null : ora('Analyzing examples...').start();

    try {
      const result = await createTemplate(cmdOptions.from, {
        name: cmdOptions.name,
        useAI: cmdOptions.ai !== false,
      });

      if (!result.success) {
        spinner?.fail('Failed to create template');
        outputError(result.error || 'Unknown error', globalOptions);
      }

      spinner?.succeed('Template created successfully');

      if (globalOptions.json) {
        output({
          success: true,
          template: {
            id: result.template!.id,
            name: result.template!.name,
            description: result.template!.description,
            variables: result.template!.variables,
            preview: previewTemplate(result.template!.id),
          },
        }, globalOptions);
      } else {
        console.log();
        console.log(chalk.bold('Template Details:'));
        console.log(chalk.gray('  ID:'), result.template!.id);
        console.log(chalk.gray('  Name:'), result.template!.name);
        console.log(chalk.gray('  Description:'), result.template!.description || 'N/A');
        console.log();
        console.log(chalk.bold('Variables:'));
        if (result.template!.variables.length === 0) {
          console.log(chalk.gray('  No variables detected'));
        } else {
          for (const v of result.template!.variables) {
            const required = v.required ? chalk.red('*') : '';
            console.log(chalk.cyan(`  {{${v.name}}}${required}`), '-', v.description || 'No description');
          }
        }
        console.log();
        console.log(chalk.bold('Template Preview:'));
        console.log(chalk.gray(previewTemplate(result.template!.id)));
        console.log();
        console.log(chalk.green(`Use: prompt-template apply ${result.template!.name} --vars key=value`));
      }
    } catch (error) {
      spinner?.fail('Failed to create template');
      outputError(error instanceof Error ? error.message : String(error), globalOptions);
    }
  });

/**
 * Apply command - Apply template with variables
 */
program
  .command('apply <template>')
  .description('Apply a template with variable substitutions')
  .option('--vars <pairs...>', 'Variable key=value pairs')
  .option('--output <file>', 'Write result to file instead of stdout')
  .action(async (templateIdOrName, cmdOptions) => {
    const globalOptions = program.opts() as GlobalOptions;

    try {
      // Parse variables
      const vars = cmdOptions.vars ? parseKeyValuePairs(cmdOptions.vars) : {};

      const result = await applyTemplate(templateIdOrName, vars);

      if (!result.success) {
        outputError(result.error || 'Unknown error', globalOptions);
      }

      // Handle warnings
      if (result.warnings && !globalOptions.json) {
        for (const warning of result.warnings) {
          console.warn(chalk.yellow(`Warning: ${warning}`));
        }
      }

      // Output result
      if (cmdOptions.output) {
        const fs = await import('fs/promises');
        await fs.writeFile(cmdOptions.output, result.result!, 'utf-8');

        if (globalOptions.json) {
          output({
            success: true,
            outputFile: cmdOptions.output,
            warnings: result.warnings,
          }, globalOptions);
        } else {
          console.log(chalk.green(`Result written to: ${cmdOptions.output}`));
        }
      } else {
        if (globalOptions.json) {
          output({
            success: true,
            result: result.result,
            warnings: result.warnings,
          }, globalOptions);
        } else {
          console.log(result.result);
        }
      }
    } catch (error) {
      outputError(error instanceof Error ? error.message : String(error), globalOptions);
    }
  });

/**
 * List command - List all saved templates
 */
program
  .command('list')
  .description('List all saved templates')
  .option('--verbose', 'Show detailed template information')
  .action((cmdOptions) => {
    const globalOptions = program.opts() as GlobalOptions;
    const templates = listTemplates();

    if (globalOptions.json) {
      output({
        success: true,
        count: templates.length,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          variables: t.variables.map(v => v.name),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
      }, globalOptions);
      return;
    }

    if (templates.length === 0) {
      console.log(chalk.yellow('No templates found.'));
      console.log(chalk.gray('Create one with: prompt-template create --from <examples-dir>'));
      return;
    }

    console.log(chalk.bold(`\nFound ${templates.length} template(s):\n`));

    for (const template of templates) {
      console.log(chalk.cyan.bold(template.name), chalk.gray(`(${template.id})`));
      console.log(chalk.gray(`  ${template.description || 'No description'}`));

      if (cmdOptions.verbose) {
        console.log(chalk.gray('  Variables:'), template.variables.map(v => `{{${v.name}}}`).join(', ') || 'None');
        console.log(chalk.gray('  Created:'), new Date(template.createdAt).toLocaleString());
        console.log(chalk.gray('  Updated:'), new Date(template.updatedAt).toLocaleString());
      } else {
        const varCount = template.variables.length;
        console.log(chalk.gray(`  ${varCount} variable${varCount !== 1 ? 's' : ''}`));
      }

      console.log();
    }
  });

/**
 * Show command - Show template details
 */
program
  .command('show <template>')
  .description('Show details of a specific template')
  .action((templateIdOrName) => {
    const globalOptions = program.opts() as GlobalOptions;
    const template = getTemplateByIdOrName(templateIdOrName);

    if (!template) {
      outputError(`Template not found: ${templateIdOrName}`, globalOptions);
    }

    if (globalOptions.json) {
      output({
        success: true,
        template: {
          ...template,
          preview: previewTemplate(template!.id),
        },
      }, globalOptions);
      return;
    }

    console.log();
    console.log(chalk.bold.cyan(template!.name));
    console.log(chalk.gray('ID:'), template!.id);
    console.log(chalk.gray('Description:'), template!.description || 'N/A');
    console.log(chalk.gray('Created:'), new Date(template!.createdAt).toLocaleString());
    console.log(chalk.gray('Updated:'), new Date(template!.updatedAt).toLocaleString());
    console.log();

    console.log(chalk.bold('Variables:'));
    if (template!.variables.length === 0) {
      console.log(chalk.gray('  No variables'));
    } else {
      for (const v of template!.variables) {
        const required = v.required ? chalk.red(' (required)') : chalk.gray(' (optional)');
        console.log(chalk.cyan(`  {{${v.name}}}`), required);
        if (v.description) {
          console.log(chalk.gray(`    ${v.description}`));
        }
        if (v.defaultValue) {
          console.log(chalk.gray(`    Default: ${v.defaultValue}`));
        }
      }
    }

    console.log();
    console.log(chalk.bold('Template:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(template!.template);
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
  });

/**
 * Delete command - Delete a template
 */
program
  .command('delete <template>')
  .description('Delete a saved template')
  .option('--force', 'Skip confirmation')
  .action(async (templateIdOrName, cmdOptions) => {
    const globalOptions = program.opts() as GlobalOptions;
    const template = getTemplateByIdOrName(templateIdOrName);

    if (!template) {
      outputError(`Template not found: ${templateIdOrName}`, globalOptions);
    }

    if (!cmdOptions.force && !globalOptions.json) {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          chalk.yellow(`Delete template "${template!.name}"? (y/N): `),
          resolve
        );
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log(chalk.gray('Cancelled.'));
        return;
      }
    }

    const success = deleteTemplate(templateIdOrName);

    if (globalOptions.json) {
      output({ success, templateId: template!.id }, globalOptions);
    } else if (success) {
      console.log(chalk.green(`Deleted template: ${template!.name}`));
    } else {
      outputError('Failed to delete template', globalOptions);
    }
  });

/**
 * Export command - Export template to file
 */
program
  .command('export <template>')
  .description('Export a template to a JSON file')
  .requiredOption('--output <file>', 'Output file path')
  .action(async (templateIdOrName, cmdOptions) => {
    const globalOptions = program.opts() as GlobalOptions;
    const spinner = globalOptions.json ? null : ora('Exporting template...').start();

    const result = await exportTemplate(templateIdOrName, cmdOptions.output);

    if (!result.success) {
      spinner?.fail('Export failed');
      outputError(result.error || 'Unknown error', globalOptions);
    }

    spinner?.succeed('Template exported');

    if (globalOptions.json) {
      output({ success: true, outputFile: cmdOptions.output }, globalOptions);
    } else {
      console.log(chalk.green(`Template exported to: ${cmdOptions.output}`));
    }
  });

/**
 * Import command - Import template from file
 */
program
  .command('import <file>')
  .description('Import a template from a JSON file')
  .action(async (filePath) => {
    const globalOptions = program.opts() as GlobalOptions;
    const spinner = globalOptions.json ? null : ora('Importing template...').start();

    const result = await importTemplate(filePath);

    if (!result.success) {
      spinner?.fail('Import failed');
      outputError(result.error || 'Unknown error', globalOptions);
    }

    spinner?.succeed('Template imported');

    if (globalOptions.json) {
      output({
        success: true,
        template: {
          id: result.template!.id,
          name: result.template!.name,
        },
      }, globalOptions);
    } else {
      console.log(chalk.green(`Imported template: ${result.template!.name} (${result.template!.id})`));
    }
  });

// Parse and execute
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
