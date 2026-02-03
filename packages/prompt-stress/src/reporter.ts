import { LoadTestResults } from './loadtester.js';

export interface ReportOptions {
  format?: 'text' | 'json' | 'html';
  verbose?: boolean;
}

export function generateReport(results: LoadTestResults, options: ReportOptions = {}): string {
  const format = options.format || 'text';

  switch (format) {
    case 'json':
      return JSON.stringify(results, null, 2);
    case 'html':
      return generateHtmlReport(results);
    default:
      return generateTextReport(results, options.verbose);
  }
}

function generateTextReport(results: LoadTestResults, verbose = false): string {
  const lines: string[] = [];
  const { config, summary, latency, tokens, errors, timeline } = results;

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('LOAD TEST REPORT');
  lines.push('='.repeat(60));
  lines.push('');

  // Configuration
  lines.push('CONFIGURATION');
  lines.push('-'.repeat(40));
  lines.push(`Target RPS:        ${config.rps}`);
  lines.push(`Duration:          ${config.duration}s`);
  lines.push(`Prompts:           ${config.promptCount}`);
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(40));
  lines.push(`Total Requests:    ${summary.totalRequests}`);
  lines.push(`Successful:        ${summary.successCount} (${((summary.successCount / summary.totalRequests) * 100).toFixed(1)}%)`);
  lines.push(`Failed:            ${summary.errorCount} (${summary.errorRate.toFixed(1)}%)`);
  lines.push(`Actual Duration:   ${summary.actualDuration}s`);
  lines.push(`Actual RPS:        ${summary.actualRps}`);
  lines.push('');

  // Latency
  lines.push('LATENCY (ms)');
  lines.push('-'.repeat(40));
  lines.push(`Min:               ${latency.min}`);
  lines.push(`Max:               ${latency.max}`);
  lines.push(`Mean:              ${latency.mean}`);
  lines.push(`Median:            ${latency.median}`);
  lines.push(`Std Dev:           ${latency.stdDev}`);
  lines.push('');
  lines.push('Percentiles:');
  lines.push(`  p50:             ${latency.p50}`);
  lines.push(`  p90:             ${latency.p90}`);
  lines.push(`  p95:             ${latency.p95}`);
  lines.push(`  p99:             ${latency.p99}`);
  lines.push('');

  // Tokens
  lines.push('TOKEN USAGE');
  lines.push('-'.repeat(40));
  lines.push(`Total Input:       ${tokens.totalInput.toLocaleString()}`);
  lines.push(`Total Output:      ${tokens.totalOutput.toLocaleString()}`);
  lines.push(`Avg Input/Req:     ${tokens.avgInputPerRequest}`);
  lines.push(`Avg Output/Req:    ${tokens.avgOutputPerRequest}`);
  lines.push('');

  // Errors
  if (Object.keys(errors).length > 0) {
    lines.push('ERRORS');
    lines.push('-'.repeat(40));
    for (const [errorType, count] of Object.entries(errors)) {
      lines.push(`${errorType.padEnd(18)} ${count}`);
    }
    lines.push('');
  }

  // Timeline (verbose)
  if (verbose && timeline.length > 0) {
    lines.push('TIMELINE');
    lines.push('-'.repeat(40));
    lines.push('Time(s)  RPS    Latency(ms)  Errors(%)');
    for (let i = 0; i < timeline.length; i++) {
      const t = timeline[i];
      lines.push(
        `${(i + 1).toString().padEnd(8)} ${t.rps.toString().padEnd(6)} ${t.avgLatency.toString().padEnd(12)} ${t.errorRate.toFixed(1)}`
      );
    }
    lines.push('');
  }

  // Timing
  lines.push('TIMING');
  lines.push('-'.repeat(40));
  lines.push(`Started:           ${results.startTime}`);
  lines.push(`Ended:             ${results.endTime}`);
  lines.push('');

  lines.push('='.repeat(60));

  return lines.join('\n');
}

function generateHtmlReport(results: LoadTestResults): string {
  const { config, summary, latency, tokens, errors, timeline } = results;

  const timelineLabels = timeline.map((_, i) => i + 1);
  const timelineRps = timeline.map(t => t.rps);
  const timelineLatency = timeline.map(t => t.avgLatency);
  const timelineErrors = timeline.map(t => t.errorRate);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Load Test Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 40px; border-radius: 16px; margin-bottom: 30px; }
    .header h1 { font-size: 2.5em; margin-bottom: 10px; }
    .header p { opacity: 0.9; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; }
    .card h3 { color: #94a3b8; font-size: 0.875em; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    .stat { font-size: 2.5em; font-weight: bold; color: #fff; margin-bottom: 8px; }
    .stat-label { color: #64748b; font-size: 0.875em; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .stat-item { padding: 12px; background: #0f172a; border-radius: 8px; }
    .stat-item .value { font-size: 1.5em; font-weight: 600; color: #fff; }
    .stat-item .label { font-size: 0.75em; color: #64748b; }
    .chart-container { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; margin-bottom: 30px; }
    .chart-container h3 { color: #94a3b8; font-size: 0.875em; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
    .warning { color: #f59e0b; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-weight: 500; }
    .percentile-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .percentile-label { width: 60px; color: #94a3b8; }
    .percentile-value { width: 80px; font-weight: 600; }
    .percentile-track { flex: 1; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; }
    .percentile-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Load Test Report</h1>
      <p>Target: ${config.rps} RPS for ${config.duration}s with ${config.promptCount} prompts</p>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Total Requests</h3>
        <div class="stat">${summary.totalRequests.toLocaleString()}</div>
        <div class="stat-label">Actual RPS: ${summary.actualRps}</div>
      </div>
      <div class="card">
        <h3>Success Rate</h3>
        <div class="stat ${summary.errorRate < 1 ? 'success' : summary.errorRate < 5 ? 'warning' : 'error'}">
          ${((summary.successCount / summary.totalRequests) * 100).toFixed(1)}%
        </div>
        <div class="stat-label">${summary.successCount.toLocaleString()} successful, ${summary.errorCount} failed</div>
      </div>
      <div class="card">
        <h3>Median Latency</h3>
        <div class="stat">${latency.median}ms</div>
        <div class="stat-label">p95: ${latency.p95}ms, p99: ${latency.p99}ms</div>
      </div>
      <div class="card">
        <h3>Total Tokens</h3>
        <div class="stat">${(tokens.totalInput + tokens.totalOutput).toLocaleString()}</div>
        <div class="stat-label">${tokens.totalInput.toLocaleString()} in, ${tokens.totalOutput.toLocaleString()} out</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Latency Percentiles</h3>
        ${[
          { label: 'p50', value: latency.p50 },
          { label: 'p90', value: latency.p90 },
          { label: 'p95', value: latency.p95 },
          { label: 'p99', value: latency.p99 },
        ].map(p => `
          <div class="percentile-bar">
            <span class="percentile-label">${p.label}</span>
            <span class="percentile-value">${p.value}ms</span>
            <div class="percentile-track">
              <div class="percentile-fill" style="width: ${Math.min(100, (p.value / latency.max) * 100)}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <h3>Latency Statistics</h3>
        <div class="stat-grid">
          <div class="stat-item">
            <div class="value">${latency.min}ms</div>
            <div class="label">Minimum</div>
          </div>
          <div class="stat-item">
            <div class="value">${latency.max}ms</div>
            <div class="label">Maximum</div>
          </div>
          <div class="stat-item">
            <div class="value">${latency.mean}ms</div>
            <div class="label">Mean</div>
          </div>
          <div class="stat-item">
            <div class="value">${latency.stdDev}ms</div>
            <div class="label">Std Dev</div>
          </div>
        </div>
      </div>
    </div>

    ${timeline.length > 0 ? `
    <div class="chart-container">
      <h3>Performance Over Time</h3>
      <canvas id="performanceChart"></canvas>
    </div>
    ` : ''}

    ${Object.keys(errors).length > 0 ? `
    <div class="card">
      <h3>Error Breakdown</h3>
      <table>
        <thead>
          <tr>
            <th>Error Type</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(errors).map(([type, count]) => `
          <tr>
            <td>${type}</td>
            <td>${count}</td>
            <td>${((count / summary.errorCount) * 100).toFixed(1)}%</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="card">
      <h3>Test Timing</h3>
      <table>
        <tr>
          <td>Started</td>
          <td>${results.startTime}</td>
        </tr>
        <tr>
          <td>Ended</td>
          <td>${results.endTime}</td>
        </tr>
        <tr>
          <td>Duration</td>
          <td>${summary.actualDuration}s</td>
        </tr>
      </table>
    </div>
  </div>

  ${timeline.length > 0 ? `
  <script>
    const ctx = document.getElementById('performanceChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(timelineLabels)},
        datasets: [
          {
            label: 'RPS',
            data: ${JSON.stringify(timelineRps)},
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y',
            tension: 0.3,
          },
          {
            label: 'Latency (ms)',
            data: ${JSON.stringify(timelineLatency)},
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            yAxisID: 'y1',
            tension: 0.3,
          },
          {
            label: 'Error Rate (%)',
            data: ${JSON.stringify(timelineErrors)},
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            yAxisID: 'y2',
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: '#94a3b8' },
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'RPS', color: '#3b82f6' },
            grid: { color: '#334155' },
            ticks: { color: '#3b82f6' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Latency (ms)', color: '#8b5cf6' },
            grid: { drawOnChartArea: false },
            ticks: { color: '#8b5cf6' }
          },
          y2: {
            type: 'linear',
            display: false,
            position: 'right',
          }
        },
        plugins: {
          legend: {
            labels: { color: '#e2e8f0' }
          }
        }
      }
    });
  </script>
  ` : ''}
</body>
</html>`;
}

export function analyzeResults(results: LoadTestResults): {
  analysis: string[];
  recommendations: string[];
  score: number;
} {
  const analysis: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Analyze error rate
  if (results.summary.errorRate > 10) {
    analysis.push(`High error rate: ${results.summary.errorRate.toFixed(1)}%`);
    recommendations.push('Reduce request rate or investigate error causes');
    score -= 30;
  } else if (results.summary.errorRate > 5) {
    analysis.push(`Moderate error rate: ${results.summary.errorRate.toFixed(1)}%`);
    recommendations.push('Monitor error trends and consider reducing load');
    score -= 15;
  } else if (results.summary.errorRate > 1) {
    analysis.push(`Low error rate: ${results.summary.errorRate.toFixed(1)}%`);
    score -= 5;
  } else {
    analysis.push('Excellent error rate: minimal failures');
  }

  // Analyze latency
  const p95Threshold = 5000; // 5 seconds
  const p99Threshold = 10000; // 10 seconds

  if (results.latency.p95 > p95Threshold) {
    analysis.push(`High p95 latency: ${results.latency.p95}ms`);
    recommendations.push('Consider using a faster model or reducing prompt complexity');
    score -= 20;
  }

  if (results.latency.p99 > p99Threshold) {
    analysis.push(`Very high p99 latency: ${results.latency.p99}ms`);
    recommendations.push('Investigate timeout settings and retry logic');
    score -= 15;
  }

  // Analyze RPS achievement
  const rpsRatio = results.summary.actualRps / results.config.rps;
  if (rpsRatio < 0.8) {
    analysis.push(`Achieved only ${(rpsRatio * 100).toFixed(0)}% of target RPS`);
    recommendations.push('Rate limiting or network constraints may be affecting throughput');
    score -= 20;
  } else if (rpsRatio < 0.95) {
    analysis.push(`Achieved ${(rpsRatio * 100).toFixed(0)}% of target RPS`);
    score -= 5;
  } else {
    analysis.push('Successfully achieved target RPS');
  }

  // Analyze error types
  if (results.errors['rate_limit'] > 0) {
    recommendations.push('Rate limiting detected - reduce RPS or implement backoff');
    score -= 10;
  }

  if (results.errors['timeout'] > 0) {
    recommendations.push('Timeouts detected - increase timeout settings or reduce load');
    score -= 10;
  }

  // Token efficiency
  if (results.tokens.avgOutputPerRequest < 50) {
    analysis.push('Low average output tokens - responses may be truncated');
  }

  return {
    analysis,
    recommendations,
    score: Math.max(0, score),
  };
}
