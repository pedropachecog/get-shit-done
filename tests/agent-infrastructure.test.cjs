/**
 * Agent Infrastructure Tests
 *
 * Verifies test infrastructure components work correctly:
 * - Mock MCP fixtures can be loaded
 * - Agent-dispatch CLI command works correctly
 * - Helper functions extract agent frontmatter correctly
 *
 * Verifies requirements: INFRA-01, INFRA-02, INFRA-03
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'mock-mcp-config');
const PHASE_CONTEXT_FIXTURES_DIR = path.join(__dirname, 'fixtures', 'mock-phase-context');

// ─── Helpers ───────────────────────────────────────────────────────────────────

const { runGsdTools } = require('./helpers.cjs');
const {
  loadMockMcpConfig,
  extractAgentTools,
  extractAgentFrontmatter,
  createMcpMockTracker,
} = require('./agent-dispatch-helpers.cjs');

// ─── FIXTURES: mock MCP configurations ────────────────────────────────────────

describe('FIXTURES: mock MCP configurations', () => {
  test('searxng-only.json exists and has searxng in mcpServers', () => {
    const config = loadMockMcpConfig('searxng-only');
    assert.ok(config, 'Config should be loaded');
    assert.ok(config.mcpServers, 'Config should have mcpServers field');
    assert.ok(config.mcpServers.searxng, 'Config should have searxng in mcpServers');
    assert.strictEqual(config.mcpServers.searxng.enabled, true);
    assert.strictEqual(config.mcpServers.searxng.connected, true);
  });

  test('searxng-and-context.json exists and has both searxng and context', () => {
    const config = loadMockMcpConfig('searxng-and-context');
    assert.ok(config, 'Config should be loaded');
    assert.ok(config.mcpServers, 'Config should have mcpServers field');
    assert.ok(config.mcpServers.searxng, 'Config should have searxng in mcpServers');
    assert.ok(config.mcpServers.context, 'Config should have context in mcpServers');
    assert.strictEqual(config.mcpServers.searxng.enabled, true);
    assert.strictEqual(config.mcpServers.context.enabled, true);
  });

  test('none-configured.json exists with empty mcpServers', () => {
    const config = loadMockMcpConfig('none-configured');
    assert.ok(config, 'Config should be loaded');
    assert.ok(config.mcpServers, 'Config should have mcpServers field');
    assert.strictEqual(Object.keys(config.mcpServers).length, 0, 'mcpServers should be empty');
  });

  test('05-CONTEXT.md fixture exists', () => {
    const fixturePath = path.join(PHASE_CONTEXT_FIXTURES_DIR, '05-CONTEXT.md');
    assert.ok(fs.existsSync(fixturePath), '05-CONTEXT.md fixture should exist');
    const content = fs.readFileSync(fixturePath, 'utf-8');
    assert.ok(content.includes('Phase 5'), 'Fixture should reference Phase 5');
    assert.ok(content.includes('<domain>'), 'Fixture should have domain section');
  });
});

// ─── CLI: agent-dispatch command ──────────────────────────────────────────────

describe('CLI: agent-dispatch command', () => {
  const agentsDir = path.join(__dirname, '..', 'agents');

  test('agent-dispatch with gsd-phase-researcher returns valid JSON', () => {
    const result = runGsdTools(
      ['agent-dispatch', 'gsd-phase-researcher', '--phase', '5'],
      agentsDir
    );

    assert.ok(result.success, 'Command should succeed');
    const json = JSON.parse(result.output);
    assert.ok(json, 'Output should be valid JSON');
  });

  test('returned JSON has agent, tools, mcpTools fields', () => {
    const result = runGsdTools(
      ['agent-dispatch', 'gsd-phase-researcher', '--phase', '5'],
      agentsDir
    );

    assert.ok(result.success, 'Command should succeed');
    const json = JSON.parse(result.output);

    assert.strictEqual(json.agent, 'gsd-phase-researcher', 'Should have agent field');
    assert.ok(Array.isArray(json.tools), 'Should have tools array');
    assert.ok(Array.isArray(json.mcpTools), 'Should have mcpTools array');
  });

  test('mcpTools contains tools starting with mcp__', () => {
    const result = runGsdTools(
      ['agent-dispatch', 'gsd-phase-researcher', '--phase', '5'],
      agentsDir
    );

    assert.ok(result.success, 'Command should succeed');
    const json = JSON.parse(result.output);

    // Check that all mcpTools start with 'mcp__'
    for (const tool of json.mcpTools) {
      assert.ok(
        tool.startsWith('mcp__'),
        `MCP tool should start with 'mcp__': ${tool}`
      );
    }
  });

  test('--phase argument is reflected in output', () => {
    const result = runGsdTools(
      ['agent-dispatch', 'gsd-phase-researcher', '--phase', '7'],
      agentsDir
    );

    assert.ok(result.success, 'Command should succeed');
    const json = JSON.parse(result.output);

    assert.strictEqual(json.phase, '7', 'Phase should be 7');
  });
});

// ─── HELPERS: dispatch helper functions ──────────────────────────────────────

describe('HELPERS: dispatch helper functions', () => {
  test('loadMockMcpConfig loads fixture files correctly', () => {
    // Test searxng-only fixture
    const config = loadMockMcpConfig('searxng-only');
    assert.ok(config, 'Should load config');
    assert.ok(config.mcpServers.searxng, 'Should have searxng server');

    // Test that non-existent fixture throws
    assert.throws(
      () => loadMockMcpConfig('non-existent-fixture'),
      /Mock MCP config fixture not found/,
      'Should throw for non-existent fixture'
    );
  });

  test('extractAgentTools returns array of tool names', () => {
    const agentPath = path.join(__dirname, '..', 'agents', 'gsd-phase-researcher.md');
    const tools = extractAgentTools(agentPath);

    assert.ok(Array.isArray(tools), 'Should return array');
    assert.ok(tools.length > 0, 'Should have at least one tool');

    // Verify tools are trimmed and non-empty
    for (const tool of tools) {
      assert.ok(tool.length > 0, 'Tool name should not be empty');
      assert.strictEqual(tool, tool.trim(), 'Tool name should be trimmed');
    }
  });

  test('extractAgentFrontmatter parses frontmatter into object', () => {
    const agentPath = path.join(__dirname, '..', 'agents', 'gsd-phase-researcher.md');
    const frontmatter = extractAgentFrontmatter(agentPath);

    assert.ok(typeof frontmatter === 'object', 'Should return object');
    assert.ok(frontmatter.name, 'Should have name field');
    assert.ok(frontmatter.description, 'Should have description field');
    assert.ok(frontmatter.tools, 'Should have tools field');
    assert.ok(frontmatter.color, 'Should have color field');
  });

  test('createMcpMockTracker returns object with required methods', () => {
    const tracker = createMcpMockTracker();

    assert.ok(typeof tracker === 'object', 'Should return object');
    assert.ok(typeof tracker.injectMcpList === 'function', 'Should have injectMcpList method');
    assert.ok(typeof tracker.injectMcpGet === 'function', 'Should have injectMcpGet method');
    assert.ok(typeof tracker.injectClaudeVersion === 'function', 'Should have injectClaudeVersion method');
    assert.ok(typeof tracker.getCalledTools === 'function', 'Should have getCalledTools method');
    assert.ok(typeof tracker.assertCalled === 'function', 'Should have assertCalled method');
    assert.ok(typeof tracker.reset === 'function', 'Should have reset method');
    assert.ok(typeof tracker.getInjected === 'function', 'Should have getInjected method');
  });
});
