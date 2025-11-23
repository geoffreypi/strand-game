/**
 * Global Teardown - Runs after all tests complete
 */

export default async function globalTeardown() {
  // Visualization file is written by test-visualizer.js and read by test-reporter.js
  // No cleanup needed here - reporter handles it
}
