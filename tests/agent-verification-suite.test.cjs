/**
 * Agent Verification Suite Entry Point
 *
 * Verifies that all Phase 6 test modules are properly structured and can be
 * run as part of the standard test suite.
 *
 * This suite verifies test infrastructure, not agent behavior.
 * Individual test files handle the actual agent verification.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const TESTS_DIR = __dirname;

// ─── SUITE-MODULES: Test module loading ─────────────────────────────────────

describe('SUITE-MODULES: Phase 6 test module loading', () => {
  test('tests/agent-mcp-verification.test.cjs exists and is readable', () => {
    const testPath = path.join(TESTS_DIR, 'agent-mcp-verification.test.cjs');
    assert.ok(
      fs.existsSync(testPath),
      'agent-mcp-verification.test.cjs should exist'
    );
    const content = fs.readFileSync(testPath, 'utf-8');
    assert.ok(
      content.length > 0,
      'agent-mcp-verification.test.cjs should be readable and non-empty'
    );
  });

  test('tests/agent-mcp-status-verification.test.cjs exists and is readable', () => {
    const testPath = path.join(TESTS_DIR, 'agent-mcp-status-verification.test.cjs');
    assert.ok(
      fs.existsSync(testPath),
      'agent-mcp-status-verification.test.cjs should exist'
    );
    const content = fs.readFileSync(testPath, 'utf-8');
    assert.ok(
      content.length > 0,
      'agent-mcp-status-verification.test.cjs should be readable and non-empty'
    );
  });

  test('agent-mcp-verification.test.cjs has valid JavaScript syntax', () => {
    const testPath = path.join(TESTS_DIR, 'agent-mcp-verification.test.cjs');
    const content = fs.readFileSync(testPath, 'utf-8');
    assert.doesNotThrow(
      () => new Function(content),
      'agent-mcp-verification.test.cjs should have valid JavaScript syntax'
    );
  });

  test('agent-mcp-status-verification.test.cjs has valid JavaScript syntax', () => {
    const testPath = path.join(TESTS_DIR, 'agent-mcp-status-verification.test.cjs');
    const content = fs.readFileSync(testPath, 'utf-8');
    assert.doesNotThrow(
      () => new Function(content),
      'agent-mcp-status-verification.test.cjs should have valid JavaScript syntax'
    );
  });
});

// ─── SUITE-FRAMEWORK: Test framework compliance ──────────────────────────────

describe('SUITE-FRAMEWORK: Test framework compliance', () => {
  const testFiles = [
    'agent-mcp-verification.test.cjs',
    'agent-mcp-status-verification.test.cjs'
  ];

  testFiles.forEach(testFile => {
    const testPath = path.join(TESTS_DIR, testFile);
    const content = fs.readFileSync(testPath, 'utf-8');

    test(`tests/${testFile} uses require('node:test')`, () => {
      assert.ok(
        content.includes("require('node:test')"),
        `${testFile} should use require('node:test')`
      );
    });

    test(`tests/${testFile} uses require('node:assert')`, () => {
      assert.ok(
        content.includes("require('node:assert')"),
        `${testFile} should use require('node:assert')`
      );
    });

    test(`tests/${testFile} defines describe() blocks`, () => {
      assert.ok(
        content.includes('describe('),
        `${testFile} should define describe() blocks`
      );
    });

    test(`tests/${testFile} defines test() or it() blocks`, () => {
      const hasTest = content.includes('test(') || content.includes('it(');
      assert.ok(
        hasTest,
        `${testFile} should define test() or it() blocks`
      );
    });
  });
});

// ─── SUITE-DISCOVERY: Test suite integration ─────────────────────────────────

describe('SUITE-DISCOVERY: Test suite integration', () => {
  test('Phase 6 test files match discovery pattern tests/*.test.cjs', () => {
    const testFiles = [
      'agent-mcp-verification.test.cjs',
      'agent-mcp-status-verification.test.cjs'
    ];

    testFiles.forEach(testFile => {
      const testPath = path.join(TESTS_DIR, testFile);
      const matchesPattern = testFile.match(/.*\.test\.cjs$/);
      assert.ok(
        matchesPattern,
        `${testFile} should match discovery pattern *.test.cjs`
      );
    });
  });

  test('Phase 6 test files are discoverable via glob pattern', () => {
    const testFiles = fs.readdirSync(TESTS_DIR).filter(f => f.endsWith('.test.cjs'));
    const phase6Tests = testFiles.filter(f => f.startsWith('agent-mcp'));

    assert.ok(
      phase6Tests.length >= 2,
      `Should discover at least 2 Phase 6 test files, found: ${phase6Tests.length}`
    );
    assert.ok(
      phase6Tests.includes('agent-mcp-verification.test.cjs'),
      'Should discover agent-mcp-verification.test.cjs'
    );
    assert.ok(
      phase6Tests.includes('agent-mcp-status-verification.test.cjs'),
      'Should discover agent-mcp-status-verification.test.cjs'
    );
  });
});
