import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  ComplianceStandard,
  ComplianceRule,
  Violation,
  getRulesByStandard,
  ALL_RULES,
} from './standards';

export interface ScanResult {
  file: string;
  violations: Violation[];
  scannedAt: string;
  standard: string;
}

export interface ComplianceReport {
  summary: {
    totalFiles: number;
    filesWithViolations: number;
    totalViolations: number;
    bySeverity: Record<string, number>;
    byStandard: Record<string, number>;
  };
  results: ScanResult[];
  generatedAt: string;
  standard: string;
}

function findViolations(content: string, rules: ComplianceRule[]): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (const rule of rules) {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of rule.patterns) {
        const matches = line.matchAll(new RegExp(pattern, 'gi'));

        for (const match of matches) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            standard: rule.standard,
            severity: rule.severity,
            line: lineNum + 1,
            column: match.index !== undefined ? match.index + 1 : 0,
            match: match[0],
            context: line.trim().substring(0, 100),
            recommendation: rule.recommendation,
          });
        }
      }
    }
  }

  return violations;
}

export function scanFile(filePath: string, standard: ComplianceStandard = 'all'): ScanResult {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const rules = getRulesByStandard(standard);
  const violations = findViolations(content, rules);

  return {
    file: absolutePath,
    violations,
    scannedAt: new Date().toISOString(),
    standard,
  };
}

export async function scanDirectory(
  dirPath: string,
  standard: ComplianceStandard = 'all',
  patterns: string[] = ['**/*.txt', '**/*.md', '**/*.json', '**/*.yaml', '**/*.yml', '**/*.prompt']
): Promise<ScanResult[]> {
  const absolutePath = path.resolve(dirPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Directory not found: ${absolutePath}`);
  }

  const results: ScanResult[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: absolutePath,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    });

    for (const file of files) {
      try {
        const result = scanFile(file, standard);
        results.push(result);
      } catch (error) {
        // Skip files that can't be read
        console.error(`Warning: Could not scan ${file}`);
      }
    }
  }

  return results;
}

export function generateReport(results: ScanResult[], standard: ComplianceStandard = 'all'): ComplianceReport {
  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  const byStandard: Record<string, number> = {
    gdpr: 0,
    ccpa: 0,
    hipaa: 0,
  };

  let totalViolations = 0;
  let filesWithViolations = 0;

  for (const result of results) {
    if (result.violations.length > 0) {
      filesWithViolations++;
    }

    for (const violation of result.violations) {
      totalViolations++;
      bySeverity[violation.severity]++;
      byStandard[violation.standard]++;
    }
  }

  return {
    summary: {
      totalFiles: results.length,
      filesWithViolations,
      totalViolations,
      bySeverity,
      byStandard,
    },
    results,
    generatedAt: new Date().toISOString(),
    standard,
  };
}

export function checkContent(content: string, standard: ComplianceStandard = 'all'): Violation[] {
  const rules = getRulesByStandard(standard);
  return findViolations(content, rules);
}

export function formatViolation(violation: Violation): string {
  const severityColors: Record<string, string> = {
    critical: '\x1b[31m', // red
    high: '\x1b[33m',     // yellow
    medium: '\x1b[36m',   // cyan
    low: '\x1b[37m',      // white
  };
  const reset = '\x1b[0m';

  return [
    `${severityColors[violation.severity]}[${violation.severity.toUpperCase()}]${reset} ${violation.ruleId}: ${violation.ruleName}`,
    `  Line ${violation.line}, Column ${violation.column}`,
    `  Match: "${violation.match}"`,
    `  Context: ${violation.context}`,
    `  Recommendation: ${violation.recommendation}`,
  ].join('\n');
}

export function formatReport(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('AI COMPLIANCE REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Standard: ${report.standard.toUpperCase()}`);
  lines.push('');
  lines.push('SUMMARY');
  lines.push('-'.repeat(40));
  lines.push(`Total files scanned: ${report.summary.totalFiles}`);
  lines.push(`Files with violations: ${report.summary.filesWithViolations}`);
  lines.push(`Total violations: ${report.summary.totalViolations}`);
  lines.push('');
  lines.push('By Severity:');
  lines.push(`  Critical: ${report.summary.bySeverity.critical}`);
  lines.push(`  High: ${report.summary.bySeverity.high}`);
  lines.push(`  Medium: ${report.summary.bySeverity.medium}`);
  lines.push(`  Low: ${report.summary.bySeverity.low}`);
  lines.push('');
  lines.push('By Standard:');
  lines.push(`  GDPR: ${report.summary.byStandard.gdpr}`);
  lines.push(`  CCPA: ${report.summary.byStandard.ccpa}`);
  lines.push(`  HIPAA: ${report.summary.byStandard.hipaa}`);
  lines.push('');

  if (report.summary.totalViolations > 0) {
    lines.push('DETAILED FINDINGS');
    lines.push('-'.repeat(40));

    for (const result of report.results) {
      if (result.violations.length > 0) {
        lines.push('');
        lines.push(`File: ${result.file}`);
        lines.push(`Violations: ${result.violations.length}`);
        lines.push('');

        for (const violation of result.violations) {
          lines.push(formatViolation(violation));
          lines.push('');
        }
      }
    }
  } else {
    lines.push('No violations found.');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

export function calculateComplianceScore(report: ComplianceReport): number {
  if (report.summary.totalFiles === 0) {
    return 100;
  }

  // Weight violations by severity
  const weights = {
    critical: 25,
    high: 10,
    medium: 5,
    low: 2,
  };

  let penalty = 0;
  penalty += report.summary.bySeverity.critical * weights.critical;
  penalty += report.summary.bySeverity.high * weights.high;
  penalty += report.summary.bySeverity.medium * weights.medium;
  penalty += report.summary.bySeverity.low * weights.low;

  // Cap penalty at 100
  const score = Math.max(0, 100 - penalty);

  return Math.round(score);
}

export function getComplianceGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
