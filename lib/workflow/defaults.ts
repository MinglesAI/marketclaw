/**
 * workflow/defaults.ts — Default workflow configuration.
 *
 * MarketClaw content pipeline: Strategist → Creator → Reviewer → Publisher → Analyst
 */
import {
  type WorkflowConfig,
  StateType,
  ExecutionMode,
  ReviewPolicy,
  PublishPolicy,
  Action,
  WorkflowEvent,
  ReviewCheck,
} from "./types.js";

export const DEFAULT_WORKFLOW: WorkflowConfig = {
  initial: "planning",
  reviewPolicy: ReviewPolicy.HUMAN,
  publishPolicy: PublishPolicy.AGENT,
  analyzeAfterDays: 7,
  roleExecution: ExecutionMode.PARALLEL,
  states: {
    // ── Hold states ─────────────────────────────────────────────
    planning: {
      type: StateType.HOLD,
      label: "Planning",
      color: "#95a5a6",
      on: { [WorkflowEvent.APPROVE]: "todo" },
    },
    refining: {
      type: StateType.HOLD,
      label: "Refining",
      color: "#f39c12",
      on: { [WorkflowEvent.APPROVE]: "todo" },
    },

    // ── Strategist research pipeline ─────────────────────────────
    toResearch: {
      type: StateType.QUEUE,
      role: "strategist",
      label: "To Research",
      color: "#0075ca",
      priority: 1,
      on: { [WorkflowEvent.PICKUP]: "researching" },
    },
    researching: {
      type: StateType.ACTIVE,
      role: "strategist",
      label: "Researching",
      color: "#4a90e2",
      on: {
        [WorkflowEvent.COMPLETE]: { target: "done", actions: [Action.CLOSE_ISSUE] },
        [WorkflowEvent.BLOCKED]: "refining",
      },
    },

    // ── Creator pipeline (happy path) ────────────────────────────
    todo: {
      type: StateType.QUEUE,
      role: "creator",
      label: "To Do",
      color: "#428bca",
      priority: 1,
      on: { [WorkflowEvent.PICKUP]: "creating" },
    },
    creating: {
      type: StateType.ACTIVE,
      role: "creator",
      label: "Creating",
      color: "#f0ad4e",
      on: {
        [WorkflowEvent.COMPLETE]: { target: "toReview", actions: [Action.DETECT_PR] },
        [WorkflowEvent.BLOCKED]: "refining",
      },
    },

    // ── Review pipeline ──────────────────────────────────────────
    toReview: {
      type: StateType.QUEUE,
      role: "reviewer",
      label: "To Review",
      color: "#7057ff",
      priority: 2,
      check: ReviewCheck.PR_APPROVED,
      on: {
        [WorkflowEvent.PICKUP]: "reviewing",
        [WorkflowEvent.APPROVED]: { target: "toPublish", actions: [Action.MERGE_PR, Action.GIT_PULL] },
        [WorkflowEvent.SKIP]: { target: "toPublish", actions: [Action.MERGE_PR, Action.GIT_PULL] },
        [WorkflowEvent.MERGE_FAILED]: "toImprove",
        [WorkflowEvent.CHANGES_REQUESTED]: "toImprove",
        [WorkflowEvent.MERGE_CONFLICT]: "toImprove",
        [WorkflowEvent.PR_CLOSED]: { target: "rejected", actions: [Action.CLOSE_ISSUE] },
      },
    },
    reviewing: {
      type: StateType.ACTIVE,
      role: "reviewer",
      label: "Reviewing",
      color: "#c5def5",
      on: {
        [WorkflowEvent.APPROVE]: { target: "toPublish", actions: [Action.MERGE_PR, Action.GIT_PULL] },
        [WorkflowEvent.REJECT]: "toImprove",
        [WorkflowEvent.BLOCKED]: "refining",
      },
    },

    // ── Publication pipeline ─────────────────────────────────────
    toPublish: {
      type: StateType.QUEUE,
      role: "publisher",
      label: "To Publish",
      color: "#e67e22",
      priority: 2,
      on: {
        [WorkflowEvent.PICKUP]: "publishing",
        [WorkflowEvent.SKIP]: { target: "published", actions: [Action.CLOSE_ISSUE] },
      },
    },
    publishing: {
      type: StateType.ACTIVE,
      role: "publisher",
      label: "Publishing",
      color: "#d35400",
      on: {
        [WorkflowEvent.PASS]: { target: "published", actions: [Action.CLOSE_ISSUE] },
        [WorkflowEvent.FAIL]: "toImprove",
        [WorkflowEvent.BLOCKED]: "refining",
      },
    },

    // ── Published hold state → analytics ────────────────────────
    published: {
      type: StateType.HOLD,
      label: "Published",
      color: "#27ae60",
      on: { [WorkflowEvent.APPROVE]: "toAnalyze" },
    },

    // ── Analytics pipeline ───────────────────────────────────────
    toAnalyze: {
      type: StateType.QUEUE,
      role: "analyst",
      label: "To Analyze",
      color: "#8e44ad",
      priority: 1,
      on: { [WorkflowEvent.PICKUP]: "analyzing" },
    },
    analyzing: {
      type: StateType.ACTIVE,
      role: "analyst",
      label: "Analyzing",
      color: "#9b59b6",
      on: {
        [WorkflowEvent.COMPLETE]: { target: "done", actions: [Action.CLOSE_ISSUE] },
        [WorkflowEvent.BLOCKED]: "refining",
      },
    },

    // ── Terminal states ──────────────────────────────────────────
    done: {
      type: StateType.TERMINAL,
      label: "Done",
      color: "#5cb85c",
    },
    rejected: {
      type: StateType.TERMINAL,
      label: "Rejected",
      color: "#e11d48",
    },

    // ── Revision loop ────────────────────────────────────────────
    toImprove: {
      type: StateType.QUEUE,
      role: "creator",
      label: "To Improve",
      color: "#d9534f",
      priority: 3,
      on: { [WorkflowEvent.PICKUP]: "creating" },
    },
  },
};
