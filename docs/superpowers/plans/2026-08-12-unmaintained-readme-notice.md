# Unmaintained Fork README Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mark the public legacy fork as unmaintained and direct new users to the community-maintained Open GSD repository.

**Architecture:** Add one neutral GitHub Markdown warning callout before all existing README content. Preserve the remainder of the README byte-for-byte and make no source, package, translated-documentation, or repository-setting changes.

**Tech Stack:** GitHub-flavored Markdown, Git, PowerShell verification commands

---

### Task 1: Add the repository-status warning

**Files:**
- Modify: `README.md:1`
- Reference: `docs/superpowers/specs/2026-08-12-unmaintained-readme-notice-design.md`
- Test: manual Markdown-content and Git-diff verification

- [ ] **Step 1: Confirm the existing README begins with the project title block**

Run:

```powershell
Get-Content -LiteralPath '.\README.md' -TotalCount 8
```

Expected: the first nonblank content is `<div align="center">`, followed by the existing `GET SHIT DONE — Local-First Fork` title. No maintenance warning exists yet.

- [ ] **Step 2: Insert the approved warning before the title block**

Add this exact block at line 1 of `README.md`:

```markdown
> [!WARNING]
> **This fork is no longer maintained.**
>
> The original upstream project has been superseded by the community-maintained [Open GSD](https://github.com/open-gsd/gsd-core). This repository remains available as a historical reference for its local-first SearXNG and Context integrations, but it will not receive updates or security fixes.
>
> **Do not use this fork for new installations.** Use [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) instead.

```

Do not edit any existing README text below the inserted block.

- [ ] **Step 3: Verify placement and links**

Run:

```powershell
Get-Content -LiteralPath '.\README.md' -TotalCount 15
rg -n --fixed-strings 'https://github.com/open-gsd/gsd-core' README.md
```

Expected: the warning is the first rendered content, the old title follows it, and the successor URL appears exactly twice in the warning.

- [ ] **Step 4: Verify the diff is limited to the approved insertion**

Run:

```powershell
git diff --check -- README.md
git diff -- README.md
git status --short
```

Expected: `git diff --check` exits successfully; the README diff contains only the six-line warning plus its separating blank line; existing unrelated untracked files remain unmodified and unstaged.

- [ ] **Step 5: Commit only the README notice**

Run:

```powershell
git add -- README.md
git diff --cached --check
git diff --cached -- README.md
git commit -m "docs: mark legacy fork unmaintained"
```

Expected: one commit containing only `README.md`. Do not stage `.containme/`, existing files under `docs/superpowers/plans/`, or `docs/superpowers/specs/2026-03-20-multi-project-workspaces-design.md`.

### Task 2: Confirm the legacy repository remains usable as a reference

**Files:**
- Verify: `README.md`
- Verify: Git working tree

- [ ] **Step 1: Inspect the committed README header**

Run:

```powershell
git show HEAD:README.md | Select-Object -First 15
```

Expected: the committed warning is first and the pre-existing title immediately follows it.

- [ ] **Step 2: Confirm commit scope**

Run:

```powershell
git show --stat --oneline HEAD
git diff HEAD^ HEAD -- README.md
git status --short
```

Expected: the commit changes only `README.md`. The user's pre-existing untracked paths remain present and unstaged.
