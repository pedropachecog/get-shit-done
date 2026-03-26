<purpose>
Research Stack Preflight Check — Visibility-Only

This workflow is a visibility-only preflight check. It inspects the local research stack readiness but does NOT execute any research operations. Users should run this before starting research-heavy workflows to verify their local infrastructure is available.

Output states:
- `ready`: At least one local MCP provider is connected with no warnings
- `degraded`: At least one provider connected, but warnings or remediations exist
- `blocked`: No providers connected, Claude CLI unavailable, or no MCP configured
</purpose>

<execution>
# Run the research-status CLI
# This is a visibility-only check — no research is executed
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" research-status ${ARGS}
</execution>

<output_contract>
The output will show:

**Status Label:** One of `ready`, `degraded`, or `blocked`

**Active Scopes:** List of scopes with connected providers (`user`, `project`, or `local`)

**Providers Section:** For each MCP server:
- Name
- Connection status (connected/disconnected)
- Scope (user, project, or local)
- Transport type (stdio, etc.)
- Config source file path

**Warnings:** (if any) Issues that don't block research but warrant attention

**Remediations:** (if any) Actionable steps to resolve blocked or degraded states

Each remediation includes:
- Error code (e.g., CLI_MISSING, NO_MCP_CONFIGURED, ZERO_CONNECTED, PROVIDER_DISCONNECTED, INVALID_MCP_JSON)
- Human-readable message
- Documentation link

Exit codes:
- 0: `ready` or `degraded` status
- 1: `blocked` status
</output_contract>

<scope_labels>
**user:** Configured in ~/.claude.json — applies to all projects

**project:** Configured in .mcp.json — applies to current project only (may require approval)

**local:** Configured in .claude/settings.local.json — project-specific local overrides
</scope_labels>

<remediation_codes>
| Code | When It Occurs | Fix |
|------|---------------|-----|
| CLI_MISSING | Claude CLI not found or not executable | Install Claude CLI or add to PATH |
| NO_MCP_CONFIGURED | No MCP servers configured | Run `claude mcp add <name>` |
| ZERO_CONNECTED | MCP servers configured but none connected | Verify server processes are running |
| PROVIDER_DISCONNECTED | Specific provider is disconnected | Check server availability and retry |
| INVALID_MCP_JSON | .mcp.json exists but contains invalid JSON | Fix syntax errors in config file |
</remediation_codes>

<troubleshooting>
## Fallback Diagnostic Commands

If the status check fails or you need more detail, run these diagnostic commands manually:

```bash
# Check Claude CLI version
claude --version

# List all configured MCP servers
claude mcp list

# Get details for a specific server
claude mcp get <name>
```

Example:
```bash
claude mcp get searxng
```

These commands query the live MCP state directly from Claude CLI, bypassing config file assumptions.
</troubleshooting>

<visibility_only>
This workflow is visibility-only per Phase 2 boundary decisions. It reports on research infrastructure availability but does not execute research operations or make assumptions about research outcomes.
</visibility_only>
