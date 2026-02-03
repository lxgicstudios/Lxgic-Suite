#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  submitPrompt,
  approveSubmission,
  rejectSubmission,
  listSubmissions,
  getPendingReviews,
  exportHistory,
  getStatistics,
  getSubmission,
  ApprovalStatus,
} from './core';
import { validateSubmissionForProduction, getApprovalChain } from './workflow';

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
  .name('prompt-approve')
  .description('Approval workflow for production prompts')
  .version('1.0.0')
  .option('--json', 'Output in JSON format')
  .hook('preAction', (thisCommand) => {
    jsonOutput = thisCommand.opts().json || false;
  });

program
  .command('submit <file>')
  .description('Submit a prompt file for review')
  .option('-u, --user <user>', 'Submitter username')
  .option('-v, --validate', 'Validate prompt before submission')
  .action((file, options) => {
    try {
      const submission = submitPrompt(file, options.user);

      if (options.validate) {
        const validation = validateSubmissionForProduction(submission);
        if (!validation.valid) {
          output(
            { submission, validation },
            chalk.yellow(`Submitted with warnings:\n${validation.issues.map(i => `  - ${i}`).join('\n')}`)
          );
          return;
        }
      }

      output(
        { success: true, submission },
        chalk.green(`Prompt submitted successfully!\nID: ${submission.id}\nStatus: ${submission.status}`)
      );
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('review')
  .description('List prompts pending review')
  .option('-a, --all', 'Show all submissions including reviewed')
  .action((options) => {
    try {
      const submissions = options.all ? listSubmissions() : getPendingReviews();

      if (submissions.length === 0) {
        output({ submissions: [] }, chalk.yellow('No pending reviews'));
        return;
      }

      if (jsonOutput) {
        output({ submissions });
      } else {
        console.log(chalk.bold('\nPending Reviews:\n'));
        submissions.forEach((s, i) => {
          const statusColor = s.status === 'pending' ? chalk.yellow : s.status === 'approved' ? chalk.green : chalk.red;
          console.log(`${i + 1}. ${chalk.cyan(s.id.substring(0, 8))}...`);
          console.log(`   File: ${s.file}`);
          console.log(`   Status: ${statusColor(s.status)}`);
          console.log(`   Submitted: ${s.submittedAt} by ${s.submittedBy}`);
          console.log(`   Content preview: ${s.content.substring(0, 100)}...`);
          console.log('');
        });
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('approve <id>')
  .description('Approve a submitted prompt')
  .option('-u, --user <user>', 'Reviewer username')
  .action((id, options) => {
    try {
      const submission = approveSubmission(id, options.user);

      output(
        { success: true, submission },
        chalk.green(`Prompt ${submission.id.substring(0, 8)}... approved!`)
      );
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('reject <id>')
  .description('Reject a submitted prompt')
  .requiredOption('-r, --reason <reason>', 'Rejection reason')
  .option('-u, --user <user>', 'Reviewer username')
  .action((id, options) => {
    try {
      const submission = rejectSubmission(id, options.reason, options.user);

      output(
        { success: true, submission },
        chalk.red(`Prompt ${submission.id.substring(0, 8)}... rejected!\nReason: ${options.reason}`)
      );
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('list')
  .description('List all submissions')
  .option('-s, --status <status>', 'Filter by status (pending, approved, rejected)')
  .option('-e, --export <format>', 'Export format (json, csv)')
  .action((options) => {
    try {
      if (options.export) {
        const exported = exportHistory(options.export);
        console.log(exported);
        return;
      }

      const status = options.status as ApprovalStatus | undefined;
      const submissions = listSubmissions(status);

      if (jsonOutput) {
        output({ submissions, statistics: getStatistics() });
      } else {
        const stats = getStatistics();
        console.log(chalk.bold('\nSubmission Statistics:'));
        console.log(`  Total: ${stats.total}`);
        console.log(`  Pending: ${chalk.yellow(stats.pending)}`);
        console.log(`  Approved: ${chalk.green(stats.approved)}`);
        console.log(`  Rejected: ${chalk.red(stats.rejected)}`);
        console.log('');

        if (submissions.length > 0) {
          console.log(chalk.bold('Submissions:\n'));
          submissions.forEach((s) => {
            const statusColor = s.status === 'pending' ? chalk.yellow : s.status === 'approved' ? chalk.green : chalk.red;
            console.log(`  ${s.id.substring(0, 8)}... | ${statusColor(s.status.padEnd(8))} | ${s.file}`);
          });
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('show <id>')
  .description('Show details of a specific submission')
  .action((id) => {
    try {
      const submission = getSubmission(id);

      if (!submission) {
        throw new Error(`Submission not found: ${id}`);
      }

      const chain = getApprovalChain(submission.id);
      const validation = validateSubmissionForProduction(submission);

      if (jsonOutput) {
        output({ submission, approvalChain: chain, validation });
      } else {
        console.log(chalk.bold('\nSubmission Details:\n'));
        console.log(`  ID: ${submission.id}`);
        console.log(`  File: ${submission.file}`);
        console.log(`  Status: ${submission.status}`);
        console.log(`  Submitted: ${submission.submittedAt} by ${submission.submittedBy}`);
        if (submission.reviewedAt) {
          console.log(`  Reviewed: ${submission.reviewedAt} by ${submission.reviewedBy}`);
        }
        if (submission.rejectionReason) {
          console.log(`  Rejection Reason: ${submission.rejectionReason}`);
        }
        console.log('\n  Approval Chain:');
        chain.forEach(c => {
          console.log(`    - ${c.action} by ${c.approver} at ${c.timestamp}`);
        });
        console.log('\n  Validation:');
        console.log(`    Valid: ${validation.valid ? chalk.green('Yes') : chalk.red('No')}`);
        if (validation.issues.length > 0) {
          console.log('    Issues:');
          validation.issues.forEach(i => console.log(`      - ${i}`));
        }
        console.log('\n  Content:\n');
        console.log(submission.content);
      }
    } catch (error) {
      handleError(error);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
