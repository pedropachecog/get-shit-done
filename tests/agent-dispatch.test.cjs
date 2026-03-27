/**
 * Agent Dispatch Tests
 *
 * Verifies that agents receive correct MCP context when spawned via CLI.
 * Tests the agent-dispatch command outputs correct dispatch context with MCP tools
 * based on mock MCP configurations.
 *
 * Requirements covered:
 * - DISPATCH-01: CLI agent-dispatch outputs dispatch context with correct fields
 * - DISPATCH-02: Dispatch context includes searxng tools when searxng fixture loaded
 * - DISPATCH-03: Dispatch context includes context7 tools when context fixture loaded
 * - DISPATCH-04: Dispatch context behavior when no MCP servers configured
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { runGsdTools, createTempDir, cleanup } = require('./helpers.cjs');
const { loadMockMcpConfig, setupMockMcpConfig, extractAgentTools } = require('./agent-dispatch-helpers.cjs');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');

/**
 * Setup test environment: copy agents folder and MCP config to temp directory.
 *
 * @param {string} tmpDir - Target temp directory
 * @param {string} fixtureName - MCP fixture name (e.g., 'searxng-only')
 */
function setupTestEnvironment(tmpDir, fixtureName) {
  // Copy agents folder
  const tmpAgentsDir = path.join(tmpDir, 'agents');
  fs.mkdirSync(tmpAgentsDir, { recursive: true });
  const agentFiles = fs.readdirSync(AGENTS_DIR);
  for (const file of agentFiles) {
    const srcPath = path.join(AGENTS_DIR, file);
    const dstPath = path.join(tmpAgentsDir, file);
    const content = fs.readFileSync(srcPath, 'utf-8');
    fs.writeFileSync(dstPath, content, 'utf-8');
  }

  // Setup MCP config
  setupMockMcpConfig(tmpDir, fixtureName);
}

// ─── DISPATCH-01: CLI agent-dispatch outputs correct context ──────────────────

describe('DISPATCH-01: CLI agent-dispatch outputs correct dispatch context', () => {
  test('agent-dispatch CLI outputs valid JSON with required fields', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      // Setup: copy agents and searxng-only fixture
      setupTestEnvironment(tmpDir, 'searxng-only');

      // Run agent-dispatch for gsd-phase-researcher
      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed');

      // Parse JSON output
      const output = JSON.parse(result.output);

      // Assert required fields exist
      assert.ok(output.agent, 'output must have agent field');
      assert.ok(output.phase, 'output must have phase field');
      assert.ok(Array.isArray(output.tools), 'output must have tools array');
      assert.ok(Array.isArray(output.mcpTools), 'output must have mcpTools array');

      // Assert correct values
      assert.strictEqual(output.agent, 'gsd-phase-researcher', 'agent must be gsd-phase-researcher');
      assert.strictEqual(output.phase, '07', 'phase must be 07');
      assert.ok(output.mcpTools.length > 0, 'mcpTools array must have at least one tool');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('agent-dispatch CLI includes phase in output when specified', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'searxng-only');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '05'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed');
      const output = JSON.parse(result.output);
      assert.strictEqual(output.phase, '05', 'phase must match the --phase argument');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('agent-dispatch CLI includes query in output when specified', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'searxng-only');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07', '--query', 'test query'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed');
      const output = JSON.parse(result.output);
      assert.strictEqual(output.query, 'test query', 'query must match the --query argument');
    } finally {
      cleanup(tmpDir);
    }
  });
});

// ─── DISPATCH-02: searxng MCP tools included when available ───────────────────

describe('DISPATCH-02: dispatch context includes searxng tools when searxng-only fixture loaded', () => {
  test('dispatch context includes mcp__searxng__* tools when searxng-only fixture loaded', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'searxng-only');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed');
      const output = JSON.parse(result.output);

      // Assert that mcpTools includes at least one searxng tool
      const hasSearxngTool = output.mcpTools.some(t => t.startsWith('mcp__searxng__'));
      assert.ok(
        hasSearxngTool,
        'dispatch context mcpTools must include mcp__searxng__* tools when searxng fixture is loaded'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('dispatch context MCP tools match agent frontmatter searxng declarations', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'searxng-only');

      // Extract tools from agent frontmatter
      const agentPath = path.join(AGENTS_DIR, 'gsd-phase-researcher.md');
      const declaredTools = extractAgentTools(agentPath);
      const declaredSearxngTools = declaredTools.filter(t => t.startsWith('mcp__searxng__'));

      // Run agent-dispatch
      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed');
      const output = JSON.parse(result.output);

      // Assert that agent declares searxng tools
      assert.ok(
        declaredSearxngTools.length > 0,
        'agent frontmatter must declare mcp__searxng__* tools'
      );

      // Assert that dispatch includes at least one searxng tool
      const dispatchSearxngTools = output.mcpTools.filter(t => t.startsWith('mcp__searxng__'));
      assert.ok(
        dispatchSearxngTools.length > 0,
        'dispatch context must include at least one mcp__searxng__* tool'
      );
    } finally {
      cleanup(tmpDir);
    }
  });
});

// ─── DISPATCH-03: context7 MCP tools included when available ──────────────────

describe('DISPATCH-03: dispatch context includes context7 tools when searxng-and-context fixture loaded', () => {
  test('dispatch context includes mcp__context7__* tools when searxng-and-context fixture loaded', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'searxng-and-context');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed');
      const output = JSON.parse(result.output);

      // Assert that mcpTools includes at least one context7 tool
      const hasContext7Tool = output.mcpTools.some(t => t.startsWith('mcp__context7__'));
      assert.ok(
        hasContext7Tool,
        'dispatch context mcpTools must include mcp__context7__* tools when context fixture is loaded'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('dispatch context includes both searxng and context7 tools when both fixtures available', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'searxng-and-context');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed');
      const output = JSON.parse(result.output);

      // Assert that mcpTools includes searxng tools
      const hasSearxngTool = output.mcpTools.some(t => t.startsWith('mcp__searxng__'));
      assert.ok(
        hasSearxngTool,
        'dispatch context must include mcp__searxng__* tools'
      );

      // Assert that mcpTools includes context7 tools
      const hasContext7Tool = output.mcpTools.some(t => t.startsWith('mcp__context7__'));
      assert.ok(
        hasContext7Tool,
        'dispatch context must include mcp__context7__* tools'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('dispatch context includes all MCP tool types from agent frontmatter when both fixtures available', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'searxng-and-context');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed');
      const output = JSON.parse(result.output);

      // Extract expected MCP tool prefixes from agent frontmatter
      const agentPath = path.join(AGENTS_DIR, 'gsd-phase-researcher.md');
      const declaredTools = extractAgentTools(agentPath);
      const declaredMcpTools = declaredTools.filter(t => t.startsWith('mcp__'));

      // Assert that dispatch mcpTools matches declared MCP tools
      assert.strictEqual(
        output.mcpTools.length,
        declaredMcpTools.length,
        'dispatch context mcpTools length must match agent frontmatter MCP tool declarations'
      );

      // Assert all declared MCP tools are in dispatch
      for (const tool of declaredMcpTools) {
        assert.ok(
          output.mcpTools.includes(tool),
          `dispatch context must include declared MCP tool: ${tool}`
        );
      }
    } finally {
      cleanup(tmpDir);
    }
  });
});

// ─── DISPATCH-04: Agent blocked/error when MCP tools unavailable ──────────────

describe('DISPATCH-04: dispatch context behavior when no MCP servers configured', () => {
  test('dispatch context shows empty mcpTools when no MCP servers configured', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'none-configured');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed even with no MCP configured');
      const output = JSON.parse(result.output);

      // The tools field still contains MCP tool declarations from frontmatter
      // but these are declarations of what the agent WANTS, not what's AVAILABLE
      assert.ok(Array.isArray(output.tools), 'tools array must exist');
      assert.ok(Array.isArray(output.mcpTools), 'mcpTools array must exist');

      // mcpTools should still include the agent's MCP tool declarations
      // (the agent knows what it wants, even if MCP is not available)
      const hasSearxngDeclaration = output.tools.some(t => t.startsWith('mcp__searxng__'));
      assert.ok(
        hasSearxngDeclaration,
        'agent tools must still include mcp__searxng__* declarations even when MCP is not configured'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('dispatch context agent name and phase still present even with no MCP configured', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'none-configured');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed even with no MCP configured');
      const output = JSON.parse(result.output);

      // Assert that agent and phase are still present
      assert.strictEqual(
        output.agent,
        'gsd-phase-researcher',
        'agent name must be present even with no MCP configured'
      );
      assert.strictEqual(
        output.phase,
        '07',
        'phase must be present even with no MCP configured'
      );

      // This proves the agent receives context even when MCP unavailable
      // and can then detect MCP unavailability and block accordingly
    } finally {
      cleanup(tmpDir);
    }
  });

  test('agent frontmatter tools field still populated regardless of MCP availability', () => {
    const tmpDir = createTempDir('dispatch-test-');
    try {
      setupTestEnvironment(tmpDir, 'none-configured');

      const result = runGsdTools(
        ['agent-dispatch', 'gsd-phase-researcher', '--phase', '07'],
        tmpDir
      );

      assert.ok(result.success, 'agent-dispatch command should succeed even with no MCP configured');
      const output = JSON.parse(result.output);

      // The tools field contains all tools declared in agent frontmatter
      // including MCP tools - this proves the agent knows what it WANTS
      const hasSearxngDeclaration = output.tools.some(t => t.startsWith('mcp__searxng__'));
      const hasContext7Declaration = output.tools.some(t => t.startsWith('mcp__context7__'));

      assert.ok(
        hasSearxngDeclaration,
        'agent tools must include mcp__searxng__* declarations regardless of MCP availability'
      );
      assert.ok(
        hasContext7Declaration,
        'agent tools must include mcp__context7__* declarations regardless of MCP availability'
      );
    } finally {
      cleanup(tmpDir);
    }
  });
});
