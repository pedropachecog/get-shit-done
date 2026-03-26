---
name: gsd:research-status
description: Check local research stack readiness and active MCP scopes
argument-hint: [--raw]
allowed-tools:
  - Bash
---
<objective>
Inspect the current local research stack readiness, list connected MCP providers with their scopes, and provide remediation guidance if the stack is degraded or blocked.

This is a visibility-only preflight command. It does NOT execute research — it only reports on the availability of local research infrastructure (Claude CLI and MCP servers).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/research-status.md
</execution_context>

<process>
Execute the research-status workflow from @~/.claude/get-shit-done/workflows/research-status.md end-to-end.
Pass --raw flag from arguments if provided.
</process>
