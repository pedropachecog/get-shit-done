/**
 * Agent MCP Tool Verification Tests
 *
 * Verifies that agent frontmatter declares required MCP tools (searxng, context7)
 * and agent instructions reference correct MCP tool usage patterns.
 *
 * Requirements covered:
 * - VERIFY-01: Frontmatter MCP tool declarations
 * - VERIFY-02: Instruction MCP usage patterns
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'agents');
const { extractAgentTools } = require('./agent-dispatch-helpers.cjs');

// ─── MCP-TOOLS: MCP tool declarations in frontmatter ─────────────────────────

describe('MCP-TOOLS: MCP tool declarations in frontmatter', () => {
  test('gsd-phase-researcher frontmatter declares searxng MCP tools (mcp__searxng__*)', () => {
    const tools = extractAgentTools(path.join(AGENTS_DIR, 'gsd-phase-researcher.md'));
    const hasSearxng = tools.some(t => t.startsWith('mcp__searxng__'));
    assert.ok(
      hasSearxng,
      'gsd-phase-researcher must declare searxng MCP tools (mcp__searxng__*) in frontmatter tools: field'
    );
  });

  test('gsd-phase-researcher frontmatter declares context7 MCP tools (mcp__context7__*)', () => {
    const tools = extractAgentTools(path.join(AGENTS_DIR, 'gsd-phase-researcher.md'));
    const hasContext7 = tools.some(t => t.startsWith('mcp__context7__'));
    assert.ok(
      hasContext7,
      'gsd-phase-researcher must declare context7 MCP tools (mcp__context7__*) in frontmatter tools: field'
    );
  });

  test('gsd-project-researcher frontmatter declares context7 MCP tools (mcp__context7__*)', () => {
    const tools = extractAgentTools(path.join(AGENTS_DIR, 'gsd-project-researcher.md'));
    const hasContext7 = tools.some(t => t.startsWith('mcp__context7__'));
    assert.ok(
      hasContext7,
      'gsd-project-researcher must declare context7 MCP tools (mcp__context7__*) in frontmatter tools: field'
    );
  });
});

// ─── MCP-USAGE: MCP tool usage patterns in instructions ──────────────────────

describe('MCP-USAGE: MCP tool usage patterns in instructions', () => {
  const phaseResearcherContent = fs.readFileSync(
    path.join(AGENTS_DIR, 'gsd-phase-researcher.md'),
    'utf-8'
  );

  test('gsd-phase-researcher contains "searxng MCP is the primary research tool" directive', () => {
    assert.ok(
      phaseResearcherContent.includes('searxng MCP is the primary research tool'),
      'gsd-phase-researcher must contain directive that "searxng MCP is the primary research tool"'
    );
  });

  test('gsd-phase-researcher contains mcp__searxng__searxng_web_search invocation pattern', () => {
    assert.ok(
      phaseResearcherContent.includes('mcp__searxng__searxng_web_search'),
      'gsd-phase-researcher must document mcp__searxng__searxng_web_search tool invocation pattern'
    );
  });

  test('gsd-phase-researcher contains mcp__searxng__web_url_read invocation pattern', () => {
    assert.ok(
      phaseResearcherContent.includes('mcp__searxng__web_url_read'),
      'gsd-phase-researcher must document mcp__searxng__web_url_read tool invocation pattern'
    );
  });

  test('gsd-phase-researcher contains mcp__context7__resolve-library-id invocation pattern', () => {
    assert.ok(
      phaseResearcherContent.includes('mcp__context7__resolve-library-id'),
      'gsd-phase-researcher must document mcp__context7__resolve-library-id tool invocation pattern'
    );
  });

  test('gsd-phase-researcher contains mcp__context7__query-docs invocation pattern', () => {
    assert.ok(
      phaseResearcherContent.includes('mcp__context7__query-docs'),
      'gsd-phase-researcher must document mcp__context7__query-docs tool invocation pattern'
    );
  });

  const projectResearcherContent = fs.readFileSync(
    path.join(AGENTS_DIR, 'gsd-project-researcher.md'),
    'utf-8'
  );

  test('gsd-project-researcher contains mcp__context7__resolve-library-id invocation pattern', () => {
    assert.ok(
      projectResearcherContent.includes('mcp__context7__resolve-library-id'),
      'gsd-project-researcher must document mcp__context7__resolve-library-id tool invocation pattern'
    );
  });
});

// ─── MCP-FALLBACK: Fallback chain documentation ──────────────────────────────

describe('MCP-FALLBACK: Fallback chain documentation', () => {
  test('gsd-phase-researcher documents fallback when searxng unavailable (to WebSearch)', () => {
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, 'gsd-phase-researcher.md'),
      'utf-8'
    );
    assert.ok(
      content.includes('Fallback') && content.includes('searxng MCP is unavailable'),
      'gsd-phase-researcher must document fallback behavior when searxng MCP is unavailable'
    );
    assert.ok(
      content.includes('WebSearch'),
      'gsd-phase-researcher must mention WebSearch as a fallback option'
    );
  });

  test('gsd-phase-researcher fallback chain is in tool_strategy section', () => {
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, 'gsd-phase-researcher.md'),
      'utf-8'
    );
    const toolStrategyMatch = content.match(/<tool_strategy>([\s\S]*?)<\/tool_strategy>/);
    assert.ok(
      toolStrategyMatch,
      'gsd-phase-researcher must have <tool_strategy> section'
    );
    const toolStrategyContent = toolStrategyMatch[1];
    assert.ok(
      toolStrategyContent.includes('Fallback') || toolStrategyContent.includes('fallback'),
      'gsd-phase-researcher tool_strategy section must document fallback chain'
    );
  });
});

// ─── MCP-PRIORITY: Tool priority documentation ───────────────────────────────

describe('MCP-PRIORITY: Tool priority documentation', () => {
  test('gsd-phase-researcher documents searxng MCP as priority 1', () => {
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, 'gsd-phase-researcher.md'),
      'utf-8'
    );
    assert.ok(
      content.includes('1st') && content.includes('searxng MCP'),
      'gsd-phase-researcher must document searxng MCP as priority 1 tool'
    );
  });

  test('gsd-phase-researcher documents Context7 as secondary research source', () => {
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, 'gsd-phase-researcher.md'),
      'utf-8'
    );
    assert.ok(
      content.includes('Context7'),
      'gsd-phase-researcher must document Context7 as a research source'
    );
  });
});

// ─── MCP-SOURCE-HIERARCHY: Source hierarchy with MCP tools ───────────────────

describe('MCP-SOURCE-HIERARCHY: Source hierarchy with MCP tools', () => {
  test('gsd-phase-researcher source_hierarchy includes searxng MCP', () => {
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, 'gsd-phase-researcher.md'),
      'utf-8'
    );
    const sourceHierarchyMatch = content.match(/<source_hierarchy>([\s\S]*?)<\/source_hierarchy>/);
    assert.ok(
      sourceHierarchyMatch,
      'gsd-phase-researcher must have <source_hierarchy> section'
    );
    const sourceHierarchyContent = sourceHierarchyMatch[1];
    assert.ok(
      sourceHierarchyContent.includes('searxng MCP'),
      'gsd-phase-researcher source_hierarchy must include searxng MCP'
    );
  });

  test('gsd-project-researcher source hierarchy includes Context7', () => {
    const content = fs.readFileSync(
      path.join(AGENTS_DIR, 'gsd-project-researcher.md'),
      'utf-8'
    );
    assert.ok(
      content.includes('Context7'),
      'gsd-project-researcher must document Context7 in source hierarchy'
    );
  });
});
