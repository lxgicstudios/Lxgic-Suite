#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  lockFile,
  unlockFile,
  lockDirectory,
  unlockDirectory,
  rotateKeys,
  verifyFile,
  createNewKey,
} from './core';

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
  .name('prompt-encrypt')
  .description('Encrypt prompts at rest and in transit')
  .version('1.0.0')
  .option('--json', 'Output in JSON format')
  .hook('preAction', (thisCommand) => {
    jsonOutput = thisCommand.opts().json || false;
  });

program
  .command('lock <file>')
  .description('Encrypt a file or directory')
  .option('-k, --key <key>', 'Encryption key (hex string, $ENV_VAR, or path to key file)')
  .option('-d, --directory', 'Encrypt all files in directory')
  .option('-p, --patterns <patterns>', 'File patterns to encrypt (comma-separated)', '**/*.txt,**/*.md,**/*.json')
  .option('--delete-original', 'Delete original file after encryption')
  .action(async (file, options) => {
    try {
      if (options.directory) {
        const patterns = options.patterns.split(',');
        const result = await lockDirectory(file, options.key, patterns);

        if (jsonOutput) {
          output(result);
        } else {
          console.log(chalk.bold('\nEncryption Results:\n'));
          console.log(`Total files: ${result.totalFiles}`);
          console.log(`Successful: ${chalk.green(result.successful)}`);
          console.log(`Failed: ${chalk.red(result.failed)}`);

          if (result.failed > 0) {
            console.log(chalk.yellow('\nFailed files:'));
            result.results
              .filter(r => !r.success)
              .forEach(r => console.log(`  ${r.inputFile}: ${r.error}`));
          }
        }
      } else {
        const result = lockFile(file, options.key);

        if (!result.success) {
          throw new Error(result.error);
        }

        if (options.deleteOriginal) {
          const fs = require('fs');
          fs.unlinkSync(result.inputFile);
        }

        output(
          result,
          chalk.green(`File encrypted successfully!\nOutput: ${result.outputFile}`)
        );
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('unlock <file>')
  .description('Decrypt a file or directory')
  .option('-k, --key <key>', 'Decryption key (hex string, $ENV_VAR, or path to key file)')
  .option('-d, --directory', 'Decrypt all .encrypted files in directory')
  .option('-o, --output <path>', 'Output path for decrypted file')
  .option('--delete-encrypted', 'Delete encrypted file after decryption')
  .action(async (file, options) => {
    try {
      if (options.directory) {
        const result = await unlockDirectory(file, options.key);

        if (jsonOutput) {
          output(result);
        } else {
          console.log(chalk.bold('\nDecryption Results:\n'));
          console.log(`Total files: ${result.totalFiles}`);
          console.log(`Successful: ${chalk.green(result.successful)}`);
          console.log(`Failed: ${chalk.red(result.failed)}`);

          if (result.failed > 0) {
            console.log(chalk.yellow('\nFailed files:'));
            result.results
              .filter(r => !r.success)
              .forEach(r => console.log(`  ${r.inputFile}: ${r.error}`));
          }
        }
      } else {
        const result = unlockFile(file, options.key);

        if (!result.success) {
          throw new Error(result.error);
        }

        if (options.deleteEncrypted) {
          const fs = require('fs');
          fs.unlinkSync(result.inputFile);
        }

        output(
          result,
          chalk.green(`File decrypted successfully!\nOutput: ${result.outputFile}`)
        );
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('rotate-key')
  .description('Rotate encryption keys for encrypted files')
  .option('-d, --directory <dir>', 'Directory containing encrypted files', '.')
  .option('--old-key <key>', 'Current encryption key')
  .option('--new-key <key>', 'New encryption key (generates one if not provided)')
  .action(async (options) => {
    try {
      if (!options.oldKey) {
        throw new Error('Old key is required (--old-key)');
      }

      const result = await rotateKeys(options.directory, options.oldKey, options.newKey);

      if (jsonOutput) {
        output(result);
      } else {
        console.log(chalk.bold('\nKey Rotation Results:\n'));
        console.log(`Files rotated: ${chalk.green(result.rotated.length)}`);
        console.log(`Failed: ${chalk.red(result.failed.length)}`);

        if (result.newKeyFile) {
          console.log(chalk.yellow(`\nNew key saved to: ${result.newKeyFile}`));
          console.log(chalk.red('IMPORTANT: Store this key securely and delete the file!'));
        }

        if (result.failed.length > 0) {
          console.log(chalk.yellow('\nFailed files:'));
          result.failed.forEach(f => console.log(`  ${f.file}: ${f.error}`));
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('generate-key')
  .description('Generate a new encryption key')
  .option('-o, --output <file>', 'Save key to file')
  .action((options) => {
    try {
      const result = createNewKey(options.output);

      if (jsonOutput) {
        output(result);
      } else {
        if (result.file) {
          console.log(chalk.green(`Key saved to: ${result.file}`));
          console.log(chalk.red('IMPORTANT: Store this key securely!'));
        } else {
          console.log(chalk.bold('Generated Key:'));
          console.log(result.key);
          console.log('');
          console.log(chalk.yellow('Use this key with --key option or set PROMPT_ENCRYPT_KEY environment variable'));
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('verify <file>')
  .description('Verify integrity of an encrypted file')
  .action((file) => {
    try {
      const result = verifyFile(file);

      if (jsonOutput) {
        output(result);
      } else {
        console.log(chalk.bold('\nIntegrity Check:\n'));
        console.log(`File: ${file}`);
        console.log(`Valid: ${result.valid ? chalk.green('Yes') : chalk.red('No')}`);

        if (result.issues.length > 0) {
          console.log(chalk.yellow('\nIssues:'));
          result.issues.forEach(i => console.log(`  - ${i}`));
        }

        if (result.metadata) {
          console.log(chalk.bold('\nMetadata:'));
          Object.entries(result.metadata).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
      }

      if (!result.valid) {
        process.exit(1);
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('info <file>')
  .description('Show information about an encrypted file')
  .action((file) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const absolutePath = path.resolve(file);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }

      const content = fs.readFileSync(absolutePath, 'utf-8');
      const data = JSON.parse(content);

      const info = {
        version: data.version,
        algorithm: data.algorithm,
        metadata: data.metadata,
        ciphertextLength: data.ciphertext?.length || 0,
      };

      if (jsonOutput) {
        output(info);
      } else {
        console.log(chalk.bold('\nEncrypted File Info:\n'));
        console.log(`Version: ${info.version}`);
        console.log(`Algorithm: ${info.algorithm}`);
        console.log(`Ciphertext Length: ${info.ciphertextLength} chars`);

        if (info.metadata) {
          console.log(chalk.bold('\nMetadata:'));
          Object.entries(info.metadata).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
