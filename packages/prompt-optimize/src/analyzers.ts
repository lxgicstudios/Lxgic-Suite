import chalk from 'chalk';
import type {
  AnalysisResult,
  AnalysisIssue,
  SuggestionsResult,
  Suggestion,
  RewriteResult
} from './core.js';

/**
 * Format the issue type with appropriate color
 */
function formatIssueType(type: AnalysisIssue['type']): string {
  switch (type) {
    case 'error':
      return chalk.red.bold('[ERROR]');
    case 'warning':
      return chalk.yellow.bold('[WARNING]');
    case 'suggestion':
      return chalk.blue.bold('[SUGGESTION]');
    default:
      return chalk.gray('[INFO]');
  }
}

/**
 * Format the score with color based on value
 */
function formatScore(score: number): string {
  if (score >= 80) {
    return chalk.green.bold(`${score}/100`);
  } else if (score >= 60) {
    return chalk.yellow.bold(`${score}/100`);
  } else if (score >= 40) {
    return chalk.hex('#FFA500').bold(`${score}/100`);
  } else {
    return chalk.red.bold(`${score}/100`);
  }
}

/**
 * Format impact/effort level with color
 */
function formatLevel(level: 'high' | 'medium' | 'low', isImpact: boolean = true): string {
  const colors = isImpact
    ? { high: chalk.green, medium: chalk.yellow, low: chalk.gray }
    : { high: chalk.red, medium: chalk.yellow, low: chalk.green };

  return colors[level](level.toUpperCase());
}

/**
 * Format the analysis report
 */
export function formatAnalysisReport(analysis: AnalysisResult): string {
  const output: string[] = [];

  // File and Score
  output.push(`${chalk.bold('File:')} ${analysis.file}`);
  output.push(`${chalk.bold('Score:')} ${formatScore(analysis.score)}`);
  output.push('');

  // Statistics
  output.push(chalk.bold.underline('Statistics'));
  output.push(`  Characters: ${analysis.stats.characters.toLocaleString()}`);
  output.push(`  Words: ${analysis.stats.words.toLocaleString()}`);
  output.push(`  Lines: ${analysis.stats.lines}`);
  output.push(`  Est. Tokens: ~${analysis.stats.estimatedTokens.toLocaleString()}`);
  output.push('');

  // Structure Analysis
  output.push(chalk.bold.underline('Structure Analysis'));
  output.push(`  ${analysis.structure.hasSystemContext ? chalk.green('✓') : chalk.red('✗')} System context/role defined`);
  output.push(`  ${analysis.structure.hasExamples ? chalk.green('✓') : chalk.red('✗')} Examples provided`);
  output.push(`  ${analysis.structure.hasConstraints ? chalk.green('✓') : chalk.red('✗')} Constraints/limitations defined`);
  output.push(`  ${analysis.structure.hasOutputFormat ? chalk.green('✓') : chalk.red('✗')} Output format specified`);

  if (analysis.structure.variableCount > 0) {
    output.push(`  ${chalk.cyan('Variables:')} ${analysis.structure.variables.join(', ')}`);
  }
  output.push('');

  // Issues
  if (analysis.issues.length > 0) {
    output.push(chalk.bold.underline('Issues Found'));
    for (const issue of analysis.issues) {
      const lineInfo = issue.line ? ` (line ${issue.line})` : '';
      output.push(`  ${formatIssueType(issue.type)} [${issue.category}]${lineInfo}`);
      output.push(`    ${issue.message}`);
    }
    output.push('');
  } else {
    output.push(chalk.green('No issues found!'));
    output.push('');
  }

  // AI Analysis
  if (analysis.aiAnalysis) {
    output.push(chalk.bold.underline('AI Analysis'));
    output.push(chalk.dim('─'.repeat(50)));
    output.push(analysis.aiAnalysis);
    output.push(chalk.dim('─'.repeat(50)));
  }

  return output.join('\n');
}

/**
 * Format suggestions output
 */
export function formatSuggestions(result: SuggestionsResult): string {
  const output: string[] = [];

  output.push(`${chalk.bold('File:')} ${result.file}`);
  if (result.goal) {
    output.push(`${chalk.bold('Goal:')} ${result.goal}`);
  }
  output.push('');

  if (result.summary) {
    output.push(chalk.bold.underline('Summary'));
    output.push(result.summary);
    output.push('');
  }

  output.push(chalk.bold.underline('Suggestions'));
  output.push('');

  for (const suggestion of result.suggestions) {
    output.push(formatSuggestion(suggestion));
    output.push('');
  }

  return output.join('\n');
}

/**
 * Format a single suggestion
 */
function formatSuggestion(suggestion: Suggestion): string {
  const output: string[] = [];

  output.push(`${chalk.bold.cyan(`#${suggestion.id}`)} ${chalk.bold(suggestion.category.toUpperCase())}`);
  output.push(`  ${suggestion.description}`);
  output.push(`  Impact: ${formatLevel(suggestion.impact, true)} | Effort: ${formatLevel(suggestion.effort, false)}`);

  if (suggestion.example) {
    output.push(`  ${chalk.dim('Example:')} ${chalk.italic(suggestion.example)}`);
  }

  return output.join('\n');
}

/**
 * Format rewrite result
 */
export function formatRewrite(result: RewriteResult): string {
  const output: string[] = [];

  output.push(`${chalk.bold('File:')} ${result.file}`);
  output.push(`${chalk.bold('Goal:')} ${result.goal}`);
  output.push('');

  // Token comparison
  const tokenDiff = result.tokensBefore - result.tokensAfter;
  const tokenPercent = Math.round((tokenDiff / result.tokensBefore) * 100);
  const tokenChange = tokenDiff >= 0
    ? chalk.green(`-${tokenDiff} tokens (${tokenPercent}% reduction)`)
    : chalk.red(`+${Math.abs(tokenDiff)} tokens (${Math.abs(tokenPercent)}% increase)`);

  output.push(chalk.bold.underline('Token Analysis'));
  output.push(`  Before: ${result.tokensBefore} tokens`);
  output.push(`  After:  ${result.tokensAfter} tokens`);
  output.push(`  Change: ${tokenChange}`);
  output.push('');

  // Changes made
  if (result.changes.length > 0) {
    output.push(chalk.bold.underline('Changes Made'));
    for (const change of result.changes) {
      output.push(`  ${chalk.cyan('•')} ${change}`);
    }
    output.push('');
  }

  // Original prompt
  output.push(chalk.bold.underline('Original Prompt'));
  output.push(chalk.dim('─'.repeat(50)));
  output.push(chalk.dim(result.original));
  output.push(chalk.dim('─'.repeat(50)));
  output.push('');

  // Rewritten prompt
  output.push(chalk.bold.underline('Rewritten Prompt'));
  output.push(chalk.dim('─'.repeat(50)));
  output.push(chalk.green(result.rewritten));
  output.push(chalk.dim('─'.repeat(50)));

  return output.join('\n');
}

/**
 * Different analysis strategies
 */
export const AnalysisStrategies = {
  /**
   * Analyze for token reduction opportunities
   */
  tokenReduction: (content: string): AnalysisIssue[] => {
    const issues: AnalysisIssue[] = [];

    // Check for wordy phrases that can be simplified
    const wordyPhrases: Record<string, string> = {
      'in order to': 'to',
      'due to the fact that': 'because',
      'at this point in time': 'now',
      'in the event that': 'if',
      'for the purpose of': 'to',
      'with regard to': 'about',
      'in spite of the fact that': 'although',
      'it is important to note that': '',
      'please note that': '',
    };

    for (const [phrase, replacement] of Object.entries(wordyPhrases)) {
      if (content.toLowerCase().includes(phrase)) {
        issues.push({
          type: 'suggestion',
          category: 'tokens',
          message: replacement
            ? `Replace "${phrase}" with "${replacement}" to save tokens.`
            : `Remove "${phrase}" - it adds no value.`,
        });
      }
    }

    return issues;
  },

  /**
   * Analyze for clarity improvements
   */
  clarity: (content: string): AnalysisIssue[] => {
    const issues: AnalysisIssue[] = [];

    // Check for passive voice (simplified check)
    const passivePatterns = [
      /is being \w+ed/gi,
      /was \w+ed by/gi,
      /will be \w+ed/gi,
    ];

    for (const pattern of passivePatterns) {
      if (pattern.test(content)) {
        issues.push({
          type: 'suggestion',
          category: 'clarity',
          message: 'Consider using active voice instead of passive voice for clearer instructions.',
        });
        break;
      }
    }

    // Check for unclear pronouns
    const unclearPronouns = /\b(it|this|that|they)\b(?!\s+(is|are|was|were|will|should|must|can))/gi;
    const pronounMatches = content.match(unclearPronouns);
    if (pronounMatches && pronounMatches.length > 5) {
      issues.push({
        type: 'suggestion',
        category: 'clarity',
        message: 'Many pronouns detected. Consider being more specific to avoid ambiguity.',
      });
    }

    return issues;
  },

  /**
   * Analyze prompt structure
   */
  structure: (content: string): AnalysisIssue[] => {
    const issues: AnalysisIssue[] = [];
    const lines = content.split('\n');

    // Check for section headers
    const hasHeaders = lines.some(line =>
      line.startsWith('#') || line.endsWith(':') || line.match(/^\[.+\]$/)
    );

    if (!hasHeaders && content.length > 500) {
      issues.push({
        type: 'suggestion',
        category: 'structure',
        message: 'Long prompt without section headers. Consider organizing with clear sections.',
      });
    }

    // Check for numbered instructions
    const hasNumbered = lines.some(line => /^\d+[\.\)]/.test(line.trim()));
    const hasBulleted = lines.some(line => /^[-*•]/.test(line.trim()));

    if (!hasNumbered && !hasBulleted && lines.length > 10) {
      issues.push({
        type: 'suggestion',
        category: 'structure',
        message: 'Consider using numbered or bulleted lists for multi-step instructions.',
      });
    }

    return issues;
  },

  /**
   * Analyze for examples and demonstrations
   */
  examples: (content: string): AnalysisIssue[] => {
    const issues: AnalysisIssue[] = [];
    const lowerContent = content.toLowerCase();

    // Check if the prompt asks for complex output but provides no examples
    const complexOutputIndicators = [
      'json', 'xml', 'format', 'structure', 'table', 'list',
    ];

    const hasComplexOutput = complexOutputIndicators.some(ind =>
      lowerContent.includes(ind)
    );

    const hasExamples = lowerContent.includes('example') ||
      lowerContent.includes('e.g.') ||
      content.includes('```') ||
      content.includes('"""');

    if (hasComplexOutput && !hasExamples) {
      issues.push({
        type: 'suggestion',
        category: 'examples',
        message: 'Prompt requests structured output but provides no examples. Add an example to improve consistency.',
      });
    }

    return issues;
  },
};

/**
 * Run all analysis strategies and combine results
 */
export function runAllAnalyzers(content: string): AnalysisIssue[] {
  const allIssues: AnalysisIssue[] = [];

  allIssues.push(...AnalysisStrategies.tokenReduction(content));
  allIssues.push(...AnalysisStrategies.clarity(content));
  allIssues.push(...AnalysisStrategies.structure(content));
  allIssues.push(...AnalysisStrategies.examples(content));

  return allIssues;
}
