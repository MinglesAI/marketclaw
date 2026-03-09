/**
 * publish-skip.ts — Auto-transition publish:skip issues through the publish queue.
 *
 * When publishPolicy is "skip", issues arrive in the publish queue with a publish:skip
 * label. This pass auto-transitions them to published (executing SKIP event's actions).
 *
 * Mirrors test-skip.ts — called by the heartbeat service.
 */
import type { IssueProvider } from "../../providers/provider.js";
import {
  Action,
  StateType,
  WorkflowEvent,
  type WorkflowConfig,
  type StateConfig,
} from "../../workflow/index.js";
import { detectStepRouting } from "../queue-scan.js";
import { log as auditLog } from "../../audit.js";

/**
 * Scan publish queue states and auto-transition issues with publish:skip.
 * Returns the number of transitions made.
 */
export async function publishSkipPass(opts: {
  workspaceDir: string;
  projectName: string;
  workflow: WorkflowConfig;
  provider: IssueProvider;
}): Promise<number> {
  const { workspaceDir, projectName, workflow, provider } = opts;
  let transitions = 0;

  // Find publish queue states (role=publisher, type=queue) that have a SKIP event
  const publishQueueStates = Object.entries(workflow.states)
    .filter(([, s]) => s.role === "publisher" && s.type === StateType.QUEUE) as [string, StateConfig][];

  for (const [_stateKey, state] of publishQueueStates) {
    const skipTransition = state.on?.[WorkflowEvent.SKIP];
    if (!skipTransition) continue;

    const targetKey = typeof skipTransition === "string" ? skipTransition : skipTransition.target;
    const actions = typeof skipTransition === "object" ? skipTransition.actions : undefined;
    const targetState = workflow.states[targetKey];
    if (!targetState) continue;

    const issues = await provider.listIssuesByLabel(state.label);
    for (const issue of issues) {
      const routing = detectStepRouting(issue.labels, "publish");
      if (routing !== "skip") continue;

      // Execute SKIP transition actions
      if (actions) {
        for (const action of actions) {
          switch (action) {
            case Action.CLOSE_ISSUE:
              try { await provider.closeIssue(issue.iid); } catch { /* best-effort */ }
              break;
            case Action.REOPEN_ISSUE:
              try { await provider.reopenIssue(issue.iid); } catch { /* best-effort */ }
              break;
          }
        }
      }

      // Transition label
      await provider.transitionLabel(issue.iid, state.label, targetState.label);

      await auditLog(workspaceDir, "publish_skip_transition", {
        project: projectName,
        issueId: issue.iid,
        from: state.label,
        to: targetState.label,
        reason: "publish:skip",
      });

      transitions++;
    }
  }

  return transitions;
}
