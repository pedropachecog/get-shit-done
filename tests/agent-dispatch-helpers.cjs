/**
 * Agent Dispatch Helpers
 *
 * Helper functions for agent testing with controlled MCP context.
 * Provides utilities for loading mock MCP configurations, extracting
 * agent frontmatter/tool declarations, and creating MCP mock trackers.
 */

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'mock-mcp-config');

/**
 * Load a mock MCP config from a fixture file.
 *
 * @param {string} fixtureName - Fixture name without .json extension
 * @returns {object} Parsed JSON configuration object
 */
function loadMockMcpConfig(fixtureName) {
  const fixturePath = path.join(FIXTURES_DIR, `${fixtureName}.json`);
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Mock MCP config fixture not found: ${fixturePath}`);
  }
  const content = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Copy a mock MCP config to a temp directory as .mcp.json.
 *
 * @param {string} tmpDir - Target directory path
 * @param {string} fixtureName - Fixture name without .json extension
 * @returns {string} Path to created .mcp.json file
 */
function setupMockMcpConfig(tmpDir, fixtureName) {
  const config = loadMockMcpConfig(fixtureName);
  const mcpPath = path.join(tmpDir, '.mcp.json');
  fs.writeFileSync(mcpPath, JSON.stringify(config, null, 2), 'utf-8');
  return mcpPath;
}

/**
 * Extract tools array from agent frontmatter.
 *
 * @param {string} agentPath - Path to agent .md file
 * @returns {string[]} Array of trimmed tool names (empty array if no tools field)
 */
function extractAgentTools(agentPath) {
  const content = fs.readFileSync(agentPath, 'utf-8');
  const toolsMatch = content.match(/^tools:\s*(.+)$/m);
  if (!toolsMatch) {
    return [];
  }
  return toolsMatch[1].split(',').map(t => t.trim()).filter(t => t);
}

/**
 * Extract entire frontmatter block from agent file as object.
 *
 * @param {string} agentPath - Path to agent .md file
 * @returns {object} Frontmatter key-value pairs
 */
function extractAgentFrontmatter(agentPath) {
  const content = fs.readFileSync(agentPath, 'utf-8');
  const frontmatterMatch = content.match(/^---[\r\n]([\s\S]*?)[\r\n]---/);
  if (!frontmatterMatch) {
    return {};
  }

  const frontmatterBlock = frontmatterMatch[1];
  const fields = {};

  for (const line of frontmatterBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();
    if (key && value) {
      fields[key] = value;
    }
  }

  return fields;
}

/**
 * Create an MCP mock tracker for testing.
 *
 * Returns an object with methods to inject mock MCP data and
 * track which tools were called during test execution.
 *
 * Based on pattern from tests/research-visibility.test.cjs
 *
 * @returns {object} MCP mock tracker with inject and assertion methods
 */
function createMcpMockTracker() {
  const calledTools = [];
  let injectedMcpList = null;
  let injectedMcpGet = null;
  let injectedClaudeVersion = null;

  return {
    /**
     * Inject mock mcp list output
     * @param {string} mockList - JSON string of mock MCP list
     */
    injectMcpList(mockList) {
      injectedMcpList = mockList;
    },

    /**
     * Inject mock mcp get output
     * @param {string} mockGet - JSON string of mock MCP get
     */
    injectMcpGet(mockGet) {
      injectedMcpGet = mockGet;
    },

    /**
     * Inject mock Claude CLI version
     * @param {string|null} version - Version string or null for missing CLI
     */
    injectClaudeVersion(version) {
      injectedClaudeVersion = version;
    },

    /**
     * Get list of tools that were called
     * @returns {string[]} Array of called tool names
     */
    getCalledTools() {
      return [...calledTools];
    },

    /**
     * Assert that specific tools were called
     * @param {string[]} expectedTools - Tool names that should have been called
     */
    assertCalled(expectedTools) {
      for (const tool of expectedTools) {
        if (!calledTools.includes(tool)) {
          throw new Error(`Expected tool '${tool}' to be called, but it was not`);
        }
      }
    },

    /**
     * Reset the tracker state
     */
    reset() {
      calledTools.length = 0;
      injectedMcpList = null;
      injectedMcpGet = null;
      injectedClaudeVersion = null;
    },

    /**
     * Internal: Record a tool call (for use by tested code)
     * @param {string} toolName - Name of the tool being called
     */
    _recordToolCall(toolName) {
      calledTools.push(toolName);
    },

    /**
     * Get injected values (for testing)
     * @returns {object} Object with injected values
     */
    getInjected() {
      return {
        mcpList: injectedMcpList,
        mcpGet: injectedMcpGet,
        claudeVersion: injectedClaudeVersion,
      };
    },
  };
}

module.exports = {
  loadMockMcpConfig,
  setupMockMcpConfig,
  extractAgentTools,
  extractAgentFrontmatter,
  createMcpMockTracker,
};
