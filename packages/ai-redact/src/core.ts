import * as fs from 'fs';
import { REDACTION_PATTERNS, RedactionPattern, getPatternByName, createCustomPattern, getAllPatterns } from './patterns';

export interface Redaction {
  patternName: string;
  category: string;
  original: string;
  replacement: string;
  position: {
    start: number;
    end: number;
    line?: number;
    column?: number;
  };
}

export interface RedactResult {
  original: string;
  redacted: string;
  redactions: Redaction[];
  summary: {
    totalRedactions: number;
    byPattern: Record<string, number>;
    byCategory: Record<string, number>;
    charactersRedacted: number;
  };
  preservedStructure: boolean;
}

export interface RedactOptions {
  patterns?: string[];
  customPatterns?: Array<{
    name: string;
    pattern: string;
    replacement?: string;
  }>;
  preserveWhitespace?: boolean;
  showOriginalLength?: boolean;
}

export class AIRedactor {
  private getActivePatterns(options?: RedactOptions): RedactionPattern[] {
    let patterns: RedactionPattern[] = [];

    if (options?.patterns && options.patterns.length > 0) {
      // Use only specified patterns
      for (const name of options.patterns) {
        const pattern = getPatternByName(name);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    } else {
      // Use all built-in patterns
      patterns = getAllPatterns();
    }

    // Add custom patterns
    if (options?.customPatterns) {
      for (const custom of options.customPatterns) {
        patterns.push(createCustomPattern(
          custom.name,
          custom.pattern,
          custom.replacement || `[${custom.name.toUpperCase()}]`
        ));
      }
    }

    return patterns;
  }

  private getLineAndColumn(text: string, position: number): { line: number; column: number } {
    const lines = text.slice(0, position).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  public redact(text: string, options?: RedactOptions): RedactResult {
    const patterns = this.getActivePatterns(options);
    const redactions: Redaction[] = [];

    // Collect all matches
    const allMatches: Array<{
      pattern: RedactionPattern;
      match: RegExpExecArray;
    }> = [];

    for (const pattern of patterns) {
      // Reset and clone regex
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        allMatches.push({ pattern, match });
      }
    }

    // Sort by position (reverse for replacement)
    allMatches.sort((a, b) => b.match.index - a.match.index);

    let redacted = text;
    let charactersRedacted = 0;

    // Apply redactions from end to start
    for (const { pattern, match } of allMatches) {
      const start = match.index;
      const end = start + match[0].length;
      const location = this.getLineAndColumn(text, start);

      let replacement = pattern.replacement;

      // Option to show original length
      if (options?.showOriginalLength) {
        replacement = `${pattern.replacement}(${match[0].length})`;
      }

      redactions.unshift({
        patternName: pattern.name,
        category: pattern.category,
        original: match[0],
        replacement,
        position: {
          start,
          end,
          line: location.line,
          column: location.column
        }
      });

      charactersRedacted += match[0].length;
      redacted = redacted.slice(0, start) + replacement + redacted.slice(end);
    }

    // Build summary
    const byPattern: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const redaction of redactions) {
      byPattern[redaction.patternName] = (byPattern[redaction.patternName] || 0) + 1;
      byCategory[redaction.category] = (byCategory[redaction.category] || 0) + 1;
    }

    return {
      original: text,
      redacted,
      redactions,
      summary: {
        totalRedactions: redactions.length,
        byPattern,
        byCategory,
        charactersRedacted
      },
      preservedStructure: true
    };
  }

  public redactFile(filePath: string, options?: RedactOptions): RedactResult & { file: string } {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = this.redact(content, options);
    return { ...result, file: filePath };
  }

  public redactAndSave(
    filePath: string,
    outputPath: string,
    options?: RedactOptions
  ): { success: boolean; result: RedactResult; outputPath: string } {
    const result = this.redactFile(filePath, options);
    fs.writeFileSync(outputPath, result.redacted);
    return { success: true, result, outputPath };
  }

  public getAvailablePatterns(): Array<{
    name: string;
    description: string;
    category: string;
  }> {
    return getAllPatterns().map(p => ({
      name: p.name,
      description: p.description,
      category: p.category
    }));
  }

  public previewRedactions(text: string, options?: RedactOptions): Array<{
    original: string;
    replacement: string;
    pattern: string;
    line: number;
    column: number;
  }> {
    const result = this.redact(text, options);
    return result.redactions.map(r => ({
      original: r.original,
      replacement: r.replacement,
      pattern: r.patternName,
      line: r.position.line || 0,
      column: r.position.column || 0
    }));
  }
}
