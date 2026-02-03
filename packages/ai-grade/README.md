# ai-grade

Grade outputs on custom rubrics using AI (Claude).

## Installation

```bash
npm install -g ai-grade
# or
npx ai-grade
```

## Prerequisites

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

## Usage

### Create a Rubric

Create a new rubric template:

```bash
ai-grade create-rubric --output my-rubric.yaml
```

This creates a YAML file with the following structure:

```yaml
name: quality-rubric
version: '1.0'
description: A grading rubric for evaluating outputs
criteria:
  - name: accuracy
    weight: 0.4
    scale: [1, 2, 3, 4, 5]
    description: "How accurate is the response?"
    examples:
      1: "Many factual errors, mostly incorrect"
      3: "Some minor errors, mostly correct"
      5: "Completely accurate, no errors"
  - name: clarity
    weight: 0.3
    scale: [1, 2, 3, 4, 5]
    description: "How clear and readable?"
  - name: completeness
    weight: 0.3
    scale: [1, 2, 3, 4, 5]
    description: "Does it fully address the prompt?"
```

### Evaluate Outputs

Grade all outputs in a directory:

```bash
ai-grade evaluate ./outputs --rubric rubric.yaml
```

Options:
- `--graders <n>`: Use multiple AI graders for inter-rater reliability
- `--output <path>`: Save results to JSON file
- `--json`: Output results as JSON

Example with multiple graders:

```bash
ai-grade evaluate ./outputs --rubric rubric.yaml --graders 3 --output results.json
```

### Generate Reports

Create formatted reports from grading results:

```bash
ai-grade report --input results.json --format text
ai-grade report --input results.json --format html --output report.html
ai-grade report --input results.json --format json
```

## Rubric Format

### Basic Structure

```yaml
name: string          # Required: Rubric name
version: string       # Optional: Version number
description: string   # Optional: Description
criteria:             # Required: List of criteria
  - name: string      # Required: Criterion name
    weight: number    # Required: Weight (0-1, all must sum to 1)
    scale: number[]   # Required: Score scale (e.g., [1,2,3,4,5])
    description: string # Required: What to evaluate
    examples:         # Optional: Score examples
      1: "Description for score 1"
      5: "Description for score 5"
```

### Weight Rules

- All criterion weights must sum to 1.0
- Weights determine contribution to final score

### Scale Options

- Use any numeric scale: `[1, 2, 3, 4, 5]`, `[0, 1]`, `[1, 10]`
- Minimum two values required
- First value is lowest, last is highest

## Inter-Rater Reliability

When using multiple graders (`--graders 3`):

- Each file is graded independently by N AI instances
- Scores are averaged across graders
- Inter-rater reliability is calculated
- Higher reliability (closer to 100%) indicates consistent grading

## Output Formats

### JSON Output

```json
{
  "rubricName": "quality-rubric",
  "outputFile": "response1.txt",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "grades": [
    {
      "criterion": "accuracy",
      "score": 4,
      "maxScore": 5,
      "weight": 0.4,
      "weightedScore": 1.6,
      "rationale": "The response is mostly accurate..."
    }
  ],
  "totalScore": 3.8,
  "maxPossibleScore": 5,
  "percentageScore": 76,
  "graderModel": "claude-sonnet-4-20250514"
}
```

### Text Report

```
============================================================
AI GRADING REPORT
============================================================

SUMMARY
----------------------------------------
Total Files Graded: 5
Average Score: 78.5%
Rubric: quality-rubric

------------------------------------------------------------
File: response1.txt
Score: 76.0% (3.80/5.00)
Graded: 1/15/2024, 10:30:00 AM

Criteria Scores:
  accuracy        [############---] 4/5 (weight: 40%)
    Rationale: The response is mostly accurate...
```

## Examples

### Evaluate Code Reviews

```yaml
name: code-review-rubric
criteria:
  - name: correctness
    weight: 0.35
    scale: [1, 2, 3, 4, 5]
    description: "Is the code logic correct?"
  - name: style
    weight: 0.2
    scale: [1, 2, 3, 4, 5]
    description: "Does it follow coding conventions?"
  - name: efficiency
    weight: 0.25
    scale: [1, 2, 3, 4, 5]
    description: "Is the code efficient?"
  - name: documentation
    weight: 0.2
    scale: [1, 2, 3, 4, 5]
    description: "Is it well documented?"
```

### Evaluate Writing

```yaml
name: writing-rubric
criteria:
  - name: grammar
    weight: 0.25
    scale: [1, 2, 3, 4, 5]
    description: "Grammar and spelling correctness"
  - name: structure
    weight: 0.25
    scale: [1, 2, 3, 4, 5]
    description: "Logical organization and flow"
  - name: argumentation
    weight: 0.3
    scale: [1, 2, 3, 4, 5]
    description: "Strength of arguments and evidence"
  - name: originality
    weight: 0.2
    scale: [1, 2, 3, 4, 5]
    description: "Original thinking and insights"
```

## API Usage

```typescript
import { AIGrader, loadRubric } from 'ai-grade';

const grader = new AIGrader({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-sonnet-4-20250514',
});

const rubric = loadRubric('rubric.yaml');
const content = 'Text to grade...';

// Single grader
const grades = await grader.gradeOutput(content, rubric);

// Multiple graders for reliability
const { grades, reliability } = await grader.gradeWithMultipleGraders(
  content,
  rubric,
  3
);

// Generate report
const report = grader.createReport('my-rubric', 'file.txt', grades);
```

## License

MIT
