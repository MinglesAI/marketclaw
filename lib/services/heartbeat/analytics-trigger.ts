/**
 * analytics-trigger.ts — Auto-transition published issues to analytics queue.
 *
 * When `analyzeAfterDays` is configured (default: 7), the heartbeat scans
 * issues in the "Published" state. If a published issue's `published_at`
 * date is at least `analyzeAfterDays` old, it is transitioned to `toAnalyze`.
 *
 * Falls back to issue closed_at or updated_at if published_at is not found
 * in issue body/comments (for issues published before this feature was added).
 *
 * Called by the heartbeat service on every tick.
 */
import type { IssueProvider, Issue } from "../../providers/provider.js";
import {
  StateType,
  WorkflowEvent,
  type WorkflowConfig,
  type StateConfig,
} from "../../workflow/index.js";
import { log as auditLog } from "../../audit.js";

/**
 * Parse a date string that may appear in issue body or comments.
 * Looks for: published_at: <ISO>, published_url: <url>, or "Published at" text.
 */
function extractPublishedAt(text: string): Date | null {
  // Look for frontmatter-style field: published_at: "2024-03-15T..."
  const patterns = [
    /published_at:\s*["']?(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2})/i,
    /published_at:\s*["']?(\d{4}-\d{2}-\d{2})/i,
    /Published at:\s*(\d{4}-\d{2}-\d{2})/i,
    /published:\s*(\d{4}-\d{2}-\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      const parsed = new Date(match[1]);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

/**
 * Determine when an issue was published.
 * Priority: published_at in body → issue closed_at → issue updated_at
 */
function resolvePublishedAt(issue: Issue): Date | null {
  // Try body first
  if (issue.description) {
    const fromBody = extractPublishedAt(issue.description);
    if (fromBody) return fromBody;
  }

  // Fall back to issue closed_at (publisher closes the issue on completion)
  if ((issue as any).closed_at) {
    const d = new Date((issue as any).closed_at as string);
    if (!isNaN(d.getTime())) return d;
  }

  // Last resort: updated_at
  if ((issue as any).updated_at) {
    const d = new Date((issue as any).updated_at as string);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Scan published issues and auto-transition to analytics queue when ready.
 * Returns the number of transitions made.
 */
export async function analyticsTriggerPass(opts: {
  workspaceDir: string;
  projectName: string;
  workflow: WorkflowConfig;
  provider: IssueProvider;
}): Promise<number> {
  const { workspaceDir, projectName, workflow, provider } = opts;

  // Check if analytics is enabled
  const analyzeAfterDays = workflow.analyzeAfterDays ?? 7;
  if (analyzeAfterDays <= 0) return 0;

  let transitions = 0;

  // Find "published" hold states that transition to an analytics queue on APPROVE
  const publishedStates = Object.entries(workflow.states)
    .filter(([, s]) => s.type === StateType.HOLD && s.on?.[WorkflowEvent.APPROVE]) as [string, StateConfig][];

  for (const [_stateKey, state] of publishedStates) {
    // Only process states that look like "published" (role-free hold with approve transition)
    const approveTransition = state.on?.[WorkflowEvent.APPROVE];
    if (!approveTransition) continue;

    const targetKey = typeof approveTransition === "string" ? approveTransition : approveTransition.target;
    const targetState = workflow.states[targetKey];
    if (!targetState) continue;

    // Target must be an analyst queue
    if (targetState.role !== "analyst" || targetState.type !== StateType.QUEUE) continue;

    // Fetch issues in this "published" state — closed because publisher closes the issue on completion
    const issues = await provider.listIssuesByLabel(state.label, { state: "closed" });
    const now = new Date();
    const thresholdMs = analyzeAfterDays * 24 * 60 * 60 * 1000;

    for (const issue of issues) {
      // Determine when this was published
      const publishedAt = resolvePublishedAt(issue);
      if (!publishedAt) continue;

      const ageMs = now.getTime() - publishedAt.getTime();
      if (ageMs < thresholdMs) continue;

      // Transition: published → toAnalyze
      try {
        await provider.transitionLabel(issue.iid, state.label, targetState.label);

        await auditLog(workspaceDir, "analytics_trigger", {
          project: projectName,
          issueId: issue.iid,
          from: state.label,
          to: targetState.label,
          publishedAt: publishedAt.toISOString(),
          ageMs,
          analyzeAfterDays,
          reason: `Content published ${Math.floor(ageMs / 86400000)} days ago`,
        });

        transitions++;
      } catch (err) {
        // Best-effort — don't fail the entire pass for one issue
        console.warn(`analyticsTriggerPass: failed to transition issue #${issue.iid}: ${(err as Error).message}`);
      }
    }
  }

  return transitions;
}
