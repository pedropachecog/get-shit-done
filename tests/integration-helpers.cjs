/**
 * Integration Test Helpers for RESEARCH.md Parsing and Validation
 *
 * Provides utilities for parsing RESEARCH.md output from agents and
 * validating that structured returns include proper tool usage documentation
 * and fallback chain documentation.
 *
 * Exports:
 * - parseResearchSection: Extracts ## Research section from markdown
 * - validateToolDocumentation: Validates MCP tool documentation exists
 * - validateFallbackDocumentation: Validates fallback chain documentation
 * - createMockResearchOutput: Generates mock RESEARCH.md for testing
 * - loadMockResearchOutput: Loads mock RESEARCH.md fixture from disk
 */

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'mock-research-output');

/**
 * Extract the ## Research section from markdown content.
 *
 * @param {string} researchMdContent - Full RESEARCH.md content
 * @returns {object|null} Object with {toolsUsed: [], sourcesConsulted: [], confidence: {}, gaps: string}
 *   or null if ## Research section not found
 */
function parseResearchSection(researchMdContent) {
  // Look for ## Research section - capture everything until next ## heading or end
  // Use non-lazy match to capture everything after ## Research
  const researchMatch = researchMdContent.match(/##\s*Research\s*\n([\s\S]*)/m);

  if (!researchMatch) {
    return null;
  }

  const researchSection = researchMatch[1];

  // Extract Tools Used list - use split approach for more reliable parsing
  const toolsUsed = [];
  const toolsHeaderIdx = researchSection.indexOf('**Tools Used:**');
  if (toolsHeaderIdx !== -1) {
    const afterToolsHeader = researchSection.substring(toolsHeaderIdx + '**Tools Used:**'.length);
    // Find where the next section starts or end of section
    const nextSectionIdx = Math.min(
      afterToolsHeader.indexOf('\n**Sources Consulted:**') !== -1 ? afterToolsHeader.indexOf('\n**Sources Consulted:**') : Infinity,
      afterToolsHeader.indexOf('\n**Confidence:**') !== -1 ? afterToolsHeader.indexOf('\n**Confidence:**') : Infinity,
      afterToolsHeader.indexOf('\n**Gaps:**') !== -1 ? afterToolsHeader.indexOf('\n**Gaps:**') : Infinity,
    );
    const toolsText = nextSectionIdx !== Infinity ? afterToolsHeader.substring(0, nextSectionIdx) : afterToolsHeader;

    // Extract tool lines
    const toolLines = toolsText.split('\n').filter(line => line.trim().startsWith('-'));
    for (const line of toolLines) {
      const trimmed = line.trim().substring(1).trim(); // Remove leading "- "
      // Extract tool name before colon if present (e.g., "mcp__searxng__web_search: Search for X")
      const toolName = trimmed.split(':')[0].trim();
      if (toolName) {
        toolsUsed.push(toolName);
      }
    }
  }

  // Extract Sources Consulted list
  const sourcesConsulted = [];
  const sourcesHeaderIdx = researchSection.indexOf('**Sources Consulted:**');
  if (sourcesHeaderIdx !== -1) {
    const afterSourcesHeader = researchSection.substring(sourcesHeaderIdx + '**Sources Consulted:**'.length);
    const nextSectionIdx = Math.min(
      afterSourcesHeader.indexOf('\n**Confidence:**') !== -1 ? afterSourcesHeader.indexOf('\n**Confidence:**') : Infinity,
      afterSourcesHeader.indexOf('\n**Gaps:**') !== -1 ? afterSourcesHeader.indexOf('\n**Gaps:**') : Infinity,
    );
    const sourcesText = nextSectionIdx !== Infinity ? afterSourcesHeader.substring(0, nextSectionIdx) : afterSourcesHeader;

    // Extract numbered list items with URLs
    const sourceLines = sourcesText.split('\n').filter(line => /^\d+\./.test(line.trim()));
    for (const line of sourceLines) {
      const trimmed = line.trim().substring(line.indexOf('.') + 1).trim();
      // Try to extract URL from the source entry
      const urlMatch = trimmed.match(/https?:\/\/[^\s\)]+/);
      const url = urlMatch ? urlMatch[0] : null;
      sourcesConsulted.push({
        entry: trimmed,
        url: url,
      });
    }
  }

  // Extract Confidence levels
  const confidence = {};
  const confidenceHeaderIdx = researchSection.indexOf('**Confidence:**');
  if (confidenceHeaderIdx !== -1) {
    const afterConfidenceHeader = researchSection.substring(confidenceHeaderIdx + '**Confidence:**'.length);
    const nextSectionIdx = afterConfidenceHeader.indexOf('\n**Gaps:**') !== -1 ? afterConfidenceHeader.indexOf('\n**Gaps:**') : Infinity;
    const confidenceText = nextSectionIdx !== Infinity ? afterConfidenceHeader.substring(0, nextSectionIdx) : afterConfidenceHeader;

    // Parse lines like "- Standard Stack: HIGH - reason"
    const confLines = confidenceText.split('\n').filter(line => line.trim().startsWith('-'));
    for (const line of confLines) {
      const trimmed = line.trim().substring(2).trim(); // Remove "- "
      const match = trimmed.match(/^([^:]+):\s*(HIGH|MEDIUM|LOW)/i);
      if (match) {
        const area = match[1].trim();
        const level = match[2].toUpperCase();
        confidence[area] = level;
      }
    }
  }

  // Extract Gaps
  const gapsMatch = researchSection.match(/\*\*Gaps:\*\*\s*([^\n]+)/m);
  const gaps = gapsMatch ? gapsMatch[1].trim() : '';

  return {
    toolsUsed,
    sourcesConsulted,
    confidence,
    gaps,
    raw: researchSection,
  };
}

/**
 * Validate that the ## Research section has proper tool documentation.
 *
 * @param {object} researchSection - Output from parseResearchSection
 * @returns {object} {valid: boolean, errors: []}
 */
function validateToolDocumentation(researchSection) {
  const errors = [];

  if (!researchSection) {
    errors.push('## Research section not found in RESEARCH.md');
    return { valid: false, errors };
  }

  if (!researchSection.raw.includes('Tools Used:')) {
    errors.push('"Tools Used:" heading not found in ## Research section');
  }

  if (researchSection.toolsUsed.length === 0) {
    errors.push('No tools documented in Tools Used section');
  }

  // Check for at least one MCP tool (pattern: mcp__*__*)
  const hasMcpTool = researchSection.toolsUsed.some(t => /^mcp__.*__.*$/.test(t));
  if (!hasMcpTool && researchSection.toolsUsed.length > 0) {
    // If tools are listed but none are MCP tools, check if WebSearch or WebFetch is used (acceptable fallback)
    const hasBuiltInTool = researchSection.toolsUsed.some(t => /^WebSearch$|^WebFetch$/.test(t));
    if (!hasBuiltInTool) {
      errors.push('No MCP tools (mcp__*__*) or built-in tools (WebSearch, WebFetch) documented');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that fallback chain is documented when expected.
 *
 * @param {object} researchSection - Output from parseResearchSection
 * @param {object} options - Options for validation
 * @param {string} [options.expectedFallback] - Expected fallback tool (e.g., 'WebSearch')
 * @param {string} [options.unavailableTool] - Tool that was unavailable (e.g., 'searxng')
 * @returns {object} {valid: boolean, errors: []}
 */
function validateFallbackDocumentation(researchSection, options = {}) {
  const { expectedFallback, unavailableTool } = options;
  const errors = [];

  if (!researchSection) {
    errors.push('## Research section not found in RESEARCH.md');
    return { valid: false, errors };
  }

  const rawContent = researchSection.raw || '';

  // If an unavailable tool is specified, check that it's mentioned as unavailable
  if (unavailableTool) {
    const mentionsUnavailable = rawContent.toLowerCase().includes(unavailableTool.toLowerCase()) &&
      rawContent.toLowerCase().includes('unavailable');
    if (!mentionsUnavailable) {
      errors.push(`Documentation should mention ${unavailableTool} as unavailable`);
    }
  }

  // If a fallback tool is expected, check it's documented
  if (expectedFallback) {
    const fallbackFound = researchSection.toolsUsed.includes(expectedFallback) ||
      rawContent.toLowerCase().includes(expectedFallback.toLowerCase()) &&
      rawContent.toLowerCase().includes('fallback');

    if (!fallbackFound) {
      errors.push(`Fallback tool ${expectedFallback} not documented with fallback context`);
    }
  }

  // Check for fallback chain language
  const hasFallbackChainLanguage = rawContent.toLowerCase().includes('fallback') ||
    rawContent.toLowerCase().includes('fallback from');

  if (expectedFallback && !hasFallbackChainLanguage) {
    errors.push('No fallback chain language found (e.g., "fallback from", "used as fallback")');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a mock RESEARCH.md string for testing.
 *
 * @param {object} options - Options for mock generation
 * @param {boolean} [options.hasTools=true] - Include Tools Used section
 * @param {boolean} [options.hasFallback=false] - Include fallback chain documentation
 * @param {boolean} [options.hasGaps=true] - Include Gaps section
 * @param {string[]} [options.tools] - Specific tools to document
 * @param {string} [options.unavailableTool] - Tool to mark as unavailable for fallback scenario
 * @returns {string} Mock RESEARCH.md content
 */
function createMockResearchOutput(options = {}) {
  const {
    hasTools = true,
    hasFallback = false,
    hasGaps = true,
    tools = hasFallback ? ['WebSearch'] : ['mcp__searxng__searxng_web_search', 'mcp__searxng__web_url_read'],
    unavailableTool = 'searxng',
  } = options;

  let content = `# Phase 08: Integration Tests - Research

**Researched:** 2026-03-27
**Domain:** Integration testing
**Confidence:** HIGH

## Summary

This is a mock RESEARCH.md for integration testing purposes.

## Research

`;

  if (hasTools) {
    content += `**Tools Used:**
`;
    if (hasFallback) {
      content += `- WebSearch: ${unavailableTool} MCP unavailable, used as fallback
`;
    } else {
      for (const tool of tools) {
        content += `- ${tool}: Used for research
`;
      }
    }
  }

  content += `
**Sources Consulted:**
1. [Test Source] - https://example.com/test - Mock source for testing
2. [Documentation] - https://docs.example.com - Example documentation
`;

  content += `
**Confidence:**
- Standard Stack: HIGH — Well documented in sources
- Architecture: HIGH — Clear patterns identified
- Pitfalls: MEDIUM — Some areas need validation
`;

  if (hasGaps) {
    content += `

**Gaps:** None — all areas researched successfully
`;
  }

  return content;
}

/**
 * Load a mock RESEARCH.md fixture from disk.
 *
 * @param {string} fixtureName - Fixture name without .md extension
 * @returns {string} File contents
 * @throws {Error} If fixture not found
 */
function loadMockResearchOutput(fixtureName) {
  const fixturePath = path.join(FIXTURES_DIR, `${fixtureName}.md`);
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Mock RESEARCH.md fixture not found: ${fixturePath}`);
  }
  return fs.readFileSync(fixturePath, 'utf-8');
}

// Export functions
module.exports = {
  parseResearchSection,
  validateToolDocumentation,
  validateFallbackDocumentation,
  createMockResearchOutput,
  loadMockResearchOutput,
};

// ─── Self-test when run directly with node:test ──────────────────────────────

if (require.main === module) {
  const { describe, it } = require('node:test');
  const assert = require('node:assert');

  describe('integration-helpers self-tests', () => {
    it('parseResearchSection extracts ## Research section from valid markdown', () => {
      const mockMd = createMockResearchOutput({ hasTools: true });
      const result = parseResearchSection(mockMd);
      assert.ok(result, 'Should parse Research section');
      assert.ok(Array.isArray(result.toolsUsed), 'Should have toolsUsed array');
      assert.ok(result.toolsUsed.length > 0, 'Should have at least one tool');
    });

    it('parseResearchSection returns null when ## Research section missing', () => {
      const noResearchMd = '# Test\n\nNo research section here.';
      const result = parseResearchSection(noResearchMd);
      assert.strictEqual(result, null, 'Should return null when no Research section');
    });

    it('validateToolDocumentation rejects missing ## Research section', () => {
      const result = validateToolDocumentation(null);
      assert.strictEqual(result.valid, false, 'Should be invalid');
      assert.ok(result.errors.some(e => e.includes('Research section')), 'Error should mention Research section');
    });

    it('validateToolDocumentation accepts mock output with tools', () => {
      const mockMd = createMockResearchOutput({ hasTools: true });
      const parsed = parseResearchSection(mockMd);
      const result = validateToolDocumentation(parsed);
      assert.strictEqual(result.valid, true, 'Should be valid with tools documented');
    });

    it('validateFallbackDocumentation accepts fallback chain documentation', () => {
      const mockMd = createMockResearchOutput({ hasTools: true, hasFallback: true });
      const parsed = parseResearchSection(mockMd);
      const result = validateFallbackDocumentation(parsed, {
        expectedFallback: 'WebSearch',
        unavailableTool: 'searxng',
      });
      assert.strictEqual(result.valid, true, 'Should be valid with fallback documented');
    });

    it('loadMockResearchOutput throws when fixture missing', () => {
      assert.throws(
        () => loadMockResearchOutput('non-existent-fixture'),
        /fixture not found/i,
        'Should throw error for missing fixture'
      );
    });
  });
}
