import Anthropic from '@anthropic-ai/sdk';
import { Rubric, Criterion, GradeResult, GradingReport } from './rubrics';

export interface GraderConfig {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
}

export class AIGrader {
  private client: Anthropic;
  private model: string;
  private maxRetries: number;

  constructor(config: GraderConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxRetries = config.maxRetries || 3;
  }

  async gradeOutput(
    content: string,
    rubric: Rubric,
    context?: string
  ): Promise<GradeResult[]> {
    const results: GradeResult[] = [];

    for (const criterion of rubric.criteria) {
      const grade = await this.gradeCriterion(content, criterion, context);
      results.push(grade);
    }

    return results;
  }

  private async gradeCriterion(
    content: string,
    criterion: Criterion,
    context?: string
  ): Promise<GradeResult> {
    const minScore = Math.min(...criterion.scale);
    const maxScore = Math.max(...criterion.scale);

    const examplesText = criterion.examples
      ? Object.entries(criterion.examples)
          .map(([score, desc]) => `  Score ${score}: ${desc}`)
          .join('\n')
      : '';

    const prompt = `You are an expert evaluator. Grade the following content on the criterion "${criterion.name}".

## Criterion
Name: ${criterion.name}
Description: ${criterion.description}
Scale: ${minScore} (lowest) to ${maxScore} (highest)
${examplesText ? `\nScoring Examples:\n${examplesText}` : ''}

${context ? `## Context\n${context}\n` : ''}
## Content to Grade
${content}

## Instructions
1. Carefully analyze the content against the criterion
2. Provide a score from ${minScore} to ${maxScore}
3. Explain your rationale

Respond in this exact JSON format:
{
  "score": <number>,
  "rationale": "<brief explanation>"
}`;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Failed to parse grading response');
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const score = Number(parsed.score);

        if (isNaN(score) || score < minScore || score > maxScore) {
          throw new Error(`Invalid score: ${parsed.score}`);
        }

        return {
          criterion: criterion.name,
          score,
          maxScore,
          weight: criterion.weight,
          weightedScore: score * criterion.weight,
          rationale: parsed.rationale || '',
        };
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries - 1) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw new Error(`Failed to grade criterion "${criterion.name}": ${lastError?.message}`);
  }

  async gradeWithMultipleGraders(
    content: string,
    rubric: Rubric,
    graderCount: number = 3,
    context?: string
  ): Promise<{ grades: GradeResult[]; reliability: number }> {
    const allGrades: GradeResult[][] = [];

    for (let i = 0; i < graderCount; i++) {
      const grades = await this.gradeOutput(content, rubric, context);
      allGrades.push(grades);
    }

    // Calculate average grades
    const averagedGrades: GradeResult[] = rubric.criteria.map((criterion, idx) => {
      const scores = allGrades.map(g => g[idx].score);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const rationales = allGrades.map(g => g[idx].rationale);

      return {
        criterion: criterion.name,
        score: Math.round(avgScore * 100) / 100,
        maxScore: Math.max(...criterion.scale),
        weight: criterion.weight,
        weightedScore: avgScore * criterion.weight,
        rationale: `Average of ${graderCount} graders. Individual rationales: ${rationales.join(' | ')}`,
      };
    });

    // Calculate inter-rater reliability (simplified Krippendorff's alpha approximation)
    const reliability = this.calculateReliability(allGrades);

    return { grades: averagedGrades, reliability };
  }

  private calculateReliability(allGrades: GradeResult[][]): number {
    if (allGrades.length < 2) return 1;

    const criteriaCount = allGrades[0].length;
    let totalVariance = 0;
    let totalObservedVariance = 0;

    for (let c = 0; c < criteriaCount; c++) {
      const scores = allGrades.map(g => g[c].score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
      const maxPossibleVariance = Math.pow(allGrades[0][c].maxScore - 1, 2) / 4;

      totalVariance += maxPossibleVariance;
      totalObservedVariance += variance;
    }

    if (totalVariance === 0) return 1;
    return Math.max(0, 1 - (totalObservedVariance / totalVariance));
  }

  createReport(
    rubricName: string,
    outputFile: string,
    grades: GradeResult[],
    graderCount?: number,
    reliability?: number
  ): GradingReport {
    const totalScore = grades.reduce((sum, g) => sum + g.weightedScore, 0);
    const maxPossibleScore = grades.reduce((sum, g) => sum + g.maxScore * g.weight, 0);

    return {
      rubricName,
      outputFile,
      timestamp: new Date().toISOString(),
      grades,
      totalScore: Math.round(totalScore * 100) / 100,
      maxPossibleScore: Math.round(maxPossibleScore * 100) / 100,
      percentageScore: Math.round((totalScore / maxPossibleScore) * 100 * 100) / 100,
      graderModel: this.model,
      graderCount,
      interRaterReliability: reliability,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
