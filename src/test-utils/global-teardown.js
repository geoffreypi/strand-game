/**
 * Global Teardown - Writes visualization file before reporter runs
 */
import fs from 'fs';
import path from 'path';

export default async function globalTeardown() {
  // This runs after all tests complete but before the process exits
  // We need to ensure the visualization file is available for the reporter

  const vizFile = path.join(process.cwd(), '.test-visualizations.json');

  // Check if we have any visualization data from the test environment
  // The data should have been written by individual test files
  if (fs.existsSync(vizFile)) {
    console.log(`Visualization file exists with ${fs.statSync(vizFile).size} bytes`);
  }
}
