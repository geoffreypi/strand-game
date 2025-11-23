/**
 * Custom Jest Reporter - Generates HTML test report with molecule visualizations
 *
 * This reporter collects all test results and generates a comprehensive HTML report
 * with ASCII visualizations of molecules captured during test execution.
 */

import fs from 'fs';
import path from 'path';

// Check if verbose mode is enabled
const isVerbose = process.env.VERBOSE_TESTS === '1';

// Visualization file path - must match test-visualizer.js
const VIZ_FILE = path.join(process.cwd(), '.test-visualizations.json');

/**
 * Load visualizations from temp file
 */
function loadVisualizations() {
  try {
    if (fs.existsSync(VIZ_FILE)) {
      const data = fs.readFileSync(VIZ_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Ignore errors
  }
  return [];
}

/**
 * Clean up visualization file
 */
function cleanupVisualizations() {
  try {
    if (fs.existsSync(VIZ_FILE)) {
      fs.unlinkSync(VIZ_FILE);
    }
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Generate HTML report from Jest test results
 */
function generateHTMLReport(testResults) {
  // Load visualizations captured during tests
  const visualizations = loadVisualizations();

  // Index visualizations by test name + describe for quick lookup
  const vizByTest = {};
  for (const viz of visualizations) {
    const key = `${viz.describe}::${viz.test}`;
    if (!vizByTest[key]) {
      vizByTest[key] = [];
    }
    vizByTest[key].push(viz);
  }

  const allTests = [];
  let testNumber = 1;

  // Extract all tests from Jest results
  for (const suite of testResults.testResults) {
    for (const test of suite.testResults) {
      // Build describe path from ancestor titles
      const describePath = test.ancestorTitles.join(' > ');
      const vizKey = `${describePath}::${test.title}`;

      allTests.push({
        number: testNumber++,
        name: test.title,
        describe: describePath,
        status: test.status === 'passed' ? 'passed' : 'failed',
        errorMessage: test.failureMessages?.join('\n') || null,
        duration: test.duration,
        visualizations: vizByTest[vizKey] || []
      });
    }
  }

  // Group by describe block
  const grouped = {};
  for (const test of allTests) {
    const key = test.describe || 'Other';
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(test);
  }

  const passedCount = allTests.filter(t => t.status === 'passed').length;
  const failedCount = allTests.filter(t => t.status === 'failed').length;
  const totalViz = allTests.reduce((sum, t) => sum + t.visualizations.length, 0);

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - Protein Folding Game</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      background: #1a1a2e;
      color: #ffffff;
      padding: 20px;
      line-height: 1.4;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #00ff88; }
    h2 {
      color: #00ccff;
      margin-top: 30px;
      border-bottom: 1px solid #333;
      padding-bottom: 10px;
      font-size: 1.2em;
    }

    .stats {
      background: #16213e;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .stat-item { }
    .stat-passed { color: #00ff88; }
    .stat-failed { color: #ff4444; }
    .timestamp { color: #666; font-size: 12px; }

    .test-card {
      background: #0f0f1e;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 15px;
      margin: 10px 0;
    }
    .test-card.passed { border-left: 4px solid #00ff88; }
    .test-card.failed { border-left: 4px solid #ff4444; }

    .test-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 5px;
    }
    .test-status {
      font-size: 16px;
    }
    .test-status.passed { color: #00ff88; }
    .test-status.failed { color: #ff4444; }
    .test-name {
      font-weight: bold;
      color: #ffffff;
    }
    .test-number {
      color: #888;
      font-size: 11px;
      min-width: 40px;
    }
    .test-duration {
      color: #666;
      font-size: 11px;
      margin-left: auto;
    }

    .test-error {
      background: #3d1515;
      color: #ff8888;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
      font-size: 12px;
      white-space: pre-wrap;
      overflow-x: auto;
    }

    .viz-section {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #333;
    }
    .viz-item {
      margin: 10px 0;
    }
    .viz-label {
      color: #ffcc00;
      font-size: 12px;
      margin-bottom: 5px;
    }
    .viz-type {
      color: #666;
      font-size: 10px;
      margin-left: 10px;
    }
    pre {
      background: #16213e;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 5px 0;
      white-space: pre;
      font-size: 13px;
    }
    pre.protein { border-left: 3px solid #ff88ff; }
    pre.dna { border-left: 3px solid #66ff66; }
    pre.binding { border-left: 3px solid #ffcc00; }
    pre.note { border-left: 3px solid #888; background: #1a1a2e; font-style: italic; }
    pre.custom { border-left: 3px solid #00ccff; }

    .summary-bar {
      background: #16213e;
      padding: 10px 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      gap: 5px;
    }
    .summary-segment {
      height: 8px;
      border-radius: 4px;
    }
    .summary-passed { background: #00ff88; }
    .summary-failed { background: #ff4444; }

    .collapsible {
      cursor: pointer;
      user-select: none;
    }
    .collapsible:hover {
      opacity: 0.8;
    }
    .collapse-icon {
      display: inline-block;
      width: 15px;
      margin-right: 5px;
      transition: transform 0.2s;
    }
    .collapsed .collapse-icon {
      transform: rotate(-90deg);
    }
    .collapsed + .describe-tests {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Report</h1>
    <p class="timestamp">Generated: ${new Date().toISOString()}</p>

    <div class="stats">
      <div class="stat-item"><strong>Total Tests:</strong> ${allTests.length}</div>
      <div class="stat-item stat-passed"><strong>Passed:</strong> ${passedCount}</div>
      <div class="stat-item stat-failed"><strong>Failed:</strong> ${failedCount}</div>
      <div class="stat-item"><strong>Visualizations:</strong> ${totalViz}</div>
      <div class="stat-item"><strong>Duration:</strong> ${(testResults.testResults.reduce((sum, s) => sum + (s.perfStats?.runtime || 0), 0) / 1000).toFixed(2)}s</div>
    </div>

    <div class="summary-bar">
      <div class="summary-segment summary-passed" style="flex: ${passedCount}"></div>
      <div class="summary-segment summary-failed" style="flex: ${failedCount}"></div>
    </div>
`;

  for (const [describeName, tests] of Object.entries(grouped)) {
    const describePassedCount = tests.filter(t => t.status === 'passed').length;
    const hasFailures = tests.some(t => t.status === 'failed');

    html += `    <h2 class="collapsible${hasFailures ? '' : ' collapsed'}" onclick="this.classList.toggle('collapsed')"><span class="collapse-icon">▼</span>${escapeHtml(describeName)} <span style="color: #666; font-weight: normal;">(${describePassedCount}/${tests.length} passed)</span></h2>
    <div class="describe-tests">
`;

    for (const test of tests) {
      const statusIcon = test.status === 'passed' ? '✓' : '✗';
      const durationStr = test.duration ? `${test.duration}ms` : '';

      html += `    <div class="test-card ${test.status}" id="test-${test.number}">
      <div class="test-header">
        <span class="test-number">#${test.number}</span>
        <span class="test-status ${test.status}">${statusIcon}</span>
        <span class="test-name">${escapeHtml(test.name)}</span>
        <span class="test-duration">${durationStr}</span>
      </div>
`;

      if (test.errorMessage) {
        // Truncate very long error messages
        let errorMsg = test.errorMessage;
        if (errorMsg.length > 500) {
          errorMsg = errorMsg.substring(0, 500) + '\n... (truncated)';
        }
        html += `      <div class="test-error">${escapeHtml(errorMsg)}</div>\n`;
      }

      if (test.visualizations.length > 0) {
        html += '      <div class="viz-section">\n';
        for (const v of test.visualizations) {
          html += `        <div class="viz-item">
          <div class="viz-label">${escapeHtml(v.label)}<span class="viz-type">${v.type}</span></div>
          <pre class="${v.type}">${escapeHtml(v.content)}</pre>
        </div>
`;
        }
        html += '      </div>\n';
      }

      html += '    </div>\n';
    }

    html += '    </div>\n';
  }

  html += `  </div>
</body>
</html>
`;

  return html;
}

/**
 * Custom Jest Reporter class
 */
class TestReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;
  }

  onRunComplete(contexts, results) {
    const html = generateHTMLReport(results);
    const outputPath = path.resolve(process.cwd(), 'test-report.html');

    fs.writeFileSync(outputPath, html);

    // Clean up temp visualization file
    cleanupVisualizations();

    if (isVerbose) {
      console.log(`\nTest report written to: ${outputPath}\n`);
    }
  }
}

export default TestReporter;
