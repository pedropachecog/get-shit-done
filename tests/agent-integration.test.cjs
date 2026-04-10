/**
 * Agent Integration Tests
 *
 * Integration tests verifying that agent structured returns include proper
 * tool usage documentation and fallback chain documentation in RESEARCH.md.
 *
 * Requirements covered:
 * - INTEGRATION-01: Tests verify agent structured returns include ## Research
 *   section with tool usage documentation
 * - INTEGRATION-02: Tests verify fallback chains are documented (searxng →
 *   WebSearch when unavailable)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  parseResearchSection,
  validateToolDocumentation,
  validateFallbackDocumentation,
  createMockResearchOutput,
  loadMockResearchOutput,
} = require('./integration-helpers.cjs');

// ─── INTEGRATION-01: Tool usage documentation verification ──────────────────

describe('INTEGRATION-01: Tool usage documentation verification', () => {
  test('complete RESEARCH.md includes ## Research section with tool documentation', () => {
    // Load fixture with complete tool usage
    const researchMd = loadMockResearchOutput('complete-tool-usage');

    // Parse ## Research section using helper
    const researchSection = parseResearchSection(researchMd);

    // Verify ## Research section was found
    assert.ok(researchSection, '## Research section should be present');

    // Verify toolsUsed array contains MCP tools
    assert.ok(Array.isArray(researchSection.toolsUsed), 'toolsUsed should be an array');
    assert.ok(researchSection.toolsUsed.length > 0, 'toolsUsed should have at least one tool');

    // Verify at least one MCP tool is present (pattern: mcp__*__*)
    const hasMcpTool = researchSection.toolsUsed.some(t => /^mcp__.*__.*$/.test(t));
    assert.ok(hasMcpTool, 'Should include at least one MCP tool (mcp__*__*)');

    // Verify sourcesConsulted has entries with URLs
    assert.ok(Array.isArray(researchSection.sourcesConsulted), 'sourcesConsulted should be an array');
    assert.ok(researchSection.sourcesConsulted.length > 0, 'sourcesConsulted should have at least one entry');

    const hasUrl = researchSection.sourcesConsulted.some(s => s.url !== null);
    assert.ok(hasUrl, 'At least one source should have a URL');
  });

  test('RESEARCH.md with missing ## Research section fails validation', () => {
    // Load fixture without ## Research section
    const researchMd = loadMockResearchOutput('missing-research-section');

    // Parse ## Research section (should return null)
    const researchSection = parseResearchSection(researchMd);
    assert.strictEqual(researchSection, null, 'parseResearchSection should return null when ## Research section is missing');

    // Assert validation fails appropriately
    const validation = validateToolDocumentation(researchSection);
    assert.strictEqual(validation.valid, false, 'validateToolDocumentation should return valid: false');
    assert.ok(validation.errors.length > 0, 'Should have at least one error');
    assert.ok(
      validation.errors.some(e => e.includes('Research section')),
      'Error should mention missing Research section'
    );
  });

  test('RESEARCH INCOMPLETE format is valid when tools unavailable', () => {
    // Load blocked-no-tools fixture
    const researchMd = loadMockResearchOutput('blocked-no-tools');

    // Verify "RESEARCH INCOMPLETE" header exists
    assert.ok(researchMd.includes('RESEARCH INCOMPLETE'), 'Should include RESEARCH INCOMPLETE header');

    // Verify "What was attempted" section documents tool calls
    assert.ok(researchMd.includes('What was attempted'), 'Should include "What was attempted" section');

    // Verify attempted tools are documented
    assert.ok(researchMd.includes('searxng'), 'Should mention searxng in attempted tools');

    // Verify "Options" section provides next steps
    assert.ok(researchMd.includes('Options'), 'Should include "Options" section');

    // Verify options are enumerated
    const optionsMatch = researchMd.match(/\d+\.\s+/g);
    assert.ok(optionsMatch && optionsMatch.length >= 2, 'Should have at least 2 options listed');
  });

  test('validateToolDocumentation accepts properly documented RESEARCH.md', () => {
    // Load fixture with complete tool usage
    const researchMd = loadMockResearchOutput('complete-tool-usage');
    const researchSection = parseResearchSection(researchMd);

    const validation = validateToolDocumentation(researchSection);

    assert.strictEqual(validation.valid, true, 'Should be valid with proper tool documentation');
    assert.strictEqual(validation.errors.length, 0, 'Should have no errors');
  });

  test('validateToolDocumentation checks for MCP tool pattern', () => {
    // Create mock output with MCP tools
    const mockMd = createMockResearchOutput({
      hasTools: true,
      tools: ['mcp__searxng__searxng_web_search', 'mcp__context__query-docs'],
    });
    const researchSection = parseResearchSection(mockMd);
    const validation = validateToolDocumentation(researchSection);

    assert.strictEqual(validation.valid, true, 'Should validate MCP tools correctly');
  });
});

// ─── INTEGRATION-02: Fallback chain verification ─────────────────────────────

describe('INTEGRATION-02: Fallback chain verification', () => {
  test('fallback chain documented when searxng MCP unavailable', () => {
    // Load fallback-chain fixture
    const researchMd = loadMockResearchOutput('fallback-chain');

    // Parse ## Research section
    const researchSection = parseResearchSection(researchMd);
    assert.ok(researchSection, '## Research section should be present');

    // Verify fallback chain is mentioned (searxng MCP unavailable → WebSearch)
    const rawContent = researchSection.raw;
    assert.ok(
      rawContent.toLowerCase().includes('searxng') && rawContent.toLowerCase().includes('unavailable'),
      'Should mention searxng as unavailable'
    );

    // Verify fallback tool (WebSearch) is documented
    assert.ok(
      researchSection.toolsUsed.some(t => t.includes('WebSearch')) ||
      rawContent.toLowerCase().includes('websearch'),
      'Should document WebSearch as fallback tool'
    );

    // Verify fallback language is present
    assert.ok(
      rawContent.toLowerCase().includes('fallback'),
      'Should include fallback language'
    );
  });

  test('fallback chain includes WebSearch query documentation', () => {
    // Load fallback-chain fixture
    const researchMd = loadMockResearchOutput('fallback-chain');

    // Verify WebSearch queries are documented with current year (2026)
    assert.ok(
      researchMd.includes('2026'),
      'Should include current year (2026) in WebSearch queries'
    );

    // Verify WebSearch queries are documented
    assert.ok(
      researchMd.includes('WebSearch Fallback Queries'),
      'Should document WebSearch queries used'
    );

    // Parse and verify confidence levels reflect fallback usage
    const researchSection = parseResearchSection(researchMd);

    // Confidence should reflect fallback usage (not all HIGH)
    const hasLowerConfidence = Object.values(researchSection.confidence).some(
      level => level === 'MEDIUM' || level === 'LOW'
    );
    assert.ok(
      hasLowerConfidence,
      'Confidence levels should reflect fallback usage (not all HIGH)'
    );
  });

  test('validateFallbackDocumentation accepts documented fallback chain', () => {
    // Create mock output with fallback
    const mockMd = createMockResearchOutput({
      hasTools: true,
      hasFallback: true,
      unavailableTool: 'searxng',
    });

    const researchSection = parseResearchSection(mockMd);
    const validation = validateFallbackDocumentation(researchSection, {
      expectedFallback: 'WebSearch',
      unavailableTool: 'searxng',
    });

    assert.strictEqual(validation.valid, true, 'Should validate fallback chain correctly');
    assert.strictEqual(validation.errors.length, 0, 'Should have no errors');
  });

  test('validateFallbackDocumentation rejects missing fallback documentation', () => {
    // Create mock without fallback but validate as if fallback expected
    const mockMd = createMockResearchOutput({
      hasTools: true,
      hasFallback: false,
    });

    const researchSection = parseResearchSection(mockMd);
    const validation = validateFallbackDocumentation(researchSection, {
      expectedFallback: 'WebSearch',
      unavailableTool: 'searxng',
    });

    assert.strictEqual(validation.valid, false, 'Should be invalid without fallback documentation');
    assert.ok(validation.errors.length > 0, 'Should have errors');
  });
});

// ─── End-to-end integration flow ─────────────────────────────────────────────

describe('End-to-end integration flow', () => {
  test('integration flow: mock output → parsing → validation → success', () => {
    // Step 1: Create mock RESEARCH.md using helper
    const mockMd = createMockResearchOutput({
      hasTools: true,
      hasFallback: false,
      hasGaps: true,
      tools: ['mcp__searxng__searxng_web_search', 'mcp__searxng__web_url_read', 'mcp__context__query-docs'],
    });

    // Step 2: Parse with parseResearchSection
    const researchSection = parseResearchSection(mockMd);
    assert.ok(researchSection, 'Should parse Research section');

    // Step 3: Validate with validateToolDocumentation
    const toolValidation = validateToolDocumentation(researchSection);
    assert.strictEqual(toolValidation.valid, true, 'Tool documentation should be valid');

    // Step 4: Verify structure
    assert.ok(researchSection.toolsUsed.length === 3, 'Should have 3 tools');
    assert.ok(Object.keys(researchSection.confidence).length > 0, 'Should have confidence levels');
    assert.ok(researchSection.gaps, 'Should have gaps section');

    // Full pipeline succeeded
    assert.ok(true, 'Full integration pipeline completed successfully');
  });

  test('integration flow with fallback: mock output → parsing → fallback validation → success', () => {
    // Step 1: Create mock RESEARCH.md with fallback
    const mockMd = createMockResearchOutput({
      hasTools: true,
      hasFallback: true,
      hasGaps: true,
      unavailableTool: 'searxng',
    });

    // Step 2: Parse with parseResearchSection
    const researchSection = parseResearchSection(mockMd);
    assert.ok(researchSection, 'Should parse Research section');

    // Step 3: Validate with validateToolDocumentation
    const toolValidation = validateToolDocumentation(researchSection);
    assert.strictEqual(toolValidation.valid, true, 'Tool documentation should be valid');

    // Step 4: Validate with validateFallbackDocumentation
    const fallbackValidation = validateFallbackDocumentation(researchSection, {
      expectedFallback: 'WebSearch',
      unavailableTool: 'searxng',
    });
    assert.strictEqual(fallbackValidation.valid, true, 'Fallback documentation should be valid');

    // Full pipeline succeeded
    assert.ok(true, 'Full fallback integration pipeline completed successfully');
  });

  test('integration flow: blocked scenario → parsing returns null → validation fails appropriately', () => {
    // Load blocked-no-tools fixture
    const researchMd = loadMockResearchOutput('blocked-no-tools');

    // RESEARCH INCOMPLETE format doesn't have ## Research section
    const researchSection = parseResearchSection(researchMd);
    // Note: blocked-no-tools.md may not have a ## Research section (it's RESEARCH INCOMPLETE)
    // This is expected behavior for blocked scenarios

    // Validation should fail appropriately when no Research section
    const toolValidation = validateToolDocumentation(researchSection);
    assert.strictEqual(toolValidation.valid, false, 'Should be invalid for RESEARCH INCOMPLETE');
    assert.ok(
      toolValidation.errors.some(e => e.includes('Research section')),
      'Error should mention missing Research section'
    );
  });

  test('all fixtures can be loaded and processed', () => {
    // Test that all fixtures can be loaded
    const fixtures = [
      'complete-tool-usage',
      'fallback-chain',
      'blocked-no-tools',
      'missing-research-section',
    ];

    for (const fixture of fixtures) {
      const content = loadMockResearchOutput(fixture);
      assert.ok(content.length > 0, `${fixture} should have content`);

      // Parse each fixture
      const researchSection = parseResearchSection(content);

      // Validate each fixture
      const validation = validateToolDocumentation(researchSection);
      // Note: validation may or may not pass depending on fixture type
      // This test just verifies the pipeline doesn't crash
      assert.ok(
        validation.valid === true || validation.valid === false,
        `${fixture}: validation should return boolean valid field`
      );
    }

    assert.ok(true, 'All fixtures processed successfully');
  });
});
