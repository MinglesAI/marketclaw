/**
 * workflow_guide — Reference tool for editing workflow.yaml.
 *
 * Returns a comprehensive guide explaining the workflow config structure,
 * all enums/constrained values, the three-layer config system, and
 * common customization recipes. Designed to be read by an LLM before
 * it edits any workflow.yaml file.
 *
 * No parameters, no side effects — pure documentation.
 */
import { jsonResult } from "openclaw/plugin-sdk";
import type { PluginContext } from "../../context.js";
import type { ToolContext } from "../../types.js";
import { requireWorkspaceDir } from "../helpers.js";
import { DATA_DIR } from "../../setup/migrate-layout.js";

export function createWorkflowGuideTool(_ctx: PluginContext) {
  return (toolCtx: ToolContext) => ({
    name: "workflow_guide",
    label: "Workflow Guide",
    description:
      `Reference guide for editing workflow.yaml. ` +
      `Call this BEFORE making any workflow configuration changes. ` +
      `Returns the full config structure, all valid values (enums, free-form fields), ` +
      `the three-layer override system, and common recipes like enabling the test phase ` +
      `or changing the review policy.`,
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Optional: narrow to a specific topic. " +
            'Options: "overview", "states", "roles", "review", "testing", "timeouts", "overrides". ' +
            "Omit for the full guide.",
          enum: ["overview", "states", "roles", "review", "testing", "timeouts", "overrides"],
        },
      },
    },

    async execute(_id: string, params: Record<string, unknown>) {
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const dataDir = `${workspaceDir}/${DATA_DIR}`;
      const topic = params.topic as string | undefined;

      const sections: Record<string, string> = {
        overview: buildOverview(dataDir),
        states: buildStatesSection(),
        roles: buildRolesSection(),
        review: buildReviewSection(),
        testing: buildTestingSection(),
        timeouts: buildTimeoutsSection(),
        overrides: buildOverridesSection(dataDir),
      };

      if (topic && sections[topic]) {
        return jsonResult({ guide: sections[topic] });
      }

      // Full guide
      const full = Object.values(sections).join("\n\n---\n\n");
      return jsonResult({ guide: full });
    },
  });
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildOverview(dataDir: string): string {
  return `# Workflow Configuration Guide

## File structure

The config file is \`workflow.yaml\`. It has three top-level keys:

\`\`\`yaml
roles:      # Role and model configuration
workflow:   # State machine definition
timeouts:   # Optional timeout overrides
\`\`\`

## Three-layer config system

Config is resolved by merging three layers (later layers override earlier):

1. **Built-in defaults** — hardcoded in the plugin, always present
2. **Workspace config** — \`${dataDir}/workflow.yaml\` — shared across all projects
3. **Project config** — \`${dataDir}/projects/<name>/workflow.yaml\` — per-project overrides

### Merge semantics
- **Objects**: deep merge (sparse override — only specify what you change)
- **Arrays**: replace entirely (levels, completionResults)
- **Primitives**: override
- **\`false\` for a role**: disables it entirely

A project config only needs the keys it wants to override. Example project override:
\`\`\`yaml
roles:
  creator:
    models:
      senior: anthropic/claude-opus-4-6
workflow:
  reviewPolicy: agent
  publishPolicy: human
\`\`\`
This changes only the senior creator model and review/publish policies; everything else inherits.`;
}

function buildStatesSection(): string {
  return `# Workflow States

## State types (FIXED — 4 values, cannot add new types)

| Type       | Meaning                                        |
|------------|------------------------------------------------|
| \`queue\`    | Waiting for pickup. Must have a \`role\`. Has \`priority\` (lower = higher priority). |
| \`active\`   | Work in progress. Must have a \`role\`.          |
| \`hold\`     | Paused, waiting for human input. No role needed. |
| \`terminal\` | End state. No outgoing transitions allowed.     |

## State config fields

| Field        | Type     | Required | Constrained? | Notes |
|-------------|----------|----------|--------------|-------|
| \`type\`      | string   | yes      | FIXED enum: \`queue\`, \`active\`, \`hold\`, \`terminal\` | |
| \`role\`      | string   | for queue/active | Must match a role key from \`roles:\` section | e.g. \`creator\`, \`reviewer\`, \`publisher\`, \`analyst\`, \`strategist\` |
| \`label\`     | string   | yes      | FREE — any text | Becomes a GitHub/GitLab label. Must be unique across states. |
| \`color\`     | string   | yes      | FREE — any hex color | Format: \`"#rrggbb"\`. Used for the issue label color. |
| \`priority\`  | number   | no       | FREE — any positive integer | Lower = higher priority. Only meaningful on \`queue\` states. |
| \`description\`| string  | no       | FREE — any text | Optional description for documentation. |
| \`check\`     | string   | no       | FIXED enum: \`prApproved\`, \`prMerged\` | Triggers PR status check during heartbeat. |
| \`on\`        | object   | no       | Keys are events (see below), values are transitions | |

## State names (the YAML keys)
**FREE-FORM** — you choose the key names. They must be:
- Unique within the workflow
- Valid YAML keys (no spaces — use camelCase)
- Referenced consistently in transition targets

Examples: \`planning\`, \`todo\`, \`doing\`, \`toReview\`, \`reviewing\`, \`done\`, \`toImprove\`, \`refining\`

## Workflow events (FIXED — cannot add new events)

These are the valid keys for the \`on:\` object on a state:

| Event              | Meaning                                    | Typical source |
|--------------------|--------------------------------------------|----------------|
| \`PICKUP\`           | Worker picks up from queue                 | Queue dispatch  |
| \`COMPLETE\`         | Worker finished successfully               | Worker tool     |
| \`APPROVE\`          | Human/agent approves                       | Reviewer tool   |
| \`REJECT\`           | Reviewer rejects                           | Reviewer tool   |
| \`APPROVED\`         | PR approved on GitHub/GitLab               | Heartbeat       |
| \`CHANGES_REQUESTED\`| PR has change requests or unprocessed comments | Heartbeat   |
| \`MERGE_FAILED\`     | PR merge attempt failed                    | Heartbeat       |
| \`MERGE_CONFLICT\`   | PR has merge conflicts                     | Heartbeat       |
| \`PASS\`             | Tester passes                              | Tester tool     |
| \`FAIL\`             | Tester fails                               | Tester tool     |
| \`REFINE\`           | Needs refinement                           | Tester tool     |
| \`BLOCKED\`          | Work is blocked                            | Any worker tool |

## Transition target format

Simple form — just the target state name:
\`\`\`yaml
PICKUP: doing
\`\`\`

Complex form — target with actions:
\`\`\`yaml
APPROVED:
  target: done
  actions:
    - mergePr
    - gitPull
    - closeIssue
\`\`\`

## Built-in actions (FIXED set — custom strings are ignored)

| Action         | What it does                              |
|----------------|-------------------------------------------|
| \`detectPr\`     | Detect if a PR/MR exists for the issue    |
| \`mergePr\`      | Merge the associated PR/MR                |
| \`gitPull\`      | Pull latest changes on the project repo   |
| \`closeIssue\`   | Close the issue on GitHub/GitLab          |
| \`reopenIssue\`  | Reopen the issue on GitHub/GitLab         |

## Validation rules (enforced at load time)

- \`initial\` state must exist in \`states\`
- \`queue\` and \`active\` states must have a \`role\`
- \`terminal\` states must NOT have \`on\` transitions
- All transition targets must point to existing state keys
- State labels must be unique

## Syncing labels after changes

After adding, renaming, or removing states in workflow.yaml, run the \`sync_labels\` tool to create the corresponding labels on GitHub/GitLab. Labels are only created during \`project_register\` — workflow.yaml edits are not automatically synced.

\`sync_labels\` reads the fully resolved config (built-in + workspace + project overrides) and ensures every state label, role:level label, and step routing label exists on the provider. It is idempotent — safe to run multiple times.

\`\`\`
sync_labels                         # sync all projects
sync_labels channelId=-100123       # sync one project
\`\`\``;
}

function buildRolesSection(): string {
  return `# Roles Configuration

## Built-in MarketClaw roles (5 defaults — can override or disable)

| Role         | Default levels          | Default level | Completion results              |
|-------------|------------------------|---------------|---------------------------------|
| \`strategist\` | junior, senior         | junior        | done, blocked                   |
| \`creator\`    | junior, medior, senior | medior        | done, blocked                   |
| \`reviewer\`   | junior, senior         | junior        | approve, reject, blocked        |
| \`publisher\`  | junior, senior         | junior        | pass, fail, blocked             |
| \`analyst\`    | junior, senior         | junior        | done, blocked                   |

## Role config fields

| Field              | Constrained?  | Notes |
|-------------------|---------------|-------|
| \`maxWorkers\`      | Must be positive integer | Maximum concurrent workers for this role. Default: 1. |
| \`levels\`          | FREE — array of strings | Define your own level names. Default model routing uses these as keys. |
| \`defaultLevel\`    | Must be one of \`levels\` | Used when no level specified on issue. |
| \`models\`          | FREE — map of level→model ID | Model IDs are free-form strings. Format: \`provider/model-name\`. |
| \`emoji\`           | FREE — map of level→emoji | Used in announcements. Any emoji string. |
| \`completionResults\`| Mapped to events | \`"done"\` maps to COMPLETE event, others map to UPPERCASE event name. Must have matching transitions in active states. |

## Default model assignments

| Level    | Default model                    |
|---------|----------------------------------|
| junior   | \`anthropic/claude-haiku-4-5\`    |
| medior   | \`anthropic/claude-sonnet-4-5\`   |
| senior   | \`anthropic/claude-opus-4-6\`     |

Strategist junior defaults to \`anthropic/claude-sonnet-4-5\`.
Reviewer senior defaults to \`anthropic/claude-sonnet-4-5\`.

## MarketClaw-specific config fields

| Field             | Type   | Default | Notes |
|-------------------|--------|---------|-------|
| \`publishPolicy\`  | string | \`agent\` | How publisher works: \`agent\` = dispatch publisher, \`skip\` = auto-transition to published, \`human\` = wait for manual trigger |
| \`analyzeAfterDays\`| number | 7 | Days after publication before analytics is triggered. Set 0 to disable. |

## Disabling a role

Set the role to \`false\`:
\`\`\`yaml
roles:
  analyst: false
\`\`\`

## Adding a custom role

Define the role with all required fields. The role key must also be referenced as a \`role:\` in at least one workflow state.
\`\`\`yaml
roles:
  security_auditor:
    levels: [standard, expert]
    defaultLevel: standard
    models:
      standard: anthropic/claude-sonnet-4-5
      expert: anthropic/claude-opus-4-6
    completionResults: [done, blocked]
\`\`\`
Then add states that use \`role: security_auditor\`.

## Prompts per role

Each role can have a system prompt file:
- Workspace default: \`<dataDir>/prompts/<role>.md\`
- Project override: \`<dataDir>/projects/<name>/prompts/<role>.md\`

If a role has no prompt file, the worker gets a generic system prompt. When enabling a new role (like tester), create its prompt file.`;
}

function buildReviewSection(): string {
  return `# Review Policy

## reviewPolicy (FIXED — 3 values)

Set in \`workflow.reviewPolicy\`:

| Value    | Behavior |
|---------|----------|
| \`human\` | **(default)** All PRs wait for human approval on GitHub/GitLab. The heartbeat polls PR status and auto-merges when approved. |
| \`agent\` | Every PR is reviewed by an agent (reviewer role) before merge. Agent can approve or reject. |
| \`auto\`  | Hybrid: junior/medior creators → agent review, senior creators → human review. |

## How review routing works

1. Creator finishes content → issue moves to \`toReview\` state
2. Heartbeat checks \`reviewPolicy\` to decide routing:
   - \`human\`: issue stays in \`toReview\`, heartbeat polls PR for approval
   - \`agent\`: heartbeat dispatches a reviewer worker to check the content
   - \`auto\`: checks the creator level that worked on the issue
3. The \`toReview\` state should have a \`check: prApproved\` field for human review flow

## How publish routing works

1. Reviewer approves content → issue moves to \`toPublish\` state
2. Heartbeat checks \`publishPolicy\` to decide routing:
   - \`agent\` (default): heartbeat dispatches a publisher worker to post the content
   - \`skip\`: auto-transition through publish queue without dispatching a worker
   - \`human\`: wait for human to manually trigger publishing

## Per-issue override labels (FIXED format, applied to individual issues)

| Label            | Effect |
|-----------------|--------|
| \`review:human\`  | Force human review for this issue regardless of policy |
| \`review:agent\`  | Force agent review for this issue |
| \`review:skip\`   | Skip review entirely — go straight to publish queue |
| \`publish:skip\`  | Skip publish phase — auto-transition to published state |

These labels are applied to the issue on GitHub/GitLab and override the global policy.

## Example: switching to agent review

\`\`\`yaml
workflow:
  reviewPolicy: agent
\`\`\`

The reviewer role must be configured (it is by default) and needs a prompt file at \`<dataDir>/prompts/reviewer.md\`.`;
}

function buildTestingSection(): string {
  return `# Analytics Phase

The analytics phase is **enabled by default** with a 7-day delay after publication.

## Campaign pipeline
\`\`\`
Planning → To Research → Researching → [Done: creates content tasks]
→ To Do → Creating → To Review → To Publish → Publishing → Published
→ [7 days] → To Analyze → Analyzing → Done
\`\`\`

## Analytics config

Control when analytics is triggered:

\`\`\`yaml
workflow:
  analyzeAfterDays: 7   # default: 7 days after publication
  publishPolicy: agent  # how publisher is dispatched: agent | skip | human
\`\`\`

## Disabling analytics

Set \`analyzeAfterDays\` to 0:
\`\`\`yaml
workflow:
  analyzeAfterDays: 0
\`\`\`

## Publish policy options

| Value    | Behavior |
|---------|----------|
| \`agent\` | (default) Dispatch publisher worker to post content to platforms |
| \`skip\`  | Auto-transition through publish queue without dispatching publisher |
| \`human\` | Wait for human to manually trigger publishing |

## Per-issue skip
Add the \`publish:skip\` label to an issue to skip automated publishing for that specific piece of content.

## Strategist → Content task flow

When a strategist completes research:
1. Strategist creates individual content tasks in Planning (one per post/email/article)
2. Operator reviews tasks in Planning and advances them to To Do when ready
3. Each task flows independently through Creator → Reviewer → Publisher → Analyst`;
}

function buildTimeoutsSection(): string {
  return `# Timeouts

All timeout values are optional. Specify only the ones you want to override.

\`\`\`yaml
timeouts:
  gitPullMs: 30000          # Git pull timeout (default: 30s)
  gatewayMs: 15000          # Gateway API timeout (default: 15s)
  sessionPatchMs: 30000     # Session patch timeout (default: 30s)
  dispatchMs: 600000        # Worker dispatch timeout (default: 10min)
  staleWorkerHours: 2       # Hours before a worker is considered stale (default: 2)
  sessionContextBudget: 0.6 # Clear session when context exceeds 60% of limit (default: 0.6)
\`\`\`

| Field             | Type   | Default  | Notes |
|-------------------|--------|----------|-------|
| \`gitPullMs\`       | number | 30000    | Must be positive. Milliseconds. |
| \`gatewayMs\`       | number | 15000    | Must be positive. Milliseconds. |
| \`sessionPatchMs\`  | number | 30000    | Must be positive. Milliseconds. |
| \`dispatchMs\`      | number | 600000   | Must be positive. Milliseconds. How long a worker dispatch can take. |
| \`staleWorkerHours\`| number | 2        | Must be positive. Hours. After this, worker is flagged as stale. |
| \`sessionContextBudget\` | number | 0.6 | 0-1. Clear session when context exceeds this ratio. Set to 1.0 to disable. Skips clear on same-issue re-dispatch (feedback cycle). |`;
}

function buildOverridesSection(dataDir: string): string {
  return `# Project-Level Overrides

## File location
\`${dataDir}/projects/<project-name>/workflow.yaml\`

## What can be overridden per project
Everything. A project workflow.yaml has the same structure as the workspace one. Only specify what differs.

## Common override patterns

### Different review policy for one project
\`\`\`yaml
workflow:
  reviewPolicy: skip
\`\`\`

### Upgrade models for a high-priority campaign
\`\`\`yaml
roles:
  creator:
    models:
      medior: anthropic/claude-opus-4-6
\`\`\`

### Disable analytics for one project
\`\`\`yaml
roles:
  analyst: false
\`\`\`

### Use different model provider
\`\`\`yaml
roles:
  creator:
    models:
      junior: google/gemini-2.0-flash
      medior: google/gemini-2.5-pro
      senior: anthropic/claude-opus-4-6
\`\`\`

### Allow concurrent creators on a project
\`\`\`yaml
roles:
  creator:
    maxWorkers: 3  # Allow up to 3 creators working in parallel
\`\`\`

### Override timeouts for a slow repo
\`\`\`yaml
timeouts:
  gitPullMs: 60000
  dispatchMs: 900000
\`\`\`

## Prompt overrides
Place role-specific prompts in:
\`${dataDir}/projects/<project-name>/prompts/<role>.md\`

These completely replace (not merge with) the workspace-level prompts for that role.`;
}
