# 🧠 LXGIC Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

**50 Enterprise-Grade NPX Tools for AI, LLM, and Prompt Engineering**

Build production AI systems faster. No installs. Just `npx` and go.

```bash
npx @lxgic/prompt-lint check ./prompts
npx @lxgic/token-count "Your prompt here"
npx @lxgic/hallucination-check --input response.json
```

Built for teams using **Claude**, **GPT-4**, **OpenAI**, **Anthropic**, and other LLMs.

---

## 🚀 Quick Start

Every tool works instantly with npx:

```bash
# Lint your prompts for best practices
npx @lxgic/prompt-lint ./prompts

# Count tokens before sending to API
npx @lxgic/token-count "Your prompt text"

# A/B test prompt variations
npx @lxgic/prompt-ab --variants ./variants.json

# Cache prompt responses
npx @lxgic/prompt-cache set "key" "response"
```

Or install globally:

```bash
npm install -g @lxgic/suite
```

---

## 📦 All 50 Tools

### 🤖 AI Operations (20 tools)

Enterprise AI infrastructure, compliance, and cost management.

| Tool | Description | Install |
|------|-------------|---------|
| **ai-accuracy** | Measure and track AI response accuracy over time | `npx @lxgic/ai-accuracy` |
| **ai-allocate** | Distribute AI workloads across multiple providers | `npx @lxgic/ai-allocate` |
| **ai-audit** | Audit trail logging for all AI API calls | `npx @lxgic/ai-audit` |
| **ai-batch** | Batch multiple prompts for efficient API usage | `npx @lxgic/ai-batch` |
| **ai-budget** | Set and enforce AI spending budgets | `npx @lxgic/ai-budget` |
| **ai-compliance** | Ensure AI usage meets regulatory requirements | `npx @lxgic/ai-compliance` |
| **ai-consistency** | Check AI responses for consistency across runs | `npx @lxgic/ai-consistency` |
| **ai-firewall** | Block malicious or policy-violating prompts | `npx @lxgic/ai-firewall` |
| **ai-grade** | Grade AI responses against rubrics | `npx @lxgic/ai-grade` |
| **ai-invoice** | Generate invoices for AI API usage | `npx @lxgic/ai-invoice` |
| **ai-pipeline** | Build multi-step AI processing pipelines | `npx @lxgic/ai-pipeline` |
| **ai-quota** | Manage per-user or per-team AI quotas | `npx @lxgic/ai-quota` |
| **ai-rbac** | Role-based access control for AI features | `npx @lxgic/ai-rbac` |
| **ai-redact** | Automatically redact PII from prompts/responses | `npx @lxgic/ai-redact` |
| **ai-regression** | Detect AI response quality regressions | `npx @lxgic/ai-regression` |
| **ai-retry** | Smart retry logic with exponential backoff | `npx @lxgic/ai-retry` |
| **ai-roi** | Calculate ROI of AI implementations | `npx @lxgic/ai-roi` |
| **ai-slack** | Send AI alerts and reports to Slack | `npx @lxgic/ai-slack` |
| **ai-usage** | Track and report AI API usage metrics | `npx @lxgic/ai-usage` |
| **ai-webhook** | Trigger webhooks on AI events | `npx @lxgic/ai-webhook` |

### ✍️ Prompt Engineering (26 tools)

Build, test, optimize, and deploy production prompts.

| Tool | Description | Install |
|------|-------------|---------|
| **prompt-ab** | A/B test prompt variations with statistical analysis | `npx @lxgic/prompt-ab` |
| **prompt-api** | Expose prompts as REST API endpoints | `npx @lxgic/prompt-api` |
| **prompt-approve** | Human-in-the-loop prompt approval workflows | `npx @lxgic/prompt-approve` |
| **prompt-benchmark** | Benchmark prompt performance across models | `npx @lxgic/prompt-benchmark` |
| **prompt-cache** | Cache prompt responses to reduce API costs | `npx @lxgic/prompt-cache` |
| **prompt-chain** | Chain multiple prompts into workflows | `npx @lxgic/prompt-chain` |
| **prompt-coverage** | Measure test coverage for prompt variations | `npx @lxgic/prompt-coverage` |
| **prompt-cron** | Schedule prompts to run on a cron schedule | `npx @lxgic/prompt-cron` |
| **prompt-debug** | Debug prompt execution with detailed logs | `npx @lxgic/prompt-debug` |
| **prompt-diff** | Diff prompt versions and responses | `npx @lxgic/prompt-diff` |
| **prompt-encrypt** | Encrypt sensitive prompts at rest | `npx @lxgic/prompt-encrypt` |
| **prompt-eval** | Evaluate prompt quality with automated scoring | `npx @lxgic/prompt-eval` |
| **prompt-fallback** | Define fallback prompts when primary fails | `npx @lxgic/prompt-fallback` |
| **prompt-lint** | Lint prompts for best practices and issues | `npx @lxgic/prompt-lint` |
| **prompt-optimize** | Optimize prompts for cost and performance | `npx @lxgic/prompt-optimize` |
| **prompt-playground** | Interactive prompt testing environment | `npx @lxgic/prompt-playground` |
| **prompt-policy** | Enforce prompt policies across teams | `npx @lxgic/prompt-policy` |
| **prompt-queue** | Queue prompts for rate-limited processing | `npx @lxgic/prompt-queue` |
| **prompt-sanitize** | Sanitize user input before prompting | `npx @lxgic/prompt-sanitize` |
| **prompt-scan** | Scan prompts for injection vulnerabilities | `npx @lxgic/prompt-scan` |
| **prompt-stream** | Stream prompt responses in real-time | `npx @lxgic/prompt-stream` |
| **prompt-stress** | Stress test prompts under load | `npx @lxgic/prompt-stress` |
| **prompt-template** | Manage prompt templates with variables | `npx @lxgic/prompt-template` |
| **prompt-test** | Unit test prompts with assertions | `npx @lxgic/prompt-test` |
| **prompt-validate** | Validate prompt structure and format | `npx @lxgic/prompt-validate` |
| **prompt-version** | Version control for prompts with history | `npx @lxgic/prompt-version` |

### 🔢 Token Management (3 tools)

Optimize context windows and reduce costs.

| Tool | Description | Install |
|------|-------------|---------|
| **token-count** | Count tokens for any LLM tokenizer | `npx @lxgic/token-count` |
| **token-estimate** | Estimate token costs before API calls | `npx @lxgic/token-estimate` |
| **token-optimize** | Optimize prompts to reduce token usage | `npx @lxgic/token-optimize` |

### 🔍 Quality Assurance (1 tool)

Catch AI mistakes before they reach users.

| Tool | Description | Install |
|------|-------------|---------|
| **hallucination-check** | Detect hallucinations in AI responses | `npx @lxgic/hallucination-check` |

---

## 💡 Use Cases

### Cost Management
```bash
# Set a $100/month budget with alerts at 80%
npx @lxgic/ai-budget set --limit 100 --alert 80

# Track usage across all providers
npx @lxgic/ai-usage report --period monthly
```

### Prompt Development
```bash
# Lint prompts before deployment
npx @lxgic/prompt-lint ./prompts --strict

# A/B test two prompt variants
npx @lxgic/prompt-ab --control v1.txt --variant v2.txt --runs 100
```

### Security & Compliance
```bash
# Redact PII before sending to LLM
npx @lxgic/ai-redact --input user-message.txt

# Scan for prompt injection vulnerabilities
npx @lxgic/prompt-scan ./prompts
```

### Production Operations
```bash
# Cache responses to reduce API calls
npx @lxgic/prompt-cache set "user:123:summary" "$RESPONSE"

# Queue prompts for rate limiting
npx @lxgic/prompt-queue add --prompt "Generate report" --priority high
```

---

## 🛠️ Installation

### Individual Tools (Recommended)

Use any tool instantly without installation:

```bash
npx @lxgic/prompt-lint ./prompts
```

### Install Specific Tools

```bash
npm install -g @lxgic/prompt-lint @lxgic/token-count
```

### Development (Full Suite)

```bash
git clone https://github.com/lxgicstudios/Lxgic-Suite.git
cd Lxgic-Suite
pnpm install
pnpm build
```

---

## 🔧 Configuration

Most tools support configuration via:

1. **CLI flags**: `npx @lxgic/prompt-lint --strict`
2. **Config file**: `.lxgicrc.json` in project root
3. **Environment variables**: `LXGIC_API_KEY`, etc.

Example `.lxgicrc.json`:

```json
{
  "prompt-lint": {
    "strict": true,
    "rules": ["no-pii", "max-tokens"]
  },
  "ai-budget": {
    "limit": 100,
    "currency": "USD",
    "alertThreshold": 0.8
  }
}
```

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

```bash
# Clone and setup
git clone https://github.com/lxgicstudios/Lxgic-Suite.git
cd Lxgic-Suite
pnpm install

# Run tests
pnpm test

# Build all packages
pnpm build
```

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🔗 Links

- **GitHub**: [github.com/lxgicstudios](https://github.com/lxgicstudios)
- **npm**: [npmjs.com/~lxgicstudios](https://www.npmjs.com/~lxgicstudios)
- **Twitter**: [@lxgicstudios](https://x.com/lxgicstudios)
- **Website**: [lxgicstudios.com](https://lxgicstudios.com)

---

<p align="center">
  <b>Built by <a href="https://lxgicstudios.com">LXGIC Studios</a></b><br>
  Free AI dev tools. No installs. Just npx and go.
</p>
