import * as fs from 'fs';
import { DEFAULT_PATTERNS, PatternDefinition, createCustomPattern } from './patterns';

export interface RedactionResult {
  original: string;
  sanitized: string;
  redactions: Redaction[];
  summary: RedactionSummary;
}

export interface Redaction {
  type: string;
  original: string;
  replacement: string;
  position: {
    start: number;
    end: number;
  };
  category: string;
  sensitivity: string;
}

export interface RedactionSummary {
  totalRedactions: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  bySensitivity: Record<string, number>;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface ScanResult {
  file?: string;
  detections: Detection[];
  summary: {
    totalDetections: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface Detection {
  type: string;
  value: string;
  position: {
    start: number;
    end: number;
    line?: number;
    column?: number;
  };
  category: string;
  sensitivity: string;
  context?: string;
}

export interface SanitizeOptions {
  patterns?: string[];
  excludePatterns?: string[];
  customPatterns?: Array<{
    name: string;
    pattern: string;
    replacement: string;
  }>;
  showContext?: boolean;
  contextLength?: number;
}

export class PromptSanitizer {
  private patterns: PatternDefinition[];

  constructor() {
    this.patterns = [...DEFAULT_PATTERNS];
  }

  private getActivePatterns(options?: SanitizeOptions): PatternDefinition[] {
    let patterns = [...this.patterns];

    // Add custom patterns
    if (options?.customPatterns) {
      for (const custom of options.customPatterns) {
        patterns.push(createCustomPattern(custom.name, custom.pattern, custom.replacement));
      }
    }

    // Filter to specific patterns if specified
    if (options?.patterns && options.patterns.length > 0) {
      patterns = patterns.filter(p => options.patterns!.includes(p.name));
    }

    // Exclude patterns
    if (options?.excludePatterns && options.excludePatterns.length > 0) {
      patterns = patterns.filter(p => !options.excludePatterns!.includes(p.name));
    }

    return patterns;
  }

  private calculateRiskLevel(
    bySensitivity: Record<string, number>
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const high = bySensitivity['high'] || 0;
    const medium = bySensitivity['medium'] || 0;
    const low = bySensitivity['low'] || 0;

    if (high >= 3) return 'critical';
    if (high >= 1) return 'high';
    if (medium >= 3) return 'high';
    if (medium >= 1) return 'medium';
    if (low >= 1) return 'low';
    return 'none';
  }

  public sanitize(text: string, options?: SanitizeOptions): RedactionResult {
    const patterns = this.getActivePatterns(options);
    const redactions: Redaction[] = [];

    let sanitized = text;
    let offset = 0;

    // Collect all matches first
    const allMatches: Array<{
      pattern: PatternDefinition;
      match: RegExpExecArray;
    }> = [];

    for (const pattern of patterns) {
      // Reset regex state
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        allMatches.push({ pattern, match });
      }
    }

    // Sort by position (reverse order for replacement)
    allMatches.sort((a, b) => b.match.index - a.match.index);

    // Apply replacements from end to start to maintain positions
    for (const { pattern, match } of allMatches) {
      const start = match.index;
      const end = start + match[0].length;

      redactions.unshift({
        type: pattern.name,
        original: match[0],
        replacement: pattern.replacement,
        position: { start, end },
        category: pattern.category,
        sensitivity: pattern.sensitivity
      });

      sanitized = sanitized.slice(0, start) + pattern.replacement + sanitized.slice(end);
    }

    // Build summary
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySensitivity: Record<string, number> = {};

    for (const redaction of redactions) {
      byType[redaction.type] = (byType[redaction.type] || 0) + 1;
      byCategory[redaction.category] = (byCategory[redaction.category] || 0) + 1;
      bySensitivity[redaction.sensitivity] = (bySensitivity[redaction.sensitivity] || 0) + 1;
    }

    return {
      original: text,
      sanitized,
      redactions,
      summary: {
        totalRedactions: redactions.length,
        byType,
        byCategory,
        bySensitivity,
        riskLevel: this.calculateRiskLevel(bySensitivity)
      }
    };
  }

  public scan(text: string, options?: SanitizeOptions): ScanResult {
    const patterns = this.getActivePatterns(options);
    const detections: Detection[] = [];
    const contextLength = options?.contextLength || 20;

    // Calculate line positions for better reporting
    const lines = text.split('\n');
    const lineStarts: number[] = [0];
    for (let i = 0; i < lines.length - 1; i++) {
      lineStarts.push(lineStarts[i] + lines[i].length + 1);
    }

    const getLineAndColumn = (position: number): { line: number; column: number } => {
      let line = 0;
      for (let i = 0; i < lineStarts.length; i++) {
        if (lineStarts[i] <= position) {
          line = i;
        } else {
          break;
        }
      }
      return { line: line + 1, column: position - lineStarts[line] + 1 };
    };

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const { line, column } = getLineAndColumn(start);

        let context: string | undefined;
        if (options?.showContext) {
          const contextStart = Math.max(0, start - contextLength);
          const contextEnd = Math.min(text.length, end + contextLength);
          context = (contextStart > 0 ? '...' : '') +
            text.slice(contextStart, start) +
            `[${match[0]}]` +
            text.slice(end, contextEnd) +
            (contextEnd < text.length ? '...' : '');
        }

        detections.push({
          type: pattern.name,
          value: match[0],
          position: { start, end, line, column },
          category: pattern.category,
          sensitivity: pattern.sensitivity,
          context
        });
      }
    }

    // Sort by position
    detections.sort((a, b) => a.position.start - b.position.start);

    // Build summary
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const bySensitivity: Record<string, number> = {};

    for (const detection of detections) {
      byType[detection.type] = (byType[detection.type] || 0) + 1;
      byCategory[detection.category] = (byCategory[detection.category] || 0) + 1;
      bySensitivity[detection.sensitivity] = (bySensitivity[detection.sensitivity] || 0) + 1;
    }

    return {
      detections,
      summary: {
        totalDetections: detections.length,
        byType,
        byCategory,
        riskLevel: this.calculateRiskLevel(bySensitivity)
      }
    };
  }

  public cleanFile(filePath: string, options?: SanitizeOptions): RedactionResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.sanitize(content, options);
  }

  public scanFile(filePath: string, options?: SanitizeOptions): ScanResult {
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = this.scan(content, options);
    result.file = filePath;
    return result;
  }

  public getAvailablePatterns(): Array<{
    name: string;
    description: string;
    category: string;
    sensitivity: string;
  }> {
    return this.patterns.map(p => ({
      name: p.name,
      description: p.description,
      category: p.category,
      sensitivity: p.sensitivity
    }));
  }

  public addCustomPattern(
    name: string,
    pattern: string,
    replacement: string,
    description?: string
  ): void {
    this.patterns.push(createCustomPattern(name, pattern, replacement, description));
  }
}
