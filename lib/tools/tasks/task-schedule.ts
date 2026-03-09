/**
 * task_schedule — Set or clear the Publish Date on a content issue.
 *
 * Publish Date is stored in the issue body as a structured field.
 * The heartbeat reads this field when dispatching publisher workers —
 * issues with a future date are skipped and re-checked on each tick.
 */
import { jsonResult } from "openclaw/plugin-sdk";
import type { ToolContext } from "../../types.js";
import type { PluginContext } from "../../context.js";
import { requireWorkspaceDir, resolveChannelId, resolveProject, resolveProvider } from "../helpers.js";
import { log as auditLog } from "../../audit.js";

/**
 * Append or update a "Publish Date" field in the issue body.
 * Replaces existing `publish_date:` line or appends to the body.
 */
function upsertPublishDateInBody(body: string, date: string | null): string {
  const field = date ? `publish_date: ${date}` : "publish_date:";
  const pattern = /^publish_date:.*$/m;

  if (pattern.test(body)) {
    return body.replace(pattern, field);
  }

  // Append to body
  const separator = body.endsWith("\n") ? "" : "\n";
  return `${body}${separator}\n<!-- MarketClaw scheduling -->\n${field}\n`;
}

export function createTaskScheduleTool(ctx: PluginContext) {
  return (toolCtx: ToolContext) => ({
    name: "task_schedule",
    label: "Schedule",
    description:
      "Set or clear the Publish Date on a content issue. The heartbeat uses this date to dispatch the Publisher worker at the right time. Format: YYYY-MM-DD. Omit date to clear scheduling.",
    parameters: {
      type: "object",
      properties: {
        issueId: {
          type: "number",
          description: "Issue ID to schedule.",
        },
        date: {
          type: "string",
          description: "Publish date in YYYY-MM-DD format. Omit to clear.",
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        },
        channelId: {
          type: "string",
          description: "Channel ID (auto-detected from context).",
        },
      },
      required: ["issueId"],
    },

    async execute(_id: string, params: Record<string, unknown>) {
      const workspaceDir = requireWorkspaceDir(toolCtx);
      const channelId = resolveChannelId(toolCtx, params.channelId as string | undefined);
      const { project } = await resolveProject(workspaceDir, channelId);
      const { provider } = await resolveProvider(project, ctx.runCommand);

      const issueId = params.issueId as number;
      const date = typeof params.date === "string" ? params.date.trim() : null;

      // Validate date format if provided
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return jsonResult({
          success: false,
          error: `Invalid date format: "${date}". Use YYYY-MM-DD (e.g., 2024-03-15).`,
        });
      }

      // Fetch the issue
      const issue = await provider.getIssue(issueId);

      // Update issue body with publish_date field
      const updatedBody = upsertPublishDateInBody(issue.description ?? "", date);

      await provider.editIssue(issueId, { body: updatedBody });

      await auditLog(workspaceDir, "task_schedule", {
        project: project.name,
        issueId,
        date: date ?? null,
        action: date ? "scheduled" : "cleared",
      });

      const message = date
        ? `📅 Issue #${issueId} scheduled to publish on **${date}**.`
        : `📅 Publish date cleared for issue #${issueId}.`;

      return jsonResult({
        success: true,
        issueId,
        date: date ?? null,
        action: date ? "scheduled" : "cleared",
        message,
        note: date
          ? "The heartbeat will dispatch the Publisher worker when the date arrives."
          : "Issue will publish as soon as it enters the To Publish queue.",
      });
    },
  });
}
