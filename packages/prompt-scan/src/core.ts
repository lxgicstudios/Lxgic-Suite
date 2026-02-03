import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

export interface Vulnerability {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  recommendation?: string;
  line?: number;
  file?: string;
}

export interface ScanResult {
  score: number;
  vulnerabilities: Vulnerability[];
  recommendations: string[];
}

export interface DirectoryScanResult {
  filesScanned: number;
  vulnerabilities: (Vulnerability & { file: string })[];
}

export interface CodeScanResult {
  filesScanned: number;
  risks: {
    file: string;
    line: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    code: string;
  }[];
}

// Injection patterns to detect
const INJECTION_PATTERNS = [
  {
    pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
    type: 'instruction-override',
    severity: 'critical' as const,
    description: 'Attempts to override previous instructions',
  },
  {
    pattern: /system\s*:\s*you\s+are/i,
    type: 'role-injection',
    severity: 'critical' as const,
    description: 'Attempts to inject a new system role',
  },
  {
    pattern: /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>/i,
    type: 'format-injection',
    severity: 'high' as const,
    description: 'Contains model-specific format tokens',
  },
  {
    pattern: /pretend\s+(you\s+are|to\s+be|that)/i,
    type: 'roleplay-injection',
    severity: 'medium' as const,
    description: 'Attempts to manipulate AI identity',
  },
  {
    pattern: /do\s+not\s+(follow|obey|listen)/i,
    type: 'override-attempt',
    severity: 'high' as const,
    description: 'Attempts to bypass safety guidelines',
  },
  {
    pattern: /jailbreak|DAN|evil\s+mode/i,
    type: 'jailbreak-attempt',
    severity: 'critical' as const,
    description: 'Known jailbreak terminology detected',
  },
  {
    pattern: /\{\{.*\}\}/,
    type: 'template-injection',
    severity: 'medium' as const,
    description: 'Unescaped template syntax that could allow injection',
  },
  {
    pattern: /\$\{.*\}|`.*`/,
    type: 'code-injection',
    severity: 'medium' as const,
    description: 'Potential code/template literal injection',
  },
];

// Code patterns that indicate risky prompt construction
const CODE_RISK_PATTERNS = [
  {
    pattern: /prompt\s*[+=]\s*.*\+.*user/i,
    description: 'String concatenation with user input in prompt',
    severity: 'high' as const,
  },
  {
    pattern: /`[^`]*\$\{.*input.*\}[^`]*`/i,
    description: 'Template literal with user input interpolation',
    severity: 'high' as const,
  },
  {
    pattern: /f["'][^"']*\{.*input.*\}[^"']*["']/i,
    description: 'Python f-string with user input (potential injection)',
    severity: 'high' as const,
  },
  {
    pattern: /\.format\(.*input/i,
    description: 'String format with user input',
    severity: 'medium' as const,
  },
  {
    pattern: /eval\s*\(|exec\s*\(/i,
    description: 'Dynamic code execution near prompt construction',
    severity: 'critical' as const,
  },
];

export async function scanPrompt(content: string, strict: boolean = false): Promise<ScanResult> {
  const vulnerabilities: Vulnerability[] = [];
  const recommendations: string[] = [];

  const lines = content.split('\n');

  for (const patternDef of INJECTION_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (patternDef.pattern.test(lines[i])) {
        vulnerabilities.push({
          type: patternDef.type,
          severity: patternDef.severity,
          description: patternDef.description,
          line: i + 1,
        });
      }
    }
  }

  // Check for missing safety measures
  if (!content.toLowerCase().includes('do not') && !content.toLowerCase().includes('never')) {
    if (strict) {
      recommendations.push('Consider adding explicit constraints on what the AI should not do');
    }
  }

  // Check for clear role definition
  if (!content.toLowerCase().includes('you are') && !content.toLowerCase().includes('your role')) {
    recommendations.push('Consider adding a clear role definition at the start');
  }

  // Check for input validation markers
  if (content.includes('{{') || content.includes('${')) {
    recommendations.push('Ensure all template variables are properly sanitized before interpolation');
  }

  // Calculate security score
  let score = 100;
  for (const vuln of vulnerabilities) {
    switch (vuln.severity) {
      case 'critical': score -= 30; break;
      case 'high': score -= 20; break;
      case 'medium': score -= 10; break;
      case 'low': score -= 5; break;
    }
  }
  score = Math.max(0, score);

  return {
    score,
    vulnerabilities,
    recommendations,
  };
}

export async function scanDirectory(
  directory: string,
  pattern: string,
  strict: boolean = false
): Promise<DirectoryScanResult> {
  const vulnerabilities: (Vulnerability & { file: string })[] = [];
  let filesScanned = 0;

  function walkDir(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...walkDir(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (['.txt', '.md', '.prompt'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
    return files;
  }

  const files = walkDir(directory);

  for (const file of files) {
    filesScanned++;
    const content = fs.readFileSync(file, 'utf-8');
    const result = await scanPrompt(content, strict);

    for (const vuln of result.vulnerabilities) {
      vulnerabilities.push({
        ...vuln,
        file: path.relative(directory, file),
      });
    }
  }

  return {
    filesScanned,
    vulnerabilities,
  };
}

export async function scanCode(directory: string, language: string): Promise<CodeScanResult> {
  const risks: CodeScanResult['risks'] = [];
  let filesScanned = 0;

  const extensions: Record<string, string[]> = {
    js: ['.js', '.jsx'],
    ts: ['.ts', '.tsx'],
    py: ['.py'],
  };

  const exts = extensions[language] || extensions.ts;

  function walkDir(dir: string): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...walkDir(fullPath));
        } else if (entry.isFile() && exts.includes(path.extname(entry.name))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore permission errors
    }
    return files;
  }

  const files = walkDir(directory);

  for (const file of files) {
    filesScanned++;
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const riskPattern of CODE_RISK_PATTERNS) {
        if (riskPattern.pattern.test(line)) {
          risks.push({
            file: path.relative(directory, file),
            line: i + 1,
            severity: riskPattern.severity,
            description: riskPattern.description,
            code: line.trim().substring(0, 80),
          });
        }
      }
    }
  }

  return {
    filesScanned,
    risks,
  };
}

export async function generateReport(format: string): Promise<string> {
  if (format === 'json') {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      tool: 'prompt-scan',
      version: '1.0.0',
      patterns: INJECTION_PATTERNS.map(p => ({
        type: p.type,
        severity: p.severity,
        description: p.description,
      })),
    }, null, 2);
  }

  const lines: string[] = [];
  lines.push('Prompt Security Scan Report');
  lines.push('='.repeat(50));
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Detected Pattern Types:');
  lines.push('-'.repeat(30));

  for (const pattern of INJECTION_PATTERNS) {
    lines.push(`[${pattern.severity.toUpperCase()}] ${pattern.type}`);
    lines.push(`  ${pattern.description}`);
  }

  lines.push('');
  lines.push('Code Risk Patterns:');
  lines.push('-'.repeat(30));

  for (const risk of CODE_RISK_PATTERNS) {
    lines.push(`[${risk.severity.toUpperCase()}] ${risk.description}`);
  }

  return lines.join('\n');
}
