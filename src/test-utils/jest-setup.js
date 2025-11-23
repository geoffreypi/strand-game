/**
 * Jest Setup - Hooks for test visualization
 *
 * This file is loaded by Jest before tests run.
 * It sets up hooks to track test context for visualizations.
 */

import { vis } from './test-visualizer.js';

// Track current describe context
let currentDescribe = [];

// Note: We don't clear visualizations here as multiple test files
// share the same visualization state and we want to accumulate all of them

// Override global describe to track context
const originalDescribe = global.describe;
global.describe = (name, fn) => {
  return originalDescribe(name, () => {
    beforeAll(() => {
      currentDescribe.push(name);
      vis.setDescribe(currentDescribe.join(' > '));
    });

    afterAll(() => {
      currentDescribe.pop();
      vis.setDescribe(currentDescribe.join(' > ') || null);
    });

    fn();
  });
};

// Override global test/it to track context
const originalTest = global.test;
global.test = (name, fn, timeout) => {
  return originalTest(name, async () => {
    vis.setTest(name);
    try {
      await fn();
    } finally {
      vis.endTest();
    }
  }, timeout);
};

// Alias for 'it'
global.it = global.test;
