#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import {
  AccuracyScorer,
  ClassificationMetrics,
  ClassMetrics,
  ConfusionMatrix,
  GenerationMetrics,
} from './scorer';

const program = new Command();

program
  .name('ai-accuracy')
  .version('1.0.0')
  .description('Measure accuracy against labeled data')
  .option('--json', 'Output results in JSON format')
  .option('--verbose', 'Enable verbose output');

program
  .command('evaluate <predictions> <ground-truth>')
  .description('Evaluate predictions against ground truth labels')
  .option('--mode <mode>', 'Evaluation mode: binary, multiclass, generation', 'multiclass')
  .option('--positive-class <class>', 'Positive class for binary classification')
  .action(async (predictionsFile, groundTruthFile, options) => {
    try {
      if (!fs.existsSync(predictionsFile)) {
        throw new Error(`Predictions file not found: ${predictionsFile}`);
      }
      if (!fs.existsSync(groundTruthFile)) {
        throw new Error(`Ground truth file not found: ${groundTruthFile}`);
      }

      const predictions = JSON.parse(fs.readFileSync(predictionsFile, 'utf-8'));
      const groundTruth = JSON.parse(fs.readFileSync(groundTruthFile, 'utf-8'));

      const scorer = new AccuracyScorer();
      let result: any;

      if (options.mode === 'binary') {
        if (!options.positiveClass) {
          throw new Error('--positive-class is required for binary mode');
        }
        result = scorer.calculateBinaryMetrics(predictions, groundTruth, options.positiveClass);
      } else if (options.mode === 'generation') {
        result = scorer.calculateGenerationMetrics(predictions, groundTruth);
      } else {
        result = scorer.calculateMultiClassMetrics(predictions, groundTruth);
      }

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, mode: options.mode, metrics: result }, null, 2));
      } else {
        printMetrics(result, options.mode);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('confusion-matrix <predictions> <ground-truth>')
  .description('Generate a confusion matrix')
  .action(async (predictionsFile, groundTruthFile) => {
    try {
      if (!fs.existsSync(predictionsFile)) {
        throw new Error(`Predictions file not found: ${predictionsFile}`);
      }
      if (!fs.existsSync(groundTruthFile)) {
        throw new Error(`Ground truth file not found: ${groundTruthFile}`);
      }

      const predictions = JSON.parse(fs.readFileSync(predictionsFile, 'utf-8'));
      const groundTruth = JSON.parse(fs.readFileSync(groundTruthFile, 'utf-8'));

      const scorer = new AccuracyScorer();
      const matrix = scorer.generateConfusionMatrix(predictions, groundTruth);

      if (program.opts().json) {
        console.log(JSON.stringify({ success: true, confusionMatrix: matrix }, null, 2));
      } else {
        printConfusionMatrix(matrix);
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('errors <predictions> <ground-truth>')
  .description('Analyze prediction errors')
  .option('--inputs <file>', 'Optional inputs file for error context')
  .option('--limit <n>', 'Limit number of errors to show', '20')
  .action(async (predictionsFile, groundTruthFile, options) => {
    try {
      if (!fs.existsSync(predictionsFile)) {
        throw new Error(`Predictions file not found: ${predictionsFile}`);
      }
      if (!fs.existsSync(groundTruthFile)) {
        throw new Error(`Ground truth file not found: ${groundTruthFile}`);
      }

      const predictions = JSON.parse(fs.readFileSync(predictionsFile, 'utf-8'));
      const groundTruth = JSON.parse(fs.readFileSync(groundTruthFile, 'utf-8'));

      let inputs: string[] | undefined;
      if (options.inputs && fs.existsSync(options.inputs)) {
        inputs = JSON.parse(fs.readFileSync(options.inputs, 'utf-8'));
      }

      const scorer = new AccuracyScorer();
      const errors = scorer.analyzeErrors(predictions, groundTruth, inputs);
      const limit = parseInt(options.limit, 10);
      const displayErrors = errors.slice(0, limit);

      if (program.opts().json) {
        console.log(JSON.stringify({
          success: true,
          totalErrors: errors.length,
          totalSamples: predictions.length,
          errorRate: errors.length / predictions.length,
          errors: displayErrors,
        }, null, 2));
      } else {
        console.log(chalk.bold('\nError Analysis'));
        console.log('─'.repeat(50));
        console.log(`Total errors: ${chalk.red(errors.length)} / ${predictions.length}`);
        console.log(`Error rate: ${chalk.yellow((errors.length / predictions.length * 100).toFixed(2))}%`);
        console.log();

        if (errors.length > 0) {
          console.log(chalk.bold('Sample Errors:'));
          for (const error of displayErrors) {
            console.log(chalk.gray(`[${error.index}]`), chalk.yellow(error.errorType));
            if (error.input) {
              console.log(`  Input: ${error.input.substring(0, 60)}...`);
            }
            console.log(`  Predicted: ${chalk.red(error.predicted)}`);
            console.log(`  Actual: ${chalk.green(error.actual)}`);
            console.log();
          }

          if (errors.length > limit) {
            console.log(chalk.gray(`... and ${errors.length - limit} more errors`));
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

function printMetrics(metrics: any, mode: string): void {
  console.log(chalk.bold('\nAccuracy Metrics'));
  console.log('─'.repeat(50));

  if (mode === 'generation') {
    const gen = metrics as GenerationMetrics;
    console.log(`Exact Match:         ${formatPercent(gen.exactMatch)}`);
    console.log(`Partial Match:       ${formatPercent(gen.partialMatch)}`);
    console.log(`BLEU Score:          ${formatPercent(gen.bleuScore)}`);
    console.log(`ROUGE-L:             ${formatPercent(gen.rougeL)}`);
    console.log(`Semantic Similarity: ${formatPercent(gen.semanticSimilarity)}`);
  } else if (mode === 'binary') {
    const binary = metrics as ClassificationMetrics;
    console.log(`Accuracy:    ${formatPercent(binary.accuracy)}`);
    console.log(`Precision:   ${formatPercent(binary.precision)}`);
    console.log(`Recall:      ${formatPercent(binary.recall)}`);
    console.log(`F1 Score:    ${formatPercent(binary.f1Score)}`);
    console.log(`Specificity: ${formatPercent(binary.specificity)}`);
    console.log(`Support:     ${binary.support}`);
  } else {
    const multi = metrics as { overall: ClassificationMetrics; perClass: ClassMetrics[] };
    console.log(chalk.bold('Overall (Macro-averaged):'));
    console.log(`  Accuracy:    ${formatPercent(multi.overall.accuracy)}`);
    console.log(`  Precision:   ${formatPercent(multi.overall.precision)}`);
    console.log(`  Recall:      ${formatPercent(multi.overall.recall)}`);
    console.log(`  F1 Score:    ${formatPercent(multi.overall.f1Score)}`);
    console.log();
    console.log(chalk.bold('Per-Class Metrics:'));
    for (const cls of multi.perClass) {
      console.log(`  ${chalk.cyan(cls.className)}:`);
      console.log(`    Precision: ${formatPercent(cls.precision)} | Recall: ${formatPercent(cls.recall)} | F1: ${formatPercent(cls.f1Score)} | Support: ${cls.support}`);
    }
  }
}

function printConfusionMatrix(matrix: ConfusionMatrix): void {
  console.log(chalk.bold('\nConfusion Matrix'));
  console.log('─'.repeat(50));
  console.log(`Total samples: ${matrix.totalSamples}`);
  console.log();

  // Header
  const maxLabelLen = Math.max(...matrix.labels.map(l => l.length), 8);
  const cellWidth = Math.max(6, maxLabelLen);

  console.log(' '.repeat(maxLabelLen + 2) + matrix.labels.map(l => l.padStart(cellWidth)).join(' '));
  console.log(' '.repeat(maxLabelLen + 2) + '─'.repeat(cellWidth * matrix.labels.length + matrix.labels.length - 1));

  for (let i = 0; i < matrix.labels.length; i++) {
    const row = matrix.matrix[i];
    const rowStr = row.map((v, j) => {
      const str = v.toString().padStart(cellWidth);
      return i === j ? chalk.green(str) : (v > 0 ? chalk.red(str) : str);
    }).join(' ');
    console.log(`${matrix.labels[i].padEnd(maxLabelLen)} │ ${rowStr}`);
  }
}

function formatPercent(value: number): string {
  const percent = value * 100;
  if (percent >= 90) return chalk.green(`${percent.toFixed(2)}%`);
  if (percent >= 70) return chalk.yellow(`${percent.toFixed(2)}%`);
  return chalk.red(`${percent.toFixed(2)}%`);
}

program.parse();
