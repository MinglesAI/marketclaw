/**
 * Shared templates for workspace files.
 * Used by setup and project_register.
 *
 * All templates are loaded from defaults/ at the repo root.
 * These files serve as both documentation and the runtime source of truth.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
// ---------------------------------------------------------------------------
// File loader — reads from defaults/ (single source of truth)
// ---------------------------------------------------------------------------

// esbuild bundles everything into dist/index.js, so import.meta.url points to
// dist/index.js → one level up reaches the repo root where defaults/ lives.
const DEFAULTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "defaults");

function loadDefault(filename: string): string {
  const filePath = path.join(DEFAULTS_DIR, filename);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(`Failed to load default file: ${filePath} (${(err as Error).message})`);
  }
}

// ---------------------------------------------------------------------------
// Role prompts — defaults/marketclaw/prompts/
// ---------------------------------------------------------------------------

const DEFAULT_STRATEGIST_INSTRUCTIONS = loadDefault("marketclaw/prompts/strategist.md");
const DEFAULT_CREATOR_INSTRUCTIONS = loadDefault("marketclaw/prompts/creator.md");
const DEFAULT_REVIEWER_INSTRUCTIONS = loadDefault("marketclaw/prompts/reviewer.md");
const DEFAULT_PUBLISHER_INSTRUCTIONS = loadDefault("marketclaw/prompts/publisher.md");
const DEFAULT_ANALYST_INSTRUCTIONS = loadDefault("marketclaw/prompts/analyst.md");

/** Default role instructions indexed by role ID. Used by project scaffolding. */
export const DEFAULT_ROLE_INSTRUCTIONS: Record<string, string> = {
  strategist: DEFAULT_STRATEGIST_INSTRUCTIONS,
  creator: DEFAULT_CREATOR_INSTRUCTIONS,
  reviewer: DEFAULT_REVIEWER_INSTRUCTIONS,
  publisher: DEFAULT_PUBLISHER_INSTRUCTIONS,
  analyst: DEFAULT_ANALYST_INSTRUCTIONS,
};

// ---------------------------------------------------------------------------
// Workspace templates — defaults/AGENTS.md, defaults/SOUL.md, etc.
// ---------------------------------------------------------------------------

export const AGENTS_MD_TEMPLATE = loadDefault("AGENTS.md");
export const HEARTBEAT_MD_TEMPLATE = loadDefault("HEARTBEAT.md");
export const IDENTITY_MD_TEMPLATE = loadDefault("IDENTITY.md");
export const SOUL_MD_TEMPLATE = loadDefault("SOUL.md");
export const TOOLS_MD_TEMPLATE = loadDefault("TOOLS.md");

// ---------------------------------------------------------------------------
// Workflow YAML — marketclaw/workflow.yaml
// ---------------------------------------------------------------------------

export const WORKFLOW_YAML_TEMPLATE = loadDefault("marketclaw/workflow.yaml");
