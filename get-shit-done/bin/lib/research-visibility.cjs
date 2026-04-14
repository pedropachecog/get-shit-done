/**
 * Research Visibility — Thin shared seam for local MCP research stack introspection
 *
 * Provides:
 * - buildResearchVisibilitySnapshot(cwd, options) — Build normalized snapshot object
 * - formatResearchVisibility(snapshot) — Format snapshot for human-readable output
 * - cmdResearchStatus(cwd, raw) — CLI command handler for `gsd-tools research-status`
 *
 * Design principles (from Phase 2 research):
 * - CLI-first: prefer `claude mcp list/get` for live state over config-file assumptions
 * - File-backed: use ~/.claude.json, .mcp.json, .claude/settings*.json only for source attribution
 * - Status rules: ready (at least one connected local MCP), degraded (warnings/remediations exist),
 *   blocked (Claude CLI unavailable, no MCP configured, or zero connected providers)
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { loadConfig, output, error, findProjectRoot } = require('./core.cjs');

// ─── Snapshot Builder ─────────────────────────────────────────────────────────

/**
 * Build a normalized research visibility snapshot for the current local research stack.
 *
 * @param {string} cwd - Working directory (project root)
 * @param {object} options - Optional overrides for testing (injectClaudeVersion, injectMcpList, etc.)
 * @returns {object} Snapshot with status, providers, scopes, warnings, remediations
 */
function buildResearchVisibilitySnapshot(cwd, options = {}) {
  const result = {
    status: 'blocked',
    checked_at: new Date().toISOString(),
    providers: [],
    active_scopes: [],
    warnings: [],
    remediations: [],
  };

  // Injected runners for testing (override actual CLI calls)
  const injectClaudeVersion = options.injectClaudeVersion;
  const injectMcpList = options.injectMcpList;
  const injectMcpGet = options.injectMcpGet;
  const injectFileRead = options.injectFileRead;

  // Helper: run claude --version (supports injection)
  function runClaudeVersion() {
    if (typeof injectClaudeVersion === 'function') return injectClaudeVersion();
    try {
      const out = spawnSync('claude', ['--version'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (out.error || out.status !== 0) return null;
      return out.stdout.trim();
    } catch {
      return null;
    }
  }

  // Helper: run claude mcp list (supports injection)
  function runMcpList() {
    if (typeof injectMcpList === 'function') return injectMcpList();
    try {
      const out = spawnSync('claude', ['mcp', 'list'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (out.error || out.status !== 0) return null;
      return out.stdout.trim();
    } catch {
      return null;
    }
  }

  // Helper: run claude mcp get <name> (supports injection)
  function runMcpGet(name) {
    if (typeof injectMcpGet === 'function') return injectMcpGet(name);
    try {
      const out = spawnSync('claude', ['mcp', 'get', name], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (out.error || out.status !== 0) return null;
      return out.stdout.trim();
    } catch {
      return null;
    }
  }

  // Helper: read config file (supports injection)
  function readConfigFile(filePath) {
    if (typeof injectFileRead === 'function') {
      const injected = injectFileRead(filePath);
      if (injected !== undefined) return injected;
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  // Step 1: Check Claude CLI availability
  const claudeVersion = runClaudeVersion();
  if (!claudeVersion) {
    result.status = 'blocked';
    result.remediations.push({
      code: 'CLI_MISSING',
      message: 'Claude CLI not found or not executable. Install or add to PATH.',
      docs: 'https://code.claude.com/docs/en/installation',
    });
    return result;
  }

  // Step 2: Get MCP list
  const mcpListOutput = runMcpList();
  if (!mcpListOutput || mcpListOutput === '') {
    result.status = 'blocked';
    result.remediations.push({
      code: 'NO_MCP_CONFIGURED',
      message: 'No MCP servers configured. Run `claude mcp add <name>` to add a server.',
      docs: 'https://code.claude.com/docs/en/mcp',
    });
    return result;
  }

  // Parse mcp list output — expect JSON array or newline-delimited JSON
  let mcpServers = [];
  try {
    // Try parsing as JSON array first
    mcpServers = JSON.parse(mcpListOutput);
    if (!Array.isArray(mcpServers)) {
      // Try newline-delimited JSON
      const lines = mcpListOutput.split('\n').filter(Boolean);
      mcpServers = lines.map(line => JSON.parse(line)).filter(Boolean);
    }
  } catch {
    // Parse as line-delimited key: value pairs (fallback)
    mcpServers = parseMcpListPlain(mcpListOutput);
  }

  // Step 3: Build provider objects
  const connectedProviders = [];
  const disconnectedProviders = [];
  const activeScopes = new Set();

  for (const server of mcpServers) {
    const provider = {
      name: server.name || server.server || 'unknown',
      connected: server.connected === true,
      scope: server.scope || 'unknown',
      transport: server.transport || 'unknown',
      source: determineConfigSource(server.scope, cwd),
      remediation: null,
    };

    if (server.connected === true) {
      connectedProviders.push(provider);
      activeScopes.add(provider.scope);
    } else {
      provider.remediation = 'Provider configured but not connected. Check server availability and retry.';
      disconnectedProviders.push(provider);
      result.warnings.push(`Provider ${provider.name} is configured but not connected`);
    }

    result.providers.push(provider);
  }

  result.active_scopes = Array.from(activeScopes);

  // Step 4: Determine status
  if (connectedProviders.length === 0) {
    // Zero connected providers → blocked
    result.status = 'blocked';
    if (mcpServers.length > 0) {
      result.remediations.push({
        code: 'ZERO_CONNECTED',
        message: 'MCP servers are configured but none are connected. Verify server processes are running.',
        docs: 'https://code.claude.com/docs/en/mcp',
      });
    }
  } else if (disconnectedProviders.length > 0 || result.warnings.length > 0) {
    // At least one connected, but warnings exist → degraded
    result.status = 'degraded';
    // Add remediation for disconnected providers
    for (const dp of disconnectedProviders) {
      result.remediations.push({
        code: 'PROVIDER_DISCONNECTED',
        message: `Provider ${dp.name} is disconnected. Verify server process and configuration.`,
        docs: 'https://code.claude.com/docs/en/mcp',
      });
    }
  } else {
    // At least one connected, no warnings → ready
    result.status = 'ready';
  }

  // Step 5: Check for .mcp.json config issues
  const projectMcpJson = path.join(cwd, '.mcp.json');
  if (fs.existsSync(projectMcpJson)) {
    const mcpConfig = readConfigFile(projectMcpJson);
    if (mcpConfig === null) {
      result.warnings.push('Project .mcp.json exists but is invalid JSON');
      result.remediations.push({
        code: 'INVALID_MCP_JSON',
        message: 'Project .mcp.json contains invalid JSON. Fix syntax errors.',
        docs: 'https://code.claude.com/docs/en/mcp',
      });
      // If we have connected providers but invalid .mcp.json, status is degraded (not blocked)
      if (result.status === 'ready') {
        result.status = 'degraded';
      }
    } else {
      // Check if project-scope servers need approval
      const mcpServersConfig = mcpConfig.mcpServers || mcpConfig.servers || {};
      if (Object.keys(mcpServersConfig).length > 0) {
        // Project-scope servers may require approval
        const connectedNames = connectedProviders.map(p => p.name);
        for (const serverName of Object.keys(mcpServersConfig)) {
          if (!connectedNames.includes(serverName)) {
            result.warnings.push(`Project-scope server ${serverName} is configured but not connected (may require approval)`);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Parse plain-text mcp list output (fallback when JSON fails).
 *
 * Handles the `claude mcp list` human-readable format:
 *   name: command-or-url - ✓ Connected
 *   name: url - ! Needs authentication
 *   name: command - ✗ Failed to connect
 */
function parseMcpListPlain(output) {
  const servers = [];
  const lines = output.split('\n').filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('Checking') || line.startsWith('═') || line.startsWith('─')) {
      continue;
    }

    const sepIdx = line.lastIndexOf(' - ');
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1 || sepIdx === -1 || sepIdx < colonIdx) continue;

    const name = line.substring(0, colonIdx).trim();
    if (!name) continue;

    const status = line.substring(sepIdx + 3);
    const connected = status.includes('✓') && status.includes('Connected');
    const needsAuth = status.includes('!') && status.includes('authentication');
    const failed = status.includes('✗');

    servers.push({ name, connected, needsAuth, failed });
  }

  return servers;
}

/**
 * Determine config source based on scope
 */
function determineConfigSource(scope, cwd) {
  const homedir = require('os').homedir();
  switch (scope) {
    case 'user':
      return path.join(homedir, '.claude.json');
    case 'project':
      return path.join(cwd, '.mcp.json');
    case 'local':
      return path.join(cwd, '.claude', 'settings.local.json');
    default:
      return 'unknown';
  }
}

// ─── Formatter ────────────────────────────────────────────────────────────────

/**
 * Format a research visibility snapshot for human-readable output.
 *
 * @param {object} snapshot - Research visibility snapshot from buildResearchVisibilitySnapshot
 * @returns {string} Human-readable formatted output
 */
function formatResearchVisibility(snapshot) {
  const lines = [];

  lines.push('═'.repeat(60));
  lines.push('Research Visibility Snapshot');
  lines.push('═'.repeat(60));
  lines.push('');

  // Status header
  const statusEmoji = {
    ready: '✓',
    degraded: '⚠',
    blocked: '✗',
  };
  const statusLabel = {
    ready: 'Ready',
    degraded: 'Degraded',
    blocked: 'Blocked',
  };

  lines.push(`Status: ${statusEmoji[snapshot.status] || '?'} ${statusLabel[snapshot.status] || snapshot.status}`);
  lines.push(`Checked: ${snapshot.checked_at}`);
  lines.push('');

  // Active scopes
  if (snapshot.active_scopes.length > 0) {
    lines.push(`Active Scopes: ${snapshot.active_scopes.join(', ')}`);
  } else {
    lines.push('Active Scopes: (none)');
  }
  lines.push('');

  // Providers section
  lines.push('─'.repeat(40));
  lines.push('Providers:');
  lines.push('─'.repeat(40));

  if (snapshot.providers.length === 0) {
    lines.push('  (no MCP servers configured)');
  } else {
    for (const provider of snapshot.providers) {
      const connStatus = provider.connected ? 'connected' : 'disconnected';
      lines.push(`  • ${provider.name}: ${connStatus}`);
      lines.push(`    Scope: ${provider.scope}`);
      lines.push(`    Transport: ${provider.transport}`);
      lines.push(`    Source: ${provider.source}`);
      if (provider.remediation) {
        lines.push(`    Note: ${provider.remediation}`);
      }
    }
  }
  lines.push('');

  // Warnings section
  if (snapshot.warnings.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('Warnings:');
    lines.push('─'.repeat(40));
    for (const warning of snapshot.warnings) {
      lines.push(`  • ${warning}`);
    }
    lines.push('');
  }

  // Remediations section
  if (snapshot.remediations.length > 0) {
    lines.push('─'.repeat(40));
    lines.push('Remediations:');
    lines.push('─'.repeat(40));
    for (const rem of snapshot.remediations) {
      lines.push(`  • [${rem.code}] ${rem.message}`);
      if (rem.docs) {
        lines.push(`    Docs: ${rem.docs}`);
      }
    }
    lines.push('');
  }

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

// ─── CLI Command ─────────────────────────────────────────────────────────────

/**
 * CLI command handler for `gsd-tools research-status`
 *
 * @param {string} cwd - Working directory
 * @param {boolean} raw - Output as JSON when true
 */
function cmdResearchStatus(cwd, raw) {
  cwd = findProjectRoot(cwd);
  const snapshot = buildResearchVisibilitySnapshot(cwd);

  if (raw) {
    output(snapshot, true);
  } else {
    const formatted = formatResearchVisibility(snapshot);
    process.stdout.write(formatted + '\n');

    // Exit with non-zero status if blocked
    if (snapshot.status === 'blocked') {
      process.exit(1);
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  buildResearchVisibilitySnapshot,
  formatResearchVisibility,
  cmdResearchStatus,
};
