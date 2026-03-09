# TOOLS.md - MarketClaw Tools

All MarketClaw tools are registered as OpenClaw plugin tools. Use the tool schemas for parameter details.

## Config management

MarketClaw config files (workflow.yaml, prompts) are **write-once**: created on first setup, never overwritten on restart. Your customizations are always preserved.

- `config` (action: "diff") — Compare your workflow.yaml against the built-in default. Shows what you've customized and what's new in updates.
- `config` (action: "reset") — Reset config files to defaults (creates .bak backups). Supports `scope`: "workflow", "prompts", or "all".

## Project-specific overrides

To override tool behavior for a specific project, create prompt files in:
`marketclaw/projects/<name>/prompts/<role>.md`

## Content calendar

- `task_schedule` — Set or clear the Publish Date on a content issue. The heartbeat dispatches the Publisher worker automatically when the date arrives.

## Analytics

Set `analyzeAfterDays` in `marketclaw/workflow.yaml` to control how many days after publication the Analyst worker is triggered. Default: 7.
