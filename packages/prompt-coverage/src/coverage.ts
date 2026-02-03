import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

export const CoverageResultSchema = z.object({
  totalVariations: z.number(),
  testedVariations: z.number(),
  coveragePercentage: z.number(),
  variations: z.array(z.object({
    name: z.string(),
    tested: z.boolean(),
    testFile: z.string().optional(),
    assertions: z.number().optional()
  })),
  timestamp: z.string(),
  testsDir: z.string()
});

export type CoverageResult = z.infer<typeof CoverageResultSchema>;

export interface PromptVariation {
  name: string;
  file: string;
  parameters: string[];
  templates: string[];
}

export interface TestCase {
  file: string;
  variations: string[];
  assertions: number;
}

export class CoverageAnalyzer {
  private testsDir: string;
  private promptsDir: string;

  constructor(testsDir: string, promptsDir: string = '') {
    this.testsDir = testsDir;
    this.promptsDir = promptsDir || testsDir;
  }

  async findPromptVariations(): Promise<PromptVariation[]> {
    const variations: PromptVariation[] = [];

    const findFiles = (dir: string, pattern: RegExp): string[] => {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          results.push(...findFiles(fullPath, pattern));
        } else if (pattern.test(file)) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const promptFiles = findFiles(this.promptsDir, /\.(prompt|txt|md|json)$/);

    for (const file of promptFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const parameters = this.extractParameters(content);
      const templates = this.extractTemplates(content);

      variations.push({
        name: path.basename(file, path.extname(file)),
        file,
        parameters,
        templates
      });
    }

    // Also look for variations defined in test files
    const testFiles = findFiles(this.testsDir, /\.(test|spec)\.(ts|js)$/);
    for (const file of testFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const definedVariations = this.extractVariationDefinitions(content);

      for (const variation of definedVariations) {
        if (!variations.find(v => v.name === variation)) {
          variations.push({
            name: variation,
            file: file,
            parameters: [],
            templates: []
          });
        }
      }
    }

    return variations;
  }

  private extractParameters(content: string): string[] {
    const params: string[] = [];
    const regex = /\{\{(\w+)\}\}|\$\{(\w+)\}|%\{(\w+)\}/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const param = match[1] || match[2] || match[3];
      if (param && !params.includes(param)) {
        params.push(param);
      }
    }

    return params;
  }

  private extractTemplates(content: string): string[] {
    const templates: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.includes('{{') || line.includes('${') || line.includes('%{')) {
        templates.push(line.trim());
      }
    }

    return templates;
  }

  private extractVariationDefinitions(content: string): string[] {
    const variations: string[] = [];

    // Look for variation definitions in test files
    const patterns = [
      /['"]variation['"]:\s*['"]([^'"]+)['"]/g,
      /testVariation\(['"]([^'"]+)['"]/g,
      /describe\(['"]([^'"]+)['"]/g,
      /it\(['"]tests?\s+([^'"]+)['"]/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (!variations.includes(match[1])) {
          variations.push(match[1]);
        }
      }
    }

    return variations;
  }

  async findTestedVariations(): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    const findFiles = (dir: string): string[] => {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          results.push(...findFiles(fullPath));
        } else if (/\.(test|spec)\.(ts|js)$/.test(file)) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const testFiles = findFiles(this.testsDir);

    for (const file of testFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const variations = this.extractTestedVariations(content);
      const assertions = this.countAssertions(content);

      testCases.push({
        file,
        variations,
        assertions
      });
    }

    return testCases;
  }

  private extractTestedVariations(content: string): string[] {
    const variations: string[] = [];

    const patterns = [
      /test(?:Prompt|Variation)?\(['"]([^'"]+)['"]/g,
      /expect\(.*?['"]([^'"]+)['"]/g,
      /prompt:\s*['"]([^'"]+)['"]/g,
      /variation:\s*['"]([^'"]+)['"]/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (!variations.includes(match[1])) {
          variations.push(match[1]);
        }
      }
    }

    return variations;
  }

  private countAssertions(content: string): number {
    const assertPatterns = [
      /expect\(/g,
      /assert\(/g,
      /should\./g,
      /\.toBe\(/g,
      /\.toEqual\(/g,
      /\.toContain\(/g,
      /\.toMatch\(/g
    ];

    let count = 0;
    for (const pattern of assertPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  async calculateCoverage(): Promise<CoverageResult> {
    const variations = await this.findPromptVariations();
    const testCases = await this.findTestedVariations();

    const testedVariationNames = new Set<string>();
    const variationTestMap = new Map<string, { testFile: string; assertions: number }>();

    for (const testCase of testCases) {
      for (const variation of testCase.variations) {
        testedVariationNames.add(variation);
        variationTestMap.set(variation, {
          testFile: testCase.file,
          assertions: testCase.assertions
        });
      }
    }

    const coverageVariations = variations.map(v => {
      const testInfo = variationTestMap.get(v.name);
      return {
        name: v.name,
        tested: testedVariationNames.has(v.name) || testInfo !== undefined,
        testFile: testInfo?.testFile,
        assertions: testInfo?.assertions
      };
    });

    const testedCount = coverageVariations.filter(v => v.tested).length;
    const totalCount = Math.max(coverageVariations.length, 1);
    const coveragePercentage = Math.round((testedCount / totalCount) * 100);

    return {
      totalVariations: totalCount,
      testedVariations: testedCount,
      coveragePercentage,
      variations: coverageVariations,
      timestamp: new Date().toISOString(),
      testsDir: this.testsDir
    };
  }

  generateBadge(coverage: number): string {
    let color: string;
    if (coverage >= 80) {
      color = 'brightgreen';
    } else if (coverage >= 60) {
      color = 'yellow';
    } else if (coverage >= 40) {
      color = 'orange';
    } else {
      color = 'red';
    }

    return `https://img.shields.io/badge/prompt%20coverage-${coverage}%25-${color}`;
  }

  generateBadgeSVG(coverage: number): string {
    let color: string;
    if (coverage >= 80) {
      color = '#4c1';
    } else if (coverage >= 60) {
      color = '#dfb317';
    } else if (coverage >= 40) {
      color = '#fe7d37';
    } else {
      color = '#e05d44';
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="140" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <path fill="#555" d="M0 0h90v20H0z"/>
    <path fill="${color}" d="M90 0h50v20H90z"/>
    <path fill="url(#b)" d="M0 0h140v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="45" y="15" fill="#010101" fill-opacity=".3">coverage</text>
    <text x="45" y="14">coverage</text>
    <text x="114" y="15" fill="#010101" fill-opacity=".3">${coverage}%</text>
    <text x="114" y="14">${coverage}%</text>
  </g>
</svg>`;
  }
}

export function formatCoverageReport(result: CoverageResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  PROMPT COVERAGE REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`  Tests Directory: ${result.testsDir}`);
  lines.push(`  Generated: ${result.timestamp}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('  SUMMARY');
  lines.push('-'.repeat(60));
  lines.push(`  Total Variations:  ${result.totalVariations}`);
  lines.push(`  Tested Variations: ${result.testedVariations}`);
  lines.push(`  Coverage:          ${result.coveragePercentage}%`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('  VARIATIONS');
  lines.push('-'.repeat(60));

  for (const variation of result.variations) {
    const status = variation.tested ? '[x]' : '[ ]';
    const assertions = variation.assertions ? ` (${variation.assertions} assertions)` : '';
    lines.push(`  ${status} ${variation.name}${assertions}`);
    if (variation.testFile) {
      lines.push(`      └── ${variation.testFile}`);
    }
  }

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}
