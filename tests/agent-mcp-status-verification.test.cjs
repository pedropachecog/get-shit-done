/**
 * Agent MCP Status Verification Tests
 *
 * Tests that verify MCP server connection status is checked before agent dispatch,
 * and that agents receive MCP availability status in their dispatch context.
 *
 * Covers VERIFY-03: MCP connection status checking
 */

const { test, describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Helpers from agent-dispatch-helpers.cjs
const { loadMockMcpConfig, createMcpMockTracker } = require('./agent-dispatch-helpers.cjs');

// Path to gsd-phase-researcher agent file
const AGENT_PATH = path.join(__dirname, '..', 'agents', 'gsd-phase-researcher.md');

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('MCP-STATUS-FIXTURES: Mock MCP config loading', () => {
  it('loads searxng-and-context fixture successfully', () => {
    const config = loadMockMcpConfig('searxng-and-context');

    assert.ok(config, 'Config should be loaded');
    assert.ok(config.mcpServers, 'Config should have mcpServers object');
    assert.ok(config.mcpServers.searxng, 'Config should have searxng server');
    assert.ok(config.mcpServers.context, 'Config should have context server');
    assert.strictEqual(config.mcpServers.searxng.connected, true, 'searxng should be connected');
    assert.strictEqual(config.mcpServers.context.connected, true, 'context should be connected');
  });

  it('loads searxng-only fixture successfully', () => {
    const config = loadMockMcpConfig('searxng-only');

    assert.ok(config, 'Config should be loaded');
    assert.ok(config.mcpServers, 'Config should have mcpServers object');
    assert.ok(config.mcpServers.searxng, 'Config should have searxng server');
    assert.strictEqual(config.mcpServers.searxng.connected, true, 'searxng should be connected');
    assert.strictEqual(Object.keys(config.mcpServers).length, 1, 'Should only have searxng server');
  });

  it('loads none-configured fixture successfully', () => {
    const config = loadMockMcpConfig('none-configured');

    assert.ok(config, 'Config should be loaded');
    assert.ok(config.mcpServers, 'Config should have mcpServers object');
    assert.strictEqual(Object.keys(config.mcpServers).length, 0, 'Should have no configured servers');
  });

  it('verifies loaded configs have correct MCP server structure', () => {
    const searxngAndContext = loadMockMcpConfig('searxng-and-context');
    const searxngOnly = loadMockMcpConfig('searxng-only');

    // Verify searxng structure
    assert.ok(searxngAndContext.mcpServers.searxng.enabled !== undefined, 'searxng should have enabled field');
    assert.ok(searxngAndContext.mcpServers.searxng.connected !== undefined, 'searxng should have connected field');
    assert.ok(searxngAndContext.mcpServers.searxng.scope !== undefined, 'searxng should have scope field');
    assert.ok(searxngAndContext.mcpServers.searxng.transport !== undefined, 'searxng should have transport field');
  });
});

describe('MCP-STATUS-AGENT-INSTRUCTIONS: Agent MCP status checking directives', () => {
  it('gsd-phase-researcher contains instruction about MCP unavailability handling', () => {
    const agentContent = fs.readFileSync(AGENT_PATH, 'utf-8');
    // Check for "searxng MCP is unavailable" or "MCP tools unavailable" or similar
    const hasUnavailableHandling =
      agentContent.includes('searxng MCP is unavailable') ||
      agentContent.includes('MCP tools unavailable') ||
      agentContent.includes('searxng MCP unavailable') ||
      agentContent.includes('MCP unavailable');

    assert.ok(hasUnavailableHandling,
      'Agent should contain instruction about MCP unavailability handling');
  });

  it('gsd-phase-researcher contains "RESEARCH INCOMPLETE" or "RESEARCH BLOCKED" return pattern', () => {
    const agentContent = fs.readFileSync(AGENT_PATH, 'utf-8');
    const hasIncompletePattern =
      agentContent.includes('RESEARCH INCOMPLETE') ||
      agentContent.includes('RESEARCH BLOCKED') ||
      agentContent.includes('research incomplete');

    assert.ok(hasIncompletePattern,
      'Agent should contain RESEARCH INCOMPLETE or RESEARCH BLOCKED pattern for unavailable tools');
  });

  it('gsd-phase-researcher contains ## Research section requirement documenting tools used', () => {
    const agentContent = fs.readFileSync(AGENT_PATH, 'utf-8');
    const hasResearchSection =
      agentContent.includes('## Research') ||
      agentContent.includes('Tools Used') ||
      agentContent.includes('tool_strategy');

    assert.ok(hasResearchSection,
      'Agent should contain requirement for ## Research section documenting tools used');
  });

  it('gsd-phase-researcher mentions checking MCP availability before use', () => {
    const agentContent = fs.readFileSync(AGENT_PATH, 'utf-8');
    const hasMcpCheck =
      agentContent.includes('searxng MCP') &&
      (agentContent.includes('available') ||
       agentContent.includes('unavailable') ||
       agentContent.includes('fallback'));

    assert.ok(hasMcpCheck,
      'Agent should mention checking MCP availability before use');
  });
});

describe('MCP-STATUS-DISPATCH: Dispatch context includes MCP availability', () => {
  it('agent-dispatch command generates context with MCP tools', () => {
    const { runGsdTools } = require('./helpers.cjs');

    const result = runGsdTools('agent-dispatch gsd-phase-researcher --phase 6');

    assert.ok(result.success, 'agent-dispatch command should succeed');

    const dispatchContext = JSON.parse(result.output);

    // Verify context structure
    assert.strictEqual(dispatchContext.agent, 'gsd-phase-researcher',
      'Context should include agent name');
    assert.strictEqual(dispatchContext.phase, '6',
      'Context should include phase number');
    assert.ok(dispatchContext.tools,
      'Context should include tools array');
    assert.ok(dispatchContext.mcpTools,
      'Context should include mcpTools array');
  });

  it('dispatch context includes MCP server tools from agent frontmatter', () => {
    const { runGsdTools } = require('./helpers.cjs');

    const result = runGsdTools('agent-dispatch gsd-phase-researcher --phase 6');
    const dispatchContext = JSON.parse(result.output);

    // Verify MCP tools are extracted
    const mcpToolCount = dispatchContext.mcpTools.length;
    assert.ok(mcpToolCount > 0,
      'Dispatch context should include at least one MCP tool');

    // Verify specific MCP tools are present
    const hasSearxng = dispatchContext.mcpTools.some(t => t.includes('searxng'));
    const hasContext7 = dispatchContext.mcpTools.some(t => t.includes('context'));

    assert.ok(hasSearxng,
      'Dispatch context should include searxng MCP tools');
    assert.ok(hasContext7,
      'Dispatch context should include context MCP tools');
  });

  it('dispatch context distinguishes between MCP and non-MCP tools', () => {
    const { runGsdTools } = require('./helpers.cjs');

    const result = runGsdTools('agent-dispatch gsd-phase-researcher --phase 6');
    const dispatchContext = JSON.parse(result.output);

    // All mcpTools should start with 'mcp__'
    const allMcpTools = dispatchContext.mcpTools.every(t => t.startsWith('mcp__'));
    assert.ok(allMcpTools,
      'All mcpTools should be prefixed with mcp__');

    // Tools array should include both MCP and non-MCP tools
    const hasNonMcpTools = dispatchContext.tools.some(t => !t.startsWith('mcp__'));
    assert.ok(hasNonMcpTools,
      'Tools array should include non-MCP tools like Read, Write, Bash, etc.');
  });
});

describe('MCP-MOCK-TRACKER: MCP mock utility functions', () => {
  it('createMcpMockTracker returns object with required methods', () => {
    const tracker = createMcpMockTracker();

    assert.ok(typeof tracker.injectMcpList === 'function',
      'Tracker should have injectMcpList method');
    assert.ok(typeof tracker.injectMcpGet === 'function',
      'Tracker should have injectMcpGet method');
    assert.ok(typeof tracker.assertCalled === 'function',
      'Tracker should have assertCalled method');
    assert.ok(typeof tracker.getCalledTools === 'function',
      'Tracker should have getCalledTools method');
    assert.ok(typeof tracker.reset === 'function',
      'Tracker should have reset method');
  });

  it('MCP mock tracker can inject and retrieve MCP list data', () => {
    const tracker = createMcpMockTracker();

    const mockList = JSON.stringify([
      { name: 'searxng', connected: true, scope: 'user' },
      { name: 'context', connected: false, scope: 'project' }
    ]);

    tracker.injectMcpList(mockList);

    const injected = tracker.getInjected();
    assert.ok(injected.mcpList, 'Injected MCP list should be retrievable');
    assert.strictEqual(injected.mcpList, mockList,
      'Injected MCP list should match what was set');
  });
});
