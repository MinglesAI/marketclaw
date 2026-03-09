/**
 * roles/registry.ts — Single source of truth for all worker roles.
 *
 * MarketClaw roles:
 * - strategist: CMO-level research + campaign brief writing (replaces architect)
 * - creator: Content writer — writes posts, emails, articles (replaces developer)
 * - reviewer: Brand + quality reviewer (same pattern as DevClaw reviewer)
 * - publisher: Publication executor — posts content to platforms (new role)
 * - analyst: Performance analyst — measures results after publication (new role)
 *
 * Each role defines:
 * - Identity (id, displayName)
 * - Levels and models
 * - Emoji for announcements
 * - Valid completion results
 * - Session key matching
 * - Notification preferences
 */
import type { RoleConfig } from "./types.js";

export const ROLE_REGISTRY: Record<string, RoleConfig> = {
  strategist: {
    id: "strategist",
    displayName: "STRATEGIST",
    levels: ["junior", "senior"],
    defaultLevel: "junior",
    models: {
      junior: "anthropic/claude-sonnet-4-5",
      senior: "anthropic/claude-opus-4-6",
    },
    emoji: {
      junior: "📊",
      senior: "🎯",
    },
    fallbackEmoji: "🎯",
    completionResults: ["done", "blocked"],
    sessionKeyPattern: "strategist",
    notifications: { onStart: true, onComplete: true },
  },

  creator: {
    id: "creator",
    displayName: "CREATOR",
    levels: ["junior", "medior", "senior"],
    defaultLevel: "medior",
    models: {
      junior: "anthropic/claude-haiku-4-5",
      medior: "anthropic/claude-sonnet-4-5",
      senior: "anthropic/claude-opus-4-6",
    },
    emoji: {
      junior: "✏️",
      medior: "🖊️",
      senior: "✍️",
    },
    fallbackEmoji: "✍️",
    completionResults: ["done", "blocked"],
    sessionKeyPattern: "creator",
    notifications: { onStart: true, onComplete: true },
  },

  reviewer: {
    id: "reviewer",
    displayName: "REVIEWER",
    levels: ["junior", "senior"],
    defaultLevel: "junior",
    models: {
      junior: "anthropic/claude-haiku-4-5",
      senior: "anthropic/claude-sonnet-4-5",
    },
    emoji: {
      junior: "👁️",
      senior: "🔬",
    },
    fallbackEmoji: "👁️",
    completionResults: ["approve", "reject", "blocked"],
    sessionKeyPattern: "reviewer",
    notifications: { onStart: true, onComplete: true },
  },

  publisher: {
    id: "publisher",
    displayName: "PUBLISHER",
    levels: ["junior", "senior"],
    defaultLevel: "junior",
    models: {
      junior: "anthropic/claude-sonnet-4-5",
      senior: "anthropic/claude-opus-4-6",
    },
    emoji: {
      junior: "📣",
      senior: "🚀",
    },
    fallbackEmoji: "📣",
    completionResults: ["pass", "fail", "blocked"],
    sessionKeyPattern: "publisher",
    notifications: { onStart: true, onComplete: true },
  },

  analyst: {
    id: "analyst",
    displayName: "ANALYST",
    levels: ["junior", "senior"],
    defaultLevel: "junior",
    models: {
      junior: "anthropic/claude-haiku-4-5",
      senior: "anthropic/claude-sonnet-4-5",
    },
    emoji: {
      junior: "📈",
      senior: "📉",
    },
    fallbackEmoji: "📈",
    completionResults: ["done", "blocked"],
    sessionKeyPattern: "analyst",
    notifications: { onStart: true, onComplete: true },
  },
};
