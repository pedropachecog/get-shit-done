# Unmaintained Fork README Notice

## Purpose

Make it immediately clear that this public fork is no longer maintained, direct users to the community-maintained Open GSD successor, and preserve this repository as a historical reference for its local-first research work.

## Placement

Add the notice at the very beginning of `README.md`, before the existing centered project title. This ensures visitors see the repository status before installation instructions, feature claims, badges, or inherited upstream documentation.

## Presentation

Use a GitHub Markdown `[!WARNING]` callout. Keep the language neutral and factual. Do not repeat or speculate about the incident surrounding the former upstream maintainer.

## Approved Copy

> [!WARNING]
> **This fork is no longer maintained.**
>
> The original upstream project has been superseded by the community-maintained [Open GSD](https://github.com/open-gsd/gsd-core). This repository remains available as a historical reference for its local-first SearXNG and Context integrations, but it will not receive updates or security fixes.
>
> **Do not use this fork for new installations.** Use [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) instead.

## Scope

Only the English `README.md` is changed. Existing translated READMEs and the historical body of the English README remain untouched. No source code, package metadata, installation files, or repository settings are changed.

## Verification

Confirm that:

- the warning is the first rendered content in `README.md`;
- both successor links point to `https://github.com/open-gsd/gsd-core`;
- the existing README content is otherwise unchanged; and
- no unrelated working-tree files are staged or modified.
