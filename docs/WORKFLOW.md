# MarketClaw Workflow

End-to-end content pipeline from campaign idea to performance analytics.

## Pipeline Overview

```
Idea → Research → Create → Review → Publish → [7 days] → Analyze → Done
```

## States

### Hold States (waiting for human decision)
- **Planning** — New issue. Approve to move to To Do.
- **Refining** — Worker is blocked, needs human input. Approve to restart.
- **Published** — Content is live. Heartbeat auto-advances after `analyzeAfterDays`.

### Strategist Pipeline
- **To Research** → **Researching** → Done (closes research issue)
- Strategist writes campaign brief + OKRs, creates implementation tasks

### Creator Pipeline
- **To Do** → **Creating** → **To Review**
- Creator writes content files, opens PR

### Review Pipeline
- **To Review** → **Reviewing** → **To Publish**
- Reviewer checks brand voice, accuracy, CTA, platform fit

### Publication Pipeline
- **To Publish** → **Publishing** → **Published**
- Publisher posts to platform, records URL, takes screenshot

### Analytics Pipeline
- **To Analyze** → **Analyzing** → **Done**
- Analyst collects metrics, writes report, posts summary on campaign issue

### Revision
- **To Improve** → **Creating** (priority 3)
- Triggered by: reviewer reject, publisher fail, PR changes requested

## Policies

### reviewPolicy
Controls how content PRs are reviewed:
- `human` (default) — PR needs human approval on GitHub. Heartbeat auto-merges when approved.
- `agent` — Agent reviewer dispatched for every PR.
- `skip` — Review skipped. PR auto-merged after creation. (Not recommended for production.)

### publishPolicy
Controls publication after review:
- `agent` (default) — Publisher worker dispatched when content enters "To Publish".
- `skip` — Skip publication step. Content moves to "Published" immediately. (For testing.)
- `human` — Wait for human to manually trigger.

### analyzeAfterDays
Days after publication before analytics are triggered (default: 7).
Set to 0 to disable automatic analytics.

## Events

| Event | Meaning |
|-------|---------|
| APPROVE | Human approves hold state |
| PICKUP | Worker picks up queued issue |
| COMPLETE (done) | Strategist/Analyst completes |
| COMPLETE | Creator completes → transitions to review |
| PASS | Publisher successfully published |
| FAIL | Publisher failed to publish |
| APPROVE/REJECT | Reviewer approves/rejects |
| BLOCKED | Worker is stuck, needs human |
| SKIP | Heartbeat auto-skips based on policy |

## Labels

All workflow states create GitHub labels. The heartbeat uses these labels to:
1. Dispatch workers to queued issues
2. Poll PR status for review transitions
3. Trigger analytics after publish delay
