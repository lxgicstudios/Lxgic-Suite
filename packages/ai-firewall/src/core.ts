import * as fs from 'fs';
import { INJECTION_RULES, SecurityRule, RuleAction, RuleSeverity, RuleCategory, getAllRules } from './rules';

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  action: RuleAction;
  score: number;
  matchedText: string;
  position: {
    start: number;
    end: number;
    line?: number;
    column?: number;
  };
}

export interface CheckResult {
  input: string;
  allowed: boolean;
  riskScore: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  matches: RuleMatch[];
  summary: {
    totalMatches: number;
    blockedCount: number;
    warnCount: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  recommendation: string;
}

export interface AnalyzeResult {
  file: string;
  lines: number;
  checks: CheckResult[];
  overallRiskScore: number;
  overallRiskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  summary: {
    totalLines: number;
    flaggedLines: number;
    blockedLines: number;
    totalMatches: number;
  };
}

export interface FirewallOptions {
  rules?: string[];
  excludeRules?: string[];
  customRules?: SecurityRule[];
  minSeverity?: RuleSeverity;
  action?: RuleAction;
}

export class AIFirewall {
  private rules: SecurityRule[];

  constructor() {
    this.rules = [...INJECTION_RULES];
  }

  private getActiveRules(options?: FirewallOptions): SecurityRule[] {
    let rules = [...this.rules];

    // Add custom rules
    if (options?.customRules) {
      rules = [...rules, ...options.customRules];
    }

    // Filter to specific rules if specified
    if (options?.rules && options.rules.length > 0) {
      rules = rules.filter(r => options.rules!.includes(r.id));
    }

    // Exclude rules
    if (options?.excludeRules && options.excludeRules.length > 0) {
      rules = rules.filter(r => !options.excludeRules!.includes(r.id));
    }

    // Filter by minimum severity
    if (options?.minSeverity) {
      const severityOrder: RuleSeverity[] = ['low', 'medium', 'high', 'critical'];
      const minIndex = severityOrder.indexOf(options.minSeverity);
      rules = rules.filter(r => severityOrder.indexOf(r.severity) >= minIndex);
    }

    return rules;
  }

  private calculateRiskLevel(score: number): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'safe';
  }

  private getLineAndColumn(text: string, position: number): { line: number; column: number } {
    const lines = text.slice(0, position).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  private getRecommendation(matches: RuleMatch[], riskLevel: string): string {
    if (matches.length === 0) {
      return 'Input appears safe. No security concerns detected.';
    }

    const blocked = matches.filter(m => m.action === 'block');
    const warnings = matches.filter(m => m.action === 'warn');

    if (blocked.length > 0) {
      const categories = [...new Set(blocked.map(m => m.category))];
      return `BLOCK RECOMMENDED: Detected ${blocked.length} high-risk pattern(s) in categories: ${categories.join(', ')}. This input should not be processed.`;
    }

    if (riskLevel === 'high' || riskLevel === 'critical') {
      return `HIGH RISK: ${warnings.length} suspicious pattern(s) detected. Consider manual review before processing.`;
    }

    if (riskLevel === 'medium') {
      return `MODERATE RISK: ${warnings.length} pattern(s) detected that may indicate manipulation attempts. Use caution.`;
    }

    return `LOW RISK: ${matches.length} minor pattern(s) detected. Generally safe but monitor for patterns.`;
  }

  public check(input: string, options?: FirewallOptions): CheckResult {
    const rules = this.getActiveRules(options);
    const matches: RuleMatch[] = [];

    for (const rule of rules) {
      // Reset regex state
      const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(input)) !== null) {
        const position = this.getLineAndColumn(input, match.index);
        matches.push({
          ruleId: rule.id,
          ruleName: rule.name,
          description: rule.description,
          category: rule.category,
          severity: rule.severity,
          action: rule.action,
          score: rule.score,
          matchedText: match[0],
          position: {
            start: match.index,
            end: match.index + match[0].length,
            line: position.line,
            column: position.column
          }
        });
      }
    }

    // Sort by score (highest first)
    matches.sort((a, b) => b.score - a.score);

    // Calculate overall risk score (use highest match + diminishing additions)
    let riskScore = 0;
    if (matches.length > 0) {
      riskScore = matches[0].score;
      for (let i = 1; i < matches.length; i++) {
        riskScore += matches[i].score * (0.5 / i); // Diminishing returns
      }
      riskScore = Math.min(100, riskScore);
    }

    // Build summary
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let blockedCount = 0;
    let warnCount = 0;

    for (const match of matches) {
      byCategory[match.category] = (byCategory[match.category] || 0) + 1;
      bySeverity[match.severity] = (bySeverity[match.severity] || 0) + 1;
      if (match.action === 'block') blockedCount++;
      if (match.action === 'warn') warnCount++;
    }

    const riskLevel = this.calculateRiskLevel(riskScore);
    const allowed = blockedCount === 0;

    return {
      input,
      allowed,
      riskScore: Math.round(riskScore),
      riskLevel,
      matches,
      summary: {
        totalMatches: matches.length,
        blockedCount,
        warnCount,
        byCategory,
        bySeverity
      },
      recommendation: this.getRecommendation(matches, riskLevel)
    };
  }

  public analyze(filePath: string, options?: FirewallOptions): AnalyzeResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const checks: CheckResult[] = [];

    let totalMatches = 0;
    let flaggedLines = 0;
    let blockedLines = 0;
    let maxRiskScore = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().length === 0) continue;

      const result = this.check(line, options);
      if (result.matches.length > 0) {
        checks.push({
          ...result,
          input: `Line ${i + 1}: ${line.slice(0, 100)}${line.length > 100 ? '...' : ''}`
        });
        totalMatches += result.matches.length;
        flaggedLines++;
        if (!result.allowed) blockedLines++;
        if (result.riskScore > maxRiskScore) maxRiskScore = result.riskScore;
      }
    }

    return {
      file: filePath,
      lines: lines.length,
      checks,
      overallRiskScore: Math.round(maxRiskScore),
      overallRiskLevel: this.calculateRiskLevel(maxRiskScore),
      summary: {
        totalLines: lines.length,
        flaggedLines,
        blockedLines,
        totalMatches
      }
    };
  }

  public getRules(): Array<{
    id: string;
    name: string;
    description: string;
    category: RuleCategory;
    severity: RuleSeverity;
    action: RuleAction;
    score: number;
  }> {
    return this.rules.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      severity: r.severity,
      action: r.action,
      score: r.score
    }));
  }

  public addCustomRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }
}
