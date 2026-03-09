/**
 * project_register — Register a new project with MarketClaw.
 *
 * Atomically: validates repo, detects GitHub/GitLab provider, creates all 8 state labels (idempotent),
 * adds project entry to projects.json, and logs the event.
 *
 * Replaces the manual steps of running glab/gh label create + editing projects.json.
 */
import { jsonResult } from "openclaw/plugin-sdk";
import type { ToolContext } from "../../types.js";
import type { PluginContext } from "../../context.js";
import fs from "node:fs/promises";
import path from "node:path";
import { readProjects, writeProjects, emptyRoleWorkerState } from "../../projects/index.js";
import { resolveRepoPath } from "../../projects/index.js";
import { createProvider } from "../../providers/index.js";
import { log as auditLog } from "../../audit.js";
import { getAllRoleIds, getLevelsForRole } from "../../roles/index.js";
import { getRoleLabels } from "../../workflow/index.js";
import { loadConfig } from "../../config/index.js";
import { DATA_DIR } from "../../setup/migrate-layout.js";

/**
 * Scaffold project directory with prompts/ folder and a README explaining overrides.
 * Returns true if files were created, false if they already existed.
 */
async function scaffoldPromptFiles(workspaceDir: string, projectName: string): Promise<boolean> {
  const projectDir = path.join(workspaceDir, DATA_DIR, "projects", projectName);
  const promptsDir = path.join(projectDir, "prompts");
  await fs.mkdir(promptsDir, { recursive: true });

  const readmePath = path.join(projectDir, "README.md");
  try {
    await fs.access(readmePath);
    return false;
  } catch {
    const roles = getAllRoleIds().join(", ");
    await fs.writeFile(readmePath, `# Project Overrides

This directory holds project-specific configuration that overrides the workspace defaults.

## Prompt Overrides

To override default worker instructions, create \`prompts/<role>.md\`:

Available roles: ${roles}

Example: \`prompts/developer.md\` overrides the default developer instructions for this project only.
Files here take priority over the workspace defaults in \`marketclaw/prompts/\`.

## Workflow Overrides

To override the default workflow configuration, create \`workflow.yaml\` in this directory.

Only include the keys you want to override — everything else inherits from the workspace-level \`marketclaw/workflow.yaml\`. The three-layer system is:

1. **Built-in defaults** (code)
2. **Workspace** — \`marketclaw/workflow.yaml\`
3. **Project** — \`marketclaw/projects/${projectName}/workflow.yaml\` (this directory)

Example — use a different review policy for this project:

\`\`\`yaml
workflow:
  reviewPolicy: agent
\`\`\`

Example — override model for senior developer:

\`\`\`yaml
roles:
  developer:
    models:
      senior: claude-sonnet-4-5-20250514
\`\`\`

Call \`workflow_guide\` for the full config reference.
`, "utf-8");
    return true;
  }
}

/**
 * Scaffold content repo directories in the campaign repo.
 * Creates campaigns/, content/, social/, email/, assets/, reports/ and .agents/product-marketing-context.md
 * if they don't already exist.
 */
async function scaffoldContentRepo(repoPath: string): Promise<string[]> {
  const created: string[] = [];

  const dirs = [
    "campaigns",
    "content",
    "social",
    "email",
    "assets",
    "reports",
    ".agents",
  ];

  for (const dir of dirs) {
    const dirPath = path.join(repoPath, dir);
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });

      // Write a basic README for each directory
      const readmeContent: Record<string, string> = {
        campaigns: `# Campaigns\n\nEach campaign gets a subdirectory: \`campaigns/<slug>/\`\n\nContents:\n- \`brief.md\` — Campaign brief written by the Strategist\n- \`okrs.md\` — Campaign OKRs and KPIs\n`,
        content: `# Content\n\nLong-form content: blog posts, articles, landing pages.\n\nStructure: \`content/<campaign>/<slug>.md\`\n`,
        social: `# Social\n\nSocial media posts: LinkedIn, Twitter/X, Telegram.\n\nStructure: \`social/<platform>/<campaign>/<slug>.md\`\n\nSee \`CONTENT_SPEC.md\` for frontmatter requirements.\n`,
        email: `# Email\n\nEmail content: newsletters, drip sequences, announcements.\n\nStructure: \`email/<campaign>/<slug>.md\`\n\nSee \`CONTENT_SPEC.md\` for frontmatter requirements.\n`,
        assets: `# Assets\n\nImages, videos, and other media assets referenced in content.\n`,
        reports: `# Reports\n\nPublished URLs and analytics reports.\n\nStructure: \`reports/<campaign>/urls.md\` and \`reports/<campaign>/metrics-<date>.md\`\n`,
      };

      const readme = readmeContent[dir];
      if (readme) {
        await fs.writeFile(path.join(dirPath, "README.md"), readme, "utf-8");
      }

      created.push(dir);
    }
  }

  // Write .agents/product-marketing-context.md if missing
  const contextPath = path.join(repoPath, ".agents", "product-marketing-context.md");
  try {
    await fs.access(contextPath);
  } catch {
    const template = `# Product Marketing Context

> ⚠️ **FILL THIS IN** — All MarketClaw agents (Strategist, Creator, Reviewer, Publisher, Analyst)
> read this file first. The quality of your AI marketing team depends on how well you fill
> this out. Be specific — vague inputs produce generic output.

## Company Overview

**Company name:** [Your company name]
**Website:** [URL]
**What we do:** [One paragraph]

## Brand Voice

**Tone:** [e.g. "Direct, confident, zero fluff"]
**We sound like:** [3 adjectives]
**We never sound like:** [3 adjectives]

## Target Customer (ICP)

**Role/Title:** [e.g. "Head of Engineering at B2B SaaS company"]
**Pain:** [The #1 problem they're trying to solve]
**Goal:** [What they're trying to achieve]

## Content Channels

**Primary:** [e.g. LinkedIn, Newsletter]

## Social Presence

**LinkedIn:** [URL]
**Twitter/X:** [URL]
**Telegram:** [URL]
**Newsletter:** [URL]

---

*See the full template in \`defaults/marketclaw/repo-template/.agents/product-marketing-context.md\`*
`;
    await fs.writeFile(contextPath, template, "utf-8");
    created.push(".agents/product-marketing-context.md");
  }

  return created;
}

/**
 * Try to create a GitHub Projects v2 content calendar for the repo.
 * Best-effort — logs warning on failure, does not throw.
 */
async function tryCreateContentCalendar(
  repoPath: string,
  projectName: string,
  runCommand: import("../../context.js").RunCommand,
): Promise<string | null> {
  try {
    // Get the GitHub remote URL to extract owner/repo
    const remoteResult = await runCommand(
      ["git", "remote", "get-url", "origin"],
      { cwd: repoPath, timeoutMs: 5_000 },
    );
    const remoteUrl = remoteResult.stdout.trim();

    // Extract owner from remote URL
    const ownerMatch = /github\.com[:/]([^/]+)/.exec(remoteUrl);
    if (!ownerMatch?.[1]) return null;

    const owner = ownerMatch[1];
    const calTitle = `${projectName} Content Calendar`;

    // Create GitHub Project
    const result = await runCommand(
      ["gh", "project", "create", "--owner", owner, "--title", calTitle, "--format", "json"],
      { cwd: repoPath, timeoutMs: 30_000 }
    );

    if (result.code !== 0) return null;

    let projectData: { url?: string; number?: number };
    try {
      projectData = JSON.parse(result.stdout);
    } catch {
      return null;
    }

    return projectData.url ?? null;
  } catch {
    return null;
  }
}

export function createProjectRegisterTool(ctx: PluginContext) {
  return (toolCtx: ToolContext) => ({
    name: "project_register",
    label: "Project Register",
    description: `Register a new project with MarketClaw. Creates state labels, adds to projects.json. One-time setup per project.`,
    parameters: {
      type: "object",
      required: ["channelId", "name", "repo", "baseBranch"],
      properties: {
        channelId: {
          type: "string",
          description: "Channel ID — the chat/group ID where this project is managed (e.g. Telegram group ID)",
        },
        name: {
          type: "string",
          description: "Short project name (e.g. 'my-webapp')",
        },
        repo: {
          type: "string",
          description: "Path to git repo (e.g. '~/git/my-project')",
        },
        channel: {
          type: "string",
          description: "Channel type (e.g. 'telegram', 'whatsapp'). Defaults to 'telegram'.",
        },
        groupName: {
          type: "string",
          description: "Group display name (optional - defaults to 'Project: {name}')",
        },
        baseBranch: {
          type: "string",
          description: "Base branch for development (e.g. 'development', 'main')",
        },
        deployBranch: {
          type: "string",
          description: "Branch that triggers deployment. Defaults to baseBranch.",
        },
        deployUrl: {
          type: "string",
          description: "Deployment URL for the project",
        },
      },
    },

    async execute(_id: string, params: Record<string, unknown>) {
      const channelId = params.channelId as string;
      const name = params.name as string;
      const repo = params.repo as string;
      const channel = (params.channel as string) ?? "telegram";
      const groupName = (params.groupName as string) ?? `Project: ${name}`;
      const baseBranch = params.baseBranch as string;
      const deployBranch = (params.deployBranch as string) ?? baseBranch;
      const deployUrl = (params.deployUrl as string) ?? "";
      const workspaceDir = toolCtx.workspaceDir;

      if (!workspaceDir) {
        throw new Error("No workspace directory available in tool context");
      }

      // Generate slug from project name
      const slug = name.toLowerCase().replace(/\s+/g, "-");

      // 1. Check project exists or can be created
      const data = await readProjects(workspaceDir);
      const existing = data.projects[slug];

      // If project exists, check if this channelId is already registered
      if (existing) {
        const channelExists = existing.channels.some(ch => ch.channelId === channelId);
        if (channelExists) {
          throw new Error(
            `Channel ${channelId} is already registered for project "${name}". Each channel can only register once per project.`,
          );
        }
        // Adding a new channel to an existing project
      }

      // 2. Resolve repo path
      const repoPath = resolveRepoPath(repo);

      // 3. Create provider and verify it works
      const { provider, type: providerType } = await createProvider({ repo, runCommand: ctx.runCommand });

      const healthy = await provider.healthCheck();
      if (!healthy) {
        const cliName = providerType === "github" ? "gh" : "glab";
        const cliInstallUrl = providerType === "github"
          ? "https://cli.github.com"
          : "https://gitlab.com/gitlab-org/cli";
        throw new Error(
          `${providerType.toUpperCase()} health check failed for ${repoPath}. ` +
          `Detected provider: ${providerType}. ` +
          `Ensure '${cliName}' CLI is installed, authenticated (${cliName} auth status), ` +
          `and the repo has a ${providerType.toUpperCase()} remote. ` +
          `Install ${cliName} from: ${cliInstallUrl}`
        );
      }

      // 4. Create all state labels (idempotent)
      await provider.ensureAllStateLabels();

      // 4b. Create role:level + step routing labels (e.g. developer:junior, review:human, test:skip)
      const resolvedConfig = await loadConfig(workspaceDir, name);
      const roleLabels = getRoleLabels(resolvedConfig.roles);
      for (const { name: labelName, color } of roleLabels) {
        await provider.ensureLabel(labelName, color);
      }

      // 5. Auto-detect repoRemote from git
      let repoRemote: string | undefined;
      try {
        const result = await ctx.runCommand(["git", "remote", "get-url", "origin"], {
          timeoutMs: 5_000,
          cwd: repoPath,
        });
        repoRemote = result.stdout.trim() || undefined;
      } catch {
        repoRemote = undefined;
      }

      // 6. Add or update project in projects.json
      if (existing) {
        // Add channel to existing project
        const newChannel: import("../../projects/index.js").Channel = {
          channelId,
          channel: channel as "telegram" | "whatsapp" | "discord" | "slack",
          name: `channel-${existing.channels.length + 1}`,
          events: ["*"],
        };
        existing.channels.push(newChannel);
        if (repoRemote && !existing.repoRemote) {
          existing.repoRemote = repoRemote;
        }
      } else {
        // Create new project - get levelMaxWorkers from resolved config (already loaded above)
        const workers: Record<string, import("../../projects/index.js").RoleWorkerState> = {};
        for (const role of getAllRoleIds()) {
          const levelMaxWorkers = resolvedConfig.roles[role]?.levelMaxWorkers ?? {};
          workers[role] = emptyRoleWorkerState(levelMaxWorkers);
        }

        const newChannel: import("../../projects/index.js").Channel = {
          channelId,
          channel: channel as "telegram" | "whatsapp" | "discord" | "slack",
          name: "primary",
          events: ["*"],
        };

        data.projects[slug] = {
          slug,
          name,
          repo,
          repoRemote,
          groupName,
          deployUrl,
          baseBranch,
          deployBranch,
          channels: [newChannel],
          provider: providerType,
          workers,
        };
      }

      await writeProjects(workspaceDir, data);

      // 7. Scaffold prompt files
      const promptsCreated = await scaffoldPromptFiles(workspaceDir, name);

      // 7b. Scaffold content repo directories (best-effort)
      let repoScaffolded: string[] = [];
      const resolvedRepoPath = resolveRepoPath(repo);
      try {
        repoScaffolded = await scaffoldContentRepo(resolvedRepoPath);
      } catch {
        // Non-fatal — repo might be remote-only or read-only
      }

      // 7c. Try to create GitHub Projects content calendar (best-effort)
      let contentCalendarUrl: string | null = null;
      if (!existing && repoScaffolded.length > 0 && ctx.runCommand) {
        contentCalendarUrl = await tryCreateContentCalendar(resolvedRepoPath, name, ctx.runCommand);
      }

      // 8. Audit log
      await auditLog(workspaceDir, "project_register", {
        project: name,
        projectSlug: slug,
        channelId,
        repo,
        repoRemote: repoRemote || null,
        baseBranch,
        deployBranch,
        deployUrl: deployUrl || null,
        isNewProject: !existing,
        repoScaffolded,
        contentCalendarUrl,
      });

      // 9. Return announcement
      const promptsNote = promptsCreated ? " Prompt files scaffolded." : "";
      const calNote = contentCalendarUrl ? ` Content calendar: ${contentCalendarUrl}` : "";
      const repoNote = repoScaffolded.length > 0 ? ` Repo dirs created: ${repoScaffolded.join(", ")}.` : "";
      const action = existing ? `Channel added to existing project` : `Project "${name}" created`;
      const announcement = `${action}. Labels ensured.${promptsNote}${repoNote}${calNote} Ready for tasks.`;

      // Active workflow info for the orchestrator to mention
      const activeWorkflow = {
        reviewPolicy: resolvedConfig.workflow.reviewPolicy ?? "human",
        testPhase: Object.values(resolvedConfig.workflow.states).some(
          (s) => s.role === "tester" && (s.type === "queue" || s.type === "active"),
        ),
        hint: "The user can change the review policy or enable the test phase — call workflow_guide for the full reference.",
      };

      return jsonResult({
        success: true,
        project: name,
        projectSlug: slug,
        channelId,
        repo,
        repoRemote: repoRemote || null,
        baseBranch,
        deployBranch,
        labelsCreated: 10,
        promptsScaffolded: promptsCreated,
        repoScaffolded,
        contentCalendarUrl: contentCalendarUrl ?? null,
        isNewProject: !existing,
        activeWorkflow,
        announcement,
      });
    },
  });
}
