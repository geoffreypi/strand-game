/**
 * Global Setup - Clears old visualization file before tests run
 */
import fs from 'fs';
import path from 'path';

export default async function globalSetup() {
  const vizFile = path.join(process.cwd(), '.test-visualizations.json');

  // Clear any old visualization file at start
  if (fs.existsSync(vizFile)) {
    fs.unlinkSync(vizFile);
  }
}
