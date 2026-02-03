import { DEFAULT_RULES, LintRule, LintResult, Severity, LintViolation } from './rules.js';

/**
 * Configuration for the linter
 */
export interface LintConfig {
  /** Rules to enable (if empty, all rules are enabled) */
  enabledRules?: string[];
  /** Rules to disable */
  disabledRules?: string[];
  /** Minimum severity to report */
  minSeverity?: Severity;
  /** Custom rules to add */
  customRules?: LintRule[];
}

/**
 * Overall lint report for a prompt
 */
export interface LintReport {
  /** The original prompt that was linted */
  prompt: string;
  /** File path if linting from a file */
  filePath?: string;
  /** All lint results */
  results: LintResult[];
  /** Summary statistics */
  summary: {
    totalViolations: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  /** Whether the lint passed (no errors) */
  passed: boolean;
}

/**
 * Severity priority for filtering
 */
const SEVERITY_PRIORITY: Record<Severity, number> = {
  error: 3,
  warning: 2,
  info: 1,
};

/**
 * Core prompt linter class
 */
export class PromptLinter {
  private rules: LintRule[];
  private minSeverity: Severity;

  constructor(config: LintConfig = {}) {
    const {
      enabledRules = [],
      disabledRules = [],
      minSeverity = 'info',
      customRules = [],
    } = config;

    // Start with default rules and add custom ones
    let rules = [...DEFAULT_RULES, ...customRules];

    // Filter enabled rules
    if (enabledRules.length > 0) {
      rules = rules.filter(rule => enabledRules.includes(rule.id));
    }

    // Filter disabled rules
    if (disabledRules.length > 0) {
      rules = rules.filter(rule => !disabledRules.includes(rule.id));
    }

    // Filter by minimum severity
    const minPriority = SEVERITY_PRIORITY[minSeverity];
    rules = rules.filter(rule => SEVERITY_PRIORITY[rule.severity] >= minPriority);

    this.rules = rules;
    this.minSeverity = minSeverity;
  }

  /**
   * Lint a prompt and return the results
   */
  lint(prompt: string, filePath?: string): LintReport {
    const results: LintResult[] = [];

    for (const rule of this.rules) {
      try {
        const checkResult = rule.check(prompt);

        if (checkResult !== null) {
          const violations = Array.isArray(checkResult) ? checkResult : [checkResult];

          if (violations.length > 0) {
            results.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              violations,
            });
          }
        }
      } catch (error) {
        // If a rule fails, add an error result
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: 'error',
          violations: [{
            message: `Rule execution failed: ${error instanceof Error ? error.message : String(error)}`,
          }],
        });
      }
    }

    // Calculate summary
    const summary = {
      totalViolations: results.reduce((sum, r) => sum + r.violations.length, 0),
      errors: results.filter(r => r.severity === 'error').reduce((sum, r) => sum + r.violations.length, 0),
      warnings: results.filter(r => r.severity === 'warning').reduce((sum, r) => sum + r.violations.length, 0),
      infos: results.filter(r => r.severity === 'info').reduce((sum, r) => sum + r.violations.length, 0),
    };

    return {
      prompt,
      filePath,
      results,
      summary,
      passed: summary.errors === 0,
    };
  }

  /**
   * Lint multiple prompts
   */
  lintMany(prompts: Array<{ prompt: string; filePath?: string }>): LintReport[] {
    return prompts.map(({ prompt, filePath }) => this.lint(prompt, filePath));
  }

  /**
   * Get the list of active rules
   */
  getActiveRules(): LintRule[] {
    return [...this.rules];
  }

  /**
   * Get rule count by severity
   */
  getRuleCounts(): Record<Severity, number> {
    return {
      error: this.rules.filter(r => r.severity === 'error').length,
      warning: this.rules.filter(r => r.severity === 'warning').length,
      info: this.rules.filter(r => r.severity === 'info').length,
    };
  }
}

/**
 * Format a lint report as a human-readable string
 */
export function formatReport(report: LintReport, colorize = true): string {
  const lines: string[] = [];

  // Header
  if (report.filePath) {
    lines.push(`\nLinting: ${report.filePath}`);
  } else {
    lines.push(`\nLinting prompt (${report.prompt.length} characters)`);
  }
  lines.push('─'.repeat(50));

  // Results
  if (report.results.length === 0) {
    lines.push('  No issues found.');
  } else {
    for (const result of report.results) {
      const severityLabel = getSeverityLabel(result.severity, colorize);

      for (const violation of result.violations) {
        const location = violation.line
          ? `:${violation.line}${violation.column ? `:${violation.column}` : ''}`
          : '';

        lines.push(`  ${severityLabel} [${result.ruleId}] ${violation.message}${location}`);

        if (violation.suggestion) {
          lines.push(`       Suggestion: ${violation.suggestion}`);
        }
      }
    }
  }

  // Summary
  lines.push('─'.repeat(50));
  lines.push(
    `Summary: ${report.summary.errors} error(s), ` +
    `${report.summary.warnings} warning(s), ` +
    `${report.summary.infos} info(s)`
  );

  if (report.passed) {
    lines.push(colorize ? '\x1b[32m✓ Lint passed\x1b[0m' : '✓ Lint passed');
  } else {
    lines.push(colorize ? '\x1b[31m✗ Lint failed\x1b[0m' : '✗ Lint failed');
  }

  return lines.join('\n');
}

/**
 * Format a lint report as JSON
 */
export function formatReportJson(report: LintReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Get severity label with optional color
 */
function getSeverityLabel(severity: Severity, colorize: boolean): string {
  const labels: Record<Severity, { plain: string; colored: string }> = {
    error: { plain: '[ERROR]', colored: '\x1b[31m[ERROR]\x1b[0m' },
    warning: { plain: '[WARN]', colored: '\x1b[33m[WARN]\x1b[0m' },
    info: { plain: '[INFO]', colored: '\x1b[34m[INFO]\x1b[0m' },
  };

  return colorize ? labels[severity].colored : labels[severity].plain;
}

/**
 * Convenience function to lint a single prompt with default config
 */
export function lintPrompt(prompt: string, config?: LintConfig): LintReport {
  const linter = new PromptLinter(config);
  return linter.lint(prompt);
}

/**
 * Parse a prompt file content (supports plain text and markdown)
 */
export function parsePromptFile(content: string, filePath: string): string[] {
  // Check if it's a markdown file with multiple prompts in code blocks
  if (filePath.endsWith('.md')) {
    const codeBlockRegex = /```(?:prompt|text)?\n([\s\S]*?)```/g;
    const prompts: string[] = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      prompts.push(match[1].trim());
    }

    // If no code blocks found, treat the whole file as a prompt
    if (prompts.length === 0) {
      return [content.trim()];
    }

    return prompts;
  }

  // For other files, treat the whole content as a single prompt
  return [content.trim()];
}

/**
 * Combine multiple lint reports into a summary report
 */
export function combineReports(reports: LintReport[]): {
  reports: LintReport[];
  totalSummary: {
    totalFiles: number;
    totalViolations: number;
    errors: number;
    warnings: number;
    infos: number;
    passedFiles: number;
    failedFiles: number;
  };
  allPassed: boolean;
} {
  const totalSummary = {
    totalFiles: reports.length,
    totalViolations: 0,
    errors: 0,
    warnings: 0,
    infos: 0,
    passedFiles: 0,
    failedFiles: 0,
  };

  for (const report of reports) {
    totalSummary.totalViolations += report.summary.totalViolations;
    totalSummary.errors += report.summary.errors;
    totalSummary.warnings += report.summary.warnings;
    totalSummary.infos += report.summary.infos;

    if (report.passed) {
      totalSummary.passedFiles++;
    } else {
      totalSummary.failedFiles++;
    }
  }

  return {
    reports,
    totalSummary,
    allPassed: totalSummary.failedFiles === 0,
  };
}
