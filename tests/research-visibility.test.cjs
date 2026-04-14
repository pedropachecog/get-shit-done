/**
 * Research Visibility Tests
 *
 * Tests for get-shit-done/bin/lib/research-visibility.cjs
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { buildResearchVisibilitySnapshot, formatResearchVisibility } = require('../get-shit-done/bin/lib/research-visibility.cjs');
const { createTempProject, cleanup } = require('./helpers.cjs');

describe('research visibility', () => {
  test('missing Claude CLI => blocked', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => null,
    });

    assert.strictEqual(snapshot.status, 'blocked');
    assert.strictEqual(snapshot.providers.length, 0);
    assert.ok(snapshot.remediations.some(r => r.code === 'CLI_MISSING'));
  });

  test('zero connected providers => blocked', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => JSON.stringify([
        { name: 'searxng', connected: false, scope: 'user', transport: 'stdio' },
      ]),
    });

    assert.strictEqual(snapshot.status, 'blocked');
    assert.strictEqual(snapshot.providers.length, 1);
    assert.ok(snapshot.remediations.some(r => r.code === 'ZERO_CONNECTED'));
  });

  test('one connected provider => ready', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => JSON.stringify([
        { name: 'searxng', connected: true, scope: 'user', transport: 'stdio' },
      ]),
    });

    assert.strictEqual(snapshot.status, 'ready');
    assert.strictEqual(snapshot.providers.length, 1);
    assert.strictEqual(snapshot.providers[0].name, 'searxng');
    assert.strictEqual(snapshot.providers[0].connected, true);
    assert.strictEqual(snapshot.active_scopes[0], 'user');
    assert.strictEqual(snapshot.warnings.length, 0);
    assert.strictEqual(snapshot.remediations.length, 0);
  });

  test('one connected plus one disconnected provider => degraded', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => JSON.stringify([
        { name: 'searxng', connected: true, scope: 'user', transport: 'stdio' },
        { name: 'context', connected: false, scope: 'user', transport: 'http' },
      ]),
    });

    assert.strictEqual(snapshot.status, 'degraded');
    assert.strictEqual(snapshot.providers.length, 2);
    assert.ok(snapshot.remediations.some(r => r.code === 'PROVIDER_DISCONNECTED'));
  });

  test('invalid .mcp.json plus one connected provider => degraded', () => {
    const tmpDir = createTempProject('test-invalid-mcp-');
    try {
      // Create invalid .mcp.json
      require('fs').writeFileSync(
        path.join(tmpDir, '.mcp.json'),
        '{ invalid json }',
        'utf-8'
      );

      const snapshot = buildResearchVisibilitySnapshot(tmpDir, {
        injectClaudeVersion: () => 'claude 2.1.84',
        injectMcpList: () => JSON.stringify([
          { name: 'searxng', connected: true, scope: 'user', transport: 'stdio' },
        ]),
      });

      assert.strictEqual(snapshot.status, 'degraded');
      assert.ok(snapshot.warnings.some(w => w.includes('.mcp.json')));
      assert.ok(snapshot.remediations.some(r => r.code === 'INVALID_MCP_JSON'));
    } finally {
      cleanup(tmpDir);
    }
  });

  test('no MCP servers configured => blocked', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => '',
    });

    assert.strictEqual(snapshot.status, 'blocked');
    assert.ok(snapshot.remediations.some(r => r.code === 'NO_MCP_CONFIGURED'));
  });

  test('snapshot contains checked_at timestamp', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => JSON.stringify([
        { name: 'searxng', connected: true, scope: 'user', transport: 'stdio' },
      ]),
    });

    assert.ok(snapshot.checked_at);
    assert.doesNotThrow(() => new Date(snapshot.checked_at));
  });

  test('provider object has all required fields', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => JSON.stringify([
        { name: 'searxng', connected: true, scope: 'user', transport: 'stdio' },
      ]),
    });

    const provider = snapshot.providers[0];
    assert.ok(provider.name);
    assert.ok(typeof provider.connected === 'boolean');
    assert.ok(provider.scope);
    assert.ok(provider.transport);
    assert.ok(provider.source);
    assert.ok(provider.remediation === null || typeof provider.remediation === 'string');
  });

  test('formatResearchVisibility produces readable output', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => JSON.stringify([
        { name: 'searxng', connected: true, scope: 'user', transport: 'stdio' },
      ]),
    });

    const formatted = formatResearchVisibility(snapshot);
    assert.ok(formatted.includes('Research Visibility Snapshot'));
    assert.ok(formatted.includes('Status'));
    assert.ok(formatted.includes('Ready'));
    assert.ok(formatted.includes('searxng'));
  });

  test('formatResearchVisibility shows remediations for blocked status', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => null,
    });

    const formatted = formatResearchVisibility(snapshot);
    assert.ok(formatted.includes('Blocked'));
    assert.ok(formatted.includes('Remediations'));
  });

  test('multiple scopes are aggregated correctly', () => {
    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => JSON.stringify([
        { name: 'searxng', connected: true, scope: 'user', transport: 'stdio' },
        { name: 'context', connected: true, scope: 'project', transport: 'http' },
        { name: 'filesystem', connected: true, scope: 'local', transport: 'stdio' },
      ]),
    });

    assert.strictEqual(snapshot.status, 'ready');
    assert.strictEqual(snapshot.active_scopes.length, 3);
    assert.ok(snapshot.active_scopes.includes('user'));
    assert.ok(snapshot.active_scopes.includes('project'));
    assert.ok(snapshot.active_scopes.includes('local'));
  });

  test('project-scope source attribution', () => {
    const tmpDir = createTempProject('test-project-scope-');
    try {
      const snapshot = buildResearchVisibilitySnapshot(tmpDir, {
        injectClaudeVersion: () => 'claude 2.1.84',
        injectMcpList: () => JSON.stringify([
          { name: 'searxng', connected: true, scope: 'project', transport: 'stdio' },
        ]),
      });

      const provider = snapshot.providers[0];
      assert.ok(provider.source.includes('.mcp.json'));
    } finally {
      cleanup(tmpDir);
    }
  });

  test('parses plain-text `claude mcp list` output with mixed statuses', () => {
    const plainOutput = [
      'Checking MCP server health…',
      '',
      'claude.ai Google Drive: https://drivemcp.googleapis.com/mcp/v1 - ! Needs authentication',
      'context: context serve - ✓ Connected',
      'searxng: npx -y mcp-searxng - ✓ Connected',
      'playwright: npx -y @playwright/mcp --config /home/agent/.playwright-mcp.json - ✗ Failed to connect',
    ].join('\n');

    const snapshot = buildResearchVisibilitySnapshot('/tmp', {
      injectClaudeVersion: () => 'claude 2.1.84',
      injectMcpList: () => plainOutput,
    });

    assert.strictEqual(snapshot.status, 'degraded');
    const byName = Object.fromEntries(snapshot.providers.map(p => [p.name, p]));
    assert.strictEqual(byName['context'].connected, true);
    assert.strictEqual(byName['searxng'].connected, true);
    assert.strictEqual(byName['playwright'].connected, false);
    assert.strictEqual(byName['claude.ai Google Drive'].connected, false);
  });
});
