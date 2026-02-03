import * as fs from 'fs';
import * as path from 'path';
import { Policy, PolicyRule, BUILT_IN_POLICIES, getPolicy } from './policies';

export interface Violation {
  ruleId: string;
  ruleName: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: {
    line?: number;
    column?: number;
    offset?: number;
  };
  matchedText?: string;
}

export interface ValidationResult {
  valid: boolean;
  policy: string;
  file?: string;
  violations: Violation[];
  summary: {
    totalViolations: number;
    errors: number;
    warnings: number;
    info: number;
  };
  metrics: {
    tokenCount: number;
    lineCount: number;
    charCount: number;
    avgLineLength: number;
  };
}

export interface InitResult {
  success: boolean;
  path: string;
  policy: Policy;
}

export class PolicyValidator {
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 chars per token (rough average)
    return Math.ceil(text.length / 4);
  }

  private checkRule(text: string, rule: PolicyRule): Violation[] {
    const violations: Violation[] = [];

    switch (rule.type) {
      case 'maxTokens': {
        const tokens = this.estimateTokens(text);
        if (tokens > (rule.value as number)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            description: rule.description,
            severity: rule.severity,
            message: `Token count (${tokens}) exceeds maximum (${rule.value})`
          });
        }
        break;
      }

      case 'minTokens': {
        const tokens = this.estimateTokens(text);
        if (tokens < (rule.value as number)) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            description: rule.description,
            severity: rule.severity,
            message: `Token count (${tokens}) below minimum (${rule.value})`
          });
        }
        break;
      }

      case 'maxLineLength': {
        const lines = text.split('\n');
        const maxLength = rule.value as number;
        lines.forEach((line, index) => {
          if (line.length > maxLength) {
            violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              description: rule.description,
              severity: rule.severity,
              message: `Line ${index + 1} exceeds maximum length (${line.length} > ${maxLength})`,
              location: { line: index + 1, column: maxLength + 1 }
            });
          }
        });
        break;
      }

      case 'requiredSection': {
        const sections = rule.value as string[];
        const lowerText = text.toLowerCase();
        const found = sections.some(section =>
          lowerText.includes(section.toLowerCase())
        );
        if (!found) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            description: rule.description,
            severity: rule.severity,
            message: `Required section not found. Expected one of: ${sections.join(', ')}`
          });
        }
        break;
      }

      case 'forbiddenWord': {
        const words = rule.value as string[];
        const lowerText = text.toLowerCase();
        for (const word of words) {
          const lowerWord = word.toLowerCase();
          let index = lowerText.indexOf(lowerWord);
          while (index !== -1) {
            const lines = text.slice(0, index).split('\n');
            const line = lines.length;
            const column = index - text.slice(0, index).lastIndexOf('\n');
            violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              description: rule.description,
              severity: rule.severity,
              message: `Forbidden word/phrase found: "${word}"`,
              location: { line, column, offset: index },
              matchedText: text.slice(index, index + word.length)
            });
            index = lowerText.indexOf(lowerWord, index + 1);
          }
        }
        break;
      }

      case 'pattern': {
        const regex = new RegExp(rule.value as string, 'gi');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          const lines = text.slice(0, match.index).split('\n');
          const line = lines.length;
          const column = match.index - text.slice(0, match.index).lastIndexOf('\n');
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            description: rule.description,
            severity: rule.severity,
            message: `Pattern match found at line ${line}`,
            location: { line, column, offset: match.index },
            matchedText: match[0]
          });
        }
        break;
      }
    }

    return violations;
  }

  public validate(text: string, policyName: string = 'moderate', customPolicy?: Policy): ValidationResult {
    const policy = customPolicy || getPolicy(policyName);
    if (!policy) {
      throw new Error(`Unknown policy: ${policyName}. Available policies: ${Object.keys(BUILT_IN_POLICIES).join(', ')}`);
    }

    const violations: Violation[] = [];

    for (const rule of policy.rules) {
      if (!rule.enabled) continue;
      violations.push(...this.checkRule(text, rule));
    }

    // Sort by severity (errors first)
    const severityOrder = { error: 0, warning: 1, info: 2 };
    violations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const errors = violations.filter(v => v.severity === 'error').length;
    const warnings = violations.filter(v => v.severity === 'warning').length;
    const info = violations.filter(v => v.severity === 'info').length;

    const lines = text.split('\n');
    const metrics = {
      tokenCount: this.estimateTokens(text),
      lineCount: lines.length,
      charCount: text.length,
      avgLineLength: Math.round(text.length / lines.length)
    };

    return {
      valid: errors === 0,
      policy: policy.name,
      violations,
      summary: {
        totalViolations: violations.length,
        errors,
        warnings,
        info
      },
      metrics
    };
  }

  public validateFile(filePath: string, policyName: string = 'moderate', customPolicy?: Policy): ValidationResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = this.validate(content, policyName, customPolicy);
    result.file = filePath;
    return result;
  }

  public init(directory?: string): InitResult {
    const dir = directory || process.cwd();
    const configPath = path.join(dir, '.prompt-policy.json');

    // Create default moderate policy config
    const defaultConfig = {
      ...BUILT_IN_POLICIES.moderate,
      extends: 'moderate',
      customRules: []
    };

    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));

    return {
      success: true,
      path: configPath,
      policy: defaultConfig
    };
  }

  public loadCustomPolicy(configPath: string): Policy {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    // If extends a built-in policy, merge with it
    if (config.extends && BUILT_IN_POLICIES[config.extends]) {
      const basePolicy = BUILT_IN_POLICIES[config.extends];
      return {
        ...basePolicy,
        name: config.name || `custom-${config.extends}`,
        description: config.description || basePolicy.description,
        rules: [
          ...basePolicy.rules.map(rule => {
            // Check if this rule is overridden
            const override = config.rules?.find((r: PolicyRule) => r.id === rule.id);
            return override ? { ...rule, ...override } : rule;
          }),
          ...(config.customRules || [])
        ]
      };
    }

    return config as Policy;
  }

  public listPolicies(): Array<{
    name: string;
    description: string;
    ruleCount: number;
  }> {
    return Object.values(BUILT_IN_POLICIES).map(policy => ({
      name: policy.name,
      description: policy.description,
      ruleCount: policy.rules.length
    }));
  }

  public getPolicyDetails(policyName: string): Policy | undefined {
    return getPolicy(policyName);
  }
}
