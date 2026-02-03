import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const ClaimSchema = z.object({
  text: z.string(),
  type: z.enum(['factual', 'statistical', 'quoted', 'definitional', 'temporal', 'relational']),
  confidence: z.number(),
  verified: z.boolean(),
  supportingSource: z.string().optional(),
  explanation: z.string()
});

export type Claim = z.infer<typeof ClaimSchema>;

export const VerificationResultSchema = z.object({
  output: z.string(),
  totalClaims: z.number(),
  verifiedClaims: z.number(),
  unverifiedClaims: z.number(),
  hallucinationScore: z.number(),
  claims: z.array(ClaimSchema),
  sources: z.array(z.string()),
  timestamp: z.string()
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export interface SourceDocument {
  path: string;
  content: string;
  name: string;
}

export interface DetectorOptions {
  sources?: string;
  model?: string;
  strictMode?: boolean;
}

export class HallucinationDetector {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic();
    }
  }

  async loadSourceDocuments(sourcesPath: string): Promise<SourceDocument[]> {
    const documents: SourceDocument[] = [];

    const loadDir = (dir: string): void => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          loadDir(fullPath);
        } else if (/\.(txt|md|json|yaml|yml|html)$/i.test(file)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            documents.push({
              path: fullPath,
              content,
              name: file
            });
          } catch {
            // Skip unreadable files
          }
        }
      }
    };

    const stat = fs.statSync(sourcesPath);
    if (stat.isDirectory()) {
      loadDir(sourcesPath);
    } else {
      const content = fs.readFileSync(sourcesPath, 'utf-8');
      documents.push({
        path: sourcesPath,
        content,
        name: path.basename(sourcesPath)
      });
    }

    return documents;
  }

  extractClaims(text: string): string[] {
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    const claims: string[] = [];

    for (const sentence of sentences) {
      // Look for factual statements
      if (this.containsFactualIndicators(sentence)) {
        claims.push(sentence);
      }
    }

    return claims;
  }

  private containsFactualIndicators(sentence: string): boolean {
    const indicators = [
      /\b(is|are|was|were|has|have|had)\b/i,
      /\b(according to|states that|reports|confirms)\b/i,
      /\b(percent|%|number|total|count)\b/i,
      /\b(in \d{4}|on \w+ \d+|since|before|after)\b/i,
      /\b(always|never|every|all|none)\b/i,
      /\b(defined as|known as|called|named)\b/i,
      /\d+/,
      /"[^"]+"/
    ];

    return indicators.some(pattern => pattern.test(sentence));
  }

  async verifyClaimsWithSources(
    claims: string[],
    sources: SourceDocument[],
    options: DetectorOptions
  ): Promise<Claim[]> {
    const verifiedClaims: Claim[] = [];
    const sourceContent = sources.map(s => `[${s.name}]\n${s.content}`).join('\n\n---\n\n');

    if (!this.client) {
      // Simulate verification
      return this.simulateVerification(claims, sources);
    }

    for (const claimText of claims) {
      try {
        const prompt = `You are a fact-checker. Verify if the following claim is supported by the source documents.

Claim: "${claimText}"

Source Documents:
${sourceContent.substring(0, 10000)}

Respond in JSON format:
{
  "verified": true or false,
  "type": "factual" | "statistical" | "quoted" | "definitional" | "temporal" | "relational",
  "confidence": 0.0 to 1.0,
  "supportingSource": "name of source if found" or null,
  "explanation": "brief explanation of verification"
}`;

        const response = await this.client.messages.create({
          model: options.model || 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        });

        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('');

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          verifiedClaims.push({
            text: claimText,
            type: parsed.type || 'factual',
            confidence: parsed.confidence || 0.5,
            verified: parsed.verified || false,
            supportingSource: parsed.supportingSource,
            explanation: parsed.explanation || 'No explanation provided'
          });
        } else {
          verifiedClaims.push({
            text: claimText,
            type: 'factual',
            confidence: 0.5,
            verified: false,
            explanation: 'Could not parse verification result'
          });
        }
      } catch (error) {
        verifiedClaims.push({
          text: claimText,
          type: 'factual',
          confidence: 0,
          verified: false,
          explanation: `Verification error: ${(error as Error).message}`
        });
      }
    }

    return verifiedClaims;
  }

  private simulateVerification(claims: string[], sources: SourceDocument[]): Claim[] {
    return claims.map(claim => {
      const matchingSource = sources.find(s =>
        s.content.toLowerCase().includes(claim.toLowerCase().substring(0, 20))
      );

      return {
        text: claim,
        type: 'factual' as const,
        confidence: matchingSource ? 0.8 : 0.3,
        verified: !!matchingSource,
        supportingSource: matchingSource?.name,
        explanation: matchingSource
          ? `Found supporting text in ${matchingSource.name}`
          : 'No supporting source found (simulated)'
      };
    });
  }

  async checkWithoutSources(
    text: string,
    options: DetectorOptions
  ): Promise<Claim[]> {
    const claims = this.extractClaims(text);

    if (!this.client) {
      // Return simulated results
      return claims.map(claim => ({
        text: claim,
        type: 'factual' as const,
        confidence: 0.5,
        verified: false,
        explanation: 'Cannot verify without API key. Set ANTHROPIC_API_KEY.'
      }));
    }

    const verifiedClaims: Claim[] = [];

    for (const claimText of claims) {
      try {
        const prompt = `Analyze this claim for potential hallucination or factual inaccuracy. Consider if this could be:
1. A fabricated fact
2. A misattributed statement
3. An anachronism
4. A statistical error
5. A logical impossibility

Claim: "${claimText}"

Respond in JSON format:
{
  "type": "factual" | "statistical" | "quoted" | "definitional" | "temporal" | "relational",
  "confidence": 0.0 to 1.0 (how confident are you in your assessment),
  "likelyAccurate": true or false,
  "explanation": "brief explanation"
}`;

        const response = await this.client.messages.create({
          model: options.model || 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        });

        const responseText = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('');

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          verifiedClaims.push({
            text: claimText,
            type: parsed.type || 'factual',
            confidence: parsed.confidence || 0.5,
            verified: parsed.likelyAccurate || false,
            explanation: parsed.explanation || 'No explanation provided'
          });
        } else {
          verifiedClaims.push({
            text: claimText,
            type: 'factual',
            confidence: 0.5,
            verified: false,
            explanation: 'Could not parse verification result'
          });
        }
      } catch (error) {
        verifiedClaims.push({
          text: claimText,
          type: 'factual',
          confidence: 0,
          verified: false,
          explanation: `Check error: ${(error as Error).message}`
        });
      }
    }

    return verifiedClaims;
  }

  async verify(
    outputText: string,
    options: DetectorOptions
  ): Promise<VerificationResult> {
    let claims: Claim[];
    const sources: string[] = [];

    if (options.sources) {
      const sourceDocuments = await this.loadSourceDocuments(options.sources);
      sources.push(...sourceDocuments.map(s => s.path));
      const claimTexts = this.extractClaims(outputText);
      claims = await this.verifyClaimsWithSources(claimTexts, sourceDocuments, options);
    } else {
      claims = await this.checkWithoutSources(outputText, options);
    }

    const verifiedCount = claims.filter(c => c.verified).length;
    const totalCount = Math.max(claims.length, 1);
    const hallucinationScore = 1 - (verifiedCount / totalCount);

    return {
      output: outputText,
      totalClaims: claims.length,
      verifiedClaims: verifiedCount,
      unverifiedClaims: claims.length - verifiedCount,
      hallucinationScore: Math.round(hallucinationScore * 100) / 100,
      claims,
      sources,
      timestamp: new Date().toISOString()
    };
  }
}

export function formatVerificationReport(result: VerificationResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  HALLUCINATION CHECK REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`  Generated: ${result.timestamp}`);
  lines.push(`  Sources: ${result.sources.length > 0 ? result.sources.join(', ') : 'None'}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('  SUMMARY');
  lines.push('-'.repeat(60));
  lines.push(`  Total Claims:      ${result.totalClaims}`);
  lines.push(`  Verified Claims:   ${result.verifiedClaims}`);
  lines.push(`  Unverified Claims: ${result.unverifiedClaims}`);
  lines.push(`  Hallucination Risk: ${(result.hallucinationScore * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('  CLAIMS ANALYSIS');
  lines.push('-'.repeat(60));

  for (const claim of result.claims) {
    const status = claim.verified ? '[VERIFIED]' : '[FLAGGED]';
    const confidence = `(${(claim.confidence * 100).toFixed(0)}% confidence)`;

    lines.push('');
    lines.push(`  ${status} ${confidence}`);
    lines.push(`  Claim: "${claim.text.substring(0, 100)}${claim.text.length > 100 ? '...' : ''}"`);
    lines.push(`  Type: ${claim.type}`);
    lines.push(`  ${claim.explanation}`);
    if (claim.supportingSource) {
      lines.push(`  Source: ${claim.supportingSource}`);
    }
  }

  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}
