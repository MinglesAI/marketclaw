/**
 * research_task — Start a research ticket in "To Research" state and dispatch the strategist.
 *
 * The strategist picks up the issue, researches the market/competition/audience,
 * writes a campaign brief, and creates content tasks via task_create.
 * Then calls work_finish(result="done") which closes the research issue.
 *
 * Flow:
 *   research_task() → issue created in "To Research" → strategist dispatched
 *   → strategist researches, writes brief, posts findings with task_comment
 *   → strategist creates content tasks with task_create (land in Planning)
 *   → strategist calls work_finish(result="done") → "Researching" → "Done" (issue closed)
 *   → operator reviews created tasks in Planning, moves to "To Do" when ready
 */
import { jsonResult } from "openclaw/plugin-sdk";
import type { ToolContext } from "../../types.js";
import type { PluginContext } from "../../context.js";
import type { StateLabel } from "../../providers/provider.js";
import { getRoleWorker, countActiveSlots } from "../../projects/index.js";
import { dispatchTask } from "../../dispatch/index.js";
import { log as auditLog } from "../../audit.js";
import { requireWorkspaceDir, resolveChannelId, resolveProject, resolveProvider, autoAssignOwnerLabel, applyNotifyLabel } from "../helpers.js";
import { loadConfig } from "../../config/index.js";
import { getActiveLabel } from "../../workflow/index.js";
import { selectLevel } from "../../roles/model-selector.js";
import { resolveModel } from "../../roles/index.js";

/** Queue label for research tasks. */
const TO_RESEARCH_LABEL = "To Research";

export function createResearchTaskTool(ctx: PluginContext) {
  return (toolCtx: ToolContext) => ({
    name: "research_task",
    label: "Research Task",
    description: `Spawn a strategist to research a marketing problem and write a campaign brief. Creates a "To Research" issue and dispatches a strategist worker.

IMPORTANT: Provide a detailed description with enough background context for the strategist
to produce actionable, campaign-ready findings. Include: target audience, business goals,
constraints, competitor context, and any prior decisions. The output should be detailed
enough for a creator to start writing content immediately.

The strategist will:
1. Research the market, audience, and competitors systematically
2. Write a campaign brief with ICP, positioning, channels, KPIs, and content plan
3. Create content tasks via task_create (land in Planning for operator review)
4. Call work_finish(result="done", summary="<recommendation + task numbers>") — closes the research issue

Example:
  research_task({
    title: "Research: mingles.ai LinkedIn presence launch",
    description: "We want to establish a strong LinkedIn presence for mingles.ai. Target: AI-curious founders and product teams at 10-100 person companies. Goal: 500 followers and 3 warm leads in 60 days. No existing content strategy.",
    focusAreas: ["ICP definition", "content angles", "posting cadence", "competitor analysis"],
    complexity: "complex"
  })`,
    parameters: {
      type: "object",
      required: ["channelId", "title", "description"],
      properties: {
        channelId: {
          type: "string",
          description: "YOUR chat/group ID — the numeric ID of the chat you are in right now (e.g. '-1003844794417'). Do NOT guess; use the ID of the conversation this message came from.",
        },
        title: {
          type: "string",
          description: "Research title (e.g., 'Research: mingles.ai LinkedIn launch campaign')",
        },
        description: {
          type: "string",
          description: "Detailed background: target audience, business goals, constraints, competitor context, prior decisions. Must be detailed enough for the strategist to write a complete campaign brief.",
        },
        focusAreas: {
          type: "array",
          items: { type: "string" },
          description: "Specific areas to investigate (e.g., ['ICP definition', 'content angles', 'posting cadence'])",
        },
        complexity: {
          type: "string",
          enum: ["simple", "medium", "complex"],
          description: "Suggests strategist level: simple/medium → junior, complex → senior. Defaults to medium.",
        },
        dryRun: {
          type: "boolean",
          description: "Preview without executing. Defaults to false.",
        },
      },
    },

    async execute(_id: string, params: Record<string, unknown>) {
      const channelId = resolveChannelId(toolCtx, params.channelId as string | undefined);
      const title = params.title as string;
      const description = (params.description as string) ?? "";
      const focusAreas = (params.focusAreas as string[]) ?? [];
      const complexity = (params.complexity as "simple" | "medium" | "complex") ?? "medium";
      const dryRun = (params.dryRun as boolean) ?? false;
      const workspaceDir = requireWorkspaceDir(toolCtx);

      if (!title) throw new Error("title is required");
      if (!description) throw new Error("description is required — provide detailed background context for the strategist");

      const { project } = await resolveProject(workspaceDir, channelId);
      const { provider } = await resolveProvider(project, ctx.runCommand);
      const pluginConfig = ctx.pluginConfig;
      const role = "strategist";

      // Build issue body with rich context for the strategist to start from
      const bodyParts = ["## Background", "", description];
      if (focusAreas.length > 0) {
        bodyParts.push("", "## Focus Areas", ...focusAreas.map((a) => `- ${a}`));
      }
      const issueBody = bodyParts.join("\n");

      await auditLog(workspaceDir, "research_task", {
        project: project.name, title, complexity, focusAreas, dryRun,
      });

      // Select level: use complexity hint to guide the heuristic
      const level = complexity === "complex"
        ? selectLevel(title, "system-wide " + description, role).level
        : selectLevel(title, description, role).level;
      const resolvedConfig = await loadConfig(workspaceDir, project.name);
      const resolvedRole = resolvedConfig.roles[role];
      const model = resolveModel(role, level, resolvedRole);

      if (dryRun) {
        return jsonResult({
          success: true,
          dryRun: true,
          issue: { title, label: TO_RESEARCH_LABEL },
          research: { level, model, status: "dry_run" },
          announcement: `\u{1f4d0} [DRY RUN] Would create research ticket and dispatch ${role} (${level}) for: ${title}`,
        });
      }

      // Create issue in "To Research" (the strategist queue state)
      const issue = await provider.createIssue(title, issueBody, TO_RESEARCH_LABEL as StateLabel);

      // Mark as system-managed (best-effort).
      provider.reactToIssue(issue.iid, "eyes").catch(() => {});

      // Apply notify label for notification routing (best-effort).
      applyNotifyLabel(provider, issue.iid, project, channelId, issue.labels);

      // Auto-assign owner label to this instance (best-effort).
      autoAssignOwnerLabel(workspaceDir, provider, issue.iid, project).catch(() => {});

      // Check worker availability across all levels
      const roleWorker = getRoleWorker(project, role);
      if (countActiveSlots(roleWorker) > 0) {
        // Strategist is busy — issue created in queue, heartbeat will pick it up when free
        const activeIssueId = Object.values(roleWorker.levels)
          .flat()
          .find((s) => s.active)?.issueId;
        return jsonResult({
          success: true,
          issue: { id: issue.iid, title: issue.title, url: issue.web_url, label: TO_RESEARCH_LABEL },
          research: {
            level,
            status: "queued",
            reason: `${role.toUpperCase()} already active on #${activeIssueId}. Research ticket queued — strategist will pick it up when current work completes.`,
          },
          announcement: `\u{1f4d0} Created research ticket #${issue.iid}: ${title} (strategist busy — queued)\n\u{1f517} [Issue #${issue.iid}](${issue.web_url})`,
        });
      }

      // Dispatch strategist via standard dispatchTask — same pipeline as every other role.
      // fromLabel: "To Research" (queue), toLabel: "Researching" (active)
      const toLabel = getActiveLabel(resolvedConfig.workflow, role);
      const dr = await dispatchTask({
        workspaceDir,
        agentId: toolCtx.agentId,
        project,
        issueId: issue.iid,
        issueTitle: issue.title,
        issueDescription: issueBody,
        issueUrl: issue.web_url,
        role,
        level,
        fromLabel: TO_RESEARCH_LABEL,
        toLabel,
        provider,
        pluginConfig,
        sessionKey: toolCtx.sessionKey,
        runtime: ctx.runtime,
        runCommand: ctx.runCommand,
      });

      return jsonResult({
        success: true,
        issue: { id: issue.iid, title: issue.title, url: issue.web_url, label: toLabel },
        research: {
          sessionKey: dr.sessionKey,
          level: dr.level,
          model: dr.model,
          sessionAction: dr.sessionAction,
          status: "in_progress",
        },
        project: project.name,
        announcement: dr.announcement,
      });
    },
  });
}
