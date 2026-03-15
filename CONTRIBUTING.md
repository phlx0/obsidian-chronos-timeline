# Contributing to Chronos Timeline

Thank you for considering contributing! This document explains how to get started.

## Development Setup

1. Fork this repository
2. Clone your fork: `git clone https://github.com/phlx0/obsidian-chronos-timeline`
3. Install dependencies: `npm install`
4. Start the dev watcher: `npm run dev`
5. Symlink or copy the plugin folder into a test vault's `.obsidian/plugins/` directory

After any code change, reload Obsidian with **Ctrl+R** (desktop) or reopen the app.

## Pull Request Guidelines

- **One feature / bug fix per PR** — keep changes focused
- **TypeScript only** — no plain JS additions
- **No new external dependencies** unless absolutely necessary (keep the bundle small)
- **Test on both light and dark themes**
- **Update CHANGELOG.md** under `[Unreleased]` with a description of your change
- **Describe your change** in the PR description with a before/after if UI is involved

## Reporting Bugs

Open a GitHub Issue and include:
- Obsidian version
- Plugin version
- Operating system
- Steps to reproduce
- Expected vs. actual behavior

## Feature Requests

Open a GitHub Issue with the `enhancement` label. Describe the use case, not just the feature.
