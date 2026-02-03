import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const ConsistencyResultSchema = z.object({
  prompt: z.string(),
  runs: z.number(),
  outputs: z.array(z.string()),
  consistencyScore: z.number(),
  variableSections: z.array(z.object({
    position: z.number(),
    content: z.array(z.string()),
    variability: z.number()
  })),
  analysis: z.object({
    semanticSimilarity: z.number(),
    structuralSimilarity: z.number(),
    lexicalSimilarity: z.number(),
    lengthVariance: z.number()
  }),
  temperatureImpact: z.object({
    temperature: z.number(),
    recommendation: z.string()
  }).optional(),
  timestamp: z.string()
});

export type ConsistencyResult = z.infer<typeof ConsistencyResultSchema>;

export interface AnalyzerOptions {
  runs: number;
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

export interface VariableSection {
  position: number;
  content: string[];
  variability: number;
}

export class ConsistencyAnalyzer {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic();
    }
  }

  async runPromptMultipleTimes(
    prompt: string,
    options: AnalyzerOptions
  ): Promise<string[]> {
    if (!this.client) {
      // Return simulated outputs for demonstration
      return this.simulateOutputs(prompt, options.runs);
    }

    const outputs: string[] = [];

    for (let i = 0; i < options.runs; i++) {
      try {
        const response = await this.client.messages.create({
          model: options.model || 'claude-sonnet-4-20250514',
          max_tokens: options.maxTokens || 1024,
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature
        });

        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map(block => block.text)
          .join('');

        outputs.push(text);
      } catch (error) {
        outputs.push(`[Error on run ${i + 1}: ${(error as Error).message}]`);
      }
    }

    return outputs;
  }

  private simulateOutputs(prompt: string, runs: number): string[] {
    const baseResponse = `This is a simulated response to: "${prompt.substring(0, 50)}..."`;
    const outputs: string[] = [];

    for (let i = 0; i < runs; i++) {
      const variation = Math.random() > 0.7 ? ` (Variation ${i + 1})` : '';
      outputs.push(baseResponse + variation);
    }

    return outputs;
  }

  calculateLexicalSimilarity(outputs: string[]): number {
    if (outputs.length < 2) return 1;

    const tokenize = (text: string): Set<string> => {
      return new Set(
        text.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 0)
      );
    };

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        const tokens1 = tokenize(outputs[i]);
        const tokens2 = tokenize(outputs[j]);

        const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
        const union = new Set([...tokens1, ...tokens2]);

        const jaccardSimilarity = union.size > 0
          ? intersection.size / union.size
          : 1;

        totalSimilarity += jaccardSimilarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1;
  }

  calculateStructuralSimilarity(outputs: string[]): number {
    if (outputs.length < 2) return 1;

    const getStructure = (text: string): string[] => {
      const lines = text.split('\n');
      return lines.map(line => {
        if (/^#{1,6}\s/.test(line)) return 'heading';
        if (/^\d+\.\s/.test(line)) return 'numbered-list';
        if (/^[-*]\s/.test(line)) return 'bullet-list';
        if (/^```/.test(line)) return 'code-block';
        if (/^\s*$/.test(line)) return 'empty';
        return 'paragraph';
      });
    };

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        const struct1 = getStructure(outputs[i]);
        const struct2 = getStructure(outputs[j]);

        const maxLen = Math.max(struct1.length, struct2.length);
        const minLen = Math.min(struct1.length, struct2.length);

        let matches = 0;
        for (let k = 0; k < minLen; k++) {
          if (struct1[k] === struct2[k]) matches++;
        }

        const similarity = maxLen > 0 ? matches / maxLen : 1;
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1;
  }

  calculateLengthVariance(outputs: string[]): number {
    if (outputs.length < 2) return 0;

    const lengths = outputs.map(o => o.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    // Normalize to 0-1 where 0 means high variance
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
    return Math.min(coefficientOfVariation, 1);
  }

  findVariableSections(outputs: string[]): VariableSection[] {
    if (outputs.length < 2) return [];

    const variableSections: VariableSection[] = [];
    const sentences = outputs.map(o =>
      o.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)
    );

    const maxSentences = Math.max(...sentences.map(s => s.length));

    for (let pos = 0; pos < maxSentences; pos++) {
      const sentencesAtPos = sentences
        .map(s => s[pos] || '')
        .filter(s => s.length > 0);

      if (sentencesAtPos.length < 2) continue;

      const uniqueSentences = [...new Set(sentencesAtPos)];
      const variability = 1 - (1 / uniqueSentences.length);

      if (variability > 0) {
        variableSections.push({
          position: pos,
          content: uniqueSentences,
          variability
        });
      }
    }

    return variableSections.sort((a, b) => b.variability - a.variability);
  }

  async calculateSemanticSimilarity(outputs: string[]): Promise<number> {
    if (outputs.length < 2) return 1;

    if (!this.client) {
      // Fallback to lexical similarity when no API key
      return this.calculateLexicalSimilarity(outputs);
    }

    try {
      const prompt = `Compare these ${outputs.length} text outputs for semantic similarity.
Rate the overall semantic similarity on a scale of 0 to 1, where:
- 1.0 means they convey exactly the same meaning
- 0.0 means they are completely different in meaning

Outputs:
${outputs.map((o, i) => `--- Output ${i + 1} ---\n${o.substring(0, 500)}`).join('\n\n')}

Respond with ONLY a number between 0 and 1.`;

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      const score = parseFloat(text.trim());
      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    } catch {
      return this.calculateLexicalSimilarity(outputs);
    }
  }

  async analyzeConsistency(
    prompt: string,
    options: AnalyzerOptions
  ): Promise<ConsistencyResult> {
    const outputs = await this.runPromptMultipleTimes(prompt, options);

    const lexicalSimilarity = this.calculateLexicalSimilarity(outputs);
    const structuralSimilarity = this.calculateStructuralSimilarity(outputs);
    const semanticSimilarity = await this.calculateSemanticSimilarity(outputs);
    const lengthVariance = this.calculateLengthVariance(outputs);

    const variableSections = this.findVariableSections(outputs);

    // Weighted average for overall consistency score
    const consistencyScore = (
      semanticSimilarity * 0.4 +
      lexicalSimilarity * 0.3 +
      structuralSimilarity * 0.2 +
      (1 - lengthVariance) * 0.1
    );

    const temperatureImpact = this.analyzeTemperatureImpact(
      consistencyScore,
      options.temperature || 1
    );

    return {
      prompt,
      runs: options.runs,
      outputs,
      consistencyScore: Math.round(consistencyScore * 100) / 100,
      variableSections,
      analysis: {
        semanticSimilarity: Math.round(semanticSimilarity * 100) / 100,
        structuralSimilarity: Math.round(structuralSimilarity * 100) / 100,
        lexicalSimilarity: Math.round(lexicalSimilarity * 100) / 100,
        lengthVariance: Math.round(lengthVariance * 100) / 100
      },
      temperatureImpact,
      timestamp: new Date().toISOString()
    };
  }

  private analyzeTemperatureImpact(
    consistencyScore: number,
    temperature: number
  ): { temperature: number; recommendation: string } {
    let recommendation: string;

    if (consistencyScore >= 0.9) {
      recommendation = 'Current temperature provides excellent consistency. No changes needed.';
    } else if (consistencyScore >= 0.7) {
      if (temperature > 0.5) {
        recommendation = 'Consider lowering temperature for more consistent outputs.';
      } else {
        recommendation = 'Good consistency at current temperature.';
      }
    } else if (consistencyScore >= 0.5) {
      recommendation = `Temperature ${temperature} may be too high. Try reducing to ${Math.max(0, temperature - 0.3).toFixed(1)} for better consistency.`;
    } else {
      recommendation = `High variability detected. Recommend temperature 0.0-0.3 for consistent outputs.`;
    }

    return { temperature, recommendation };
  }
}

export function formatConsistencyReport(result: ConsistencyResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  AI CONSISTENCY REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`  Prompt: "${result.prompt.substring(0, 50)}${result.prompt.length > 50 ? '...' : ''}"`);
  lines.push(`  Runs: ${result.runs}`);
  lines.push(`  Generated: ${result.timestamp}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('  CONSISTENCY SCORE');
  lines.push('-'.repeat(60));
  lines.push(`  Overall Score: ${(result.consistencyScore * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('  Analysis Breakdown:');
  lines.push(`    Semantic Similarity:   ${(result.analysis.semanticSimilarity * 100).toFixed(1)}%`);
  lines.push(`    Lexical Similarity:    ${(result.analysis.lexicalSimilarity * 100).toFixed(1)}%`);
  lines.push(`    Structural Similarity: ${(result.analysis.structuralSimilarity * 100).toFixed(1)}%`);
  lines.push(`    Length Variance:       ${(result.analysis.lengthVariance * 100).toFixed(1)}%`);
  lines.push('');

  if (result.variableSections.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('  VARIABLE SECTIONS');
    lines.push('-'.repeat(60));
    for (const section of result.variableSections.slice(0, 5)) {
      lines.push(`  Position ${section.position + 1}: ${(section.variability * 100).toFixed(0)}% variability`);
      for (const content of section.content.slice(0, 2)) {
        lines.push(`    - "${content.substring(0, 60)}..."`);
      }
    }
    lines.push('');
  }

  if (result.temperatureImpact) {
    lines.push('-'.repeat(60));
    lines.push('  TEMPERATURE ANALYSIS');
    lines.push('-'.repeat(60));
    lines.push(`  Current Temperature: ${result.temperatureImpact.temperature}`);
    lines.push(`  Recommendation: ${result.temperatureImpact.recommendation}`);
    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}
