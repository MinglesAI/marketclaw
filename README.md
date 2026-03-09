# 📣 MarketClaw

AI marketing team orchestration plugin for OpenClaw.

MarketClaw turns a Telegram group into an autonomous AI marketing pipeline:
**Strategist → Creator → Reviewer → Publisher → Analyst** — end to end.

---

## Overview

MarketClaw forks DevClaw's battle-tested orchestration core and replaces the
development pipeline with a content marketing pipeline. The same atomic state machine,
heartbeat service, and audit trail — optimized for campaigns instead of code.

```
Campaign idea → Research brief → Content draft → Brand review → Publish → Analytics
     📊              🎯               ✍️               👁️           📣         📈
  Strategist       Strategist       Creator          Reviewer    Publisher   Analyst
```

---

## Roles

| Role | Levels | What they do |
|------|--------|--------------|
| **Strategist** | junior / senior | CMO-level research. Writes campaign briefs, OKRs, creates content tasks |
| **Creator** | junior / medior / senior | Content writer. Posts, emails, articles. Opens content PR |
| **Reviewer** | junior / senior | Brand + quality review. Approves or rejects with specific feedback |
| **Publisher** | junior / senior | Publishes to platforms. Records published URLs and screenshots |
| **Analyst** | junior / senior | Collects metrics ~7 days post-publish. Feeds learnings into next brief |

---

## Installation

```bash
# Install MarketClaw
npm install -g @minglesai/marketclaw

# Add to openclaw.json plugins:
{
  "plugins": {
    "entries": {
      "marketclaw": {
        "module": "@minglesai/marketclaw"
      }
    }
  }
}
```

---

## Quick Start

1. **Set up MarketClaw** (in Telegram group):
   ```
   /onboard
   ```
   Follow the guided setup. Creates workspace files and configures models.

2. **Set up a campaign repo**:
   ```bash
   git init my-campaigns
   cd my-campaigns
   mkdir -p campaigns content social/linkedin email reports
   cp /path/to/.agents/product-marketing-context.md .agents/
   ```

3. **Register the project**:
   ```
   /project_register name=mycampaigns repo=~/git/my-campaigns baseBranch=main
   ```

4. **Fill in brand context** (critical):
   Edit `.agents/product-marketing-context.md` with your company's voice, ICP, and positioning.

5. **Launch a campaign**:
   ```
   Create a campaign: "LinkedIn presence for our Q1 launch"
   ```
   MarketClaw creates an issue and dispatches a Strategist.

---

## Repo Structure

After setup, your campaign repo looks like this:

```
my-campaigns/
├── .agents/
│   └── product-marketing-context.md  # 🚨 Fill this in — brand voice, ICP, positioning
├── campaigns/
│   └── <slug>/
│       ├── brief.md     # Strategist writes this
│       └── okrs.md      # Campaign OKRs
├── content/
│   └── <campaign>/      # Blog posts, articles
├── social/
│   ├── linkedin/
│   ├── twitter/
│   └── telegram/
├── email/               # Email campaigns
├── assets/              # Images, videos
└── reports/
    └── <campaign>/
        ├── urls.md       # Published URLs (Publisher writes this)
        └── metrics-*.md  # Analytics reports (Analyst writes this)
```

---

## Workflow Pipeline

```
Planning ─── APPROVE ──→ To Do
                            │
                         PICKUP
                            ↓
                         Creating (Creator writes content + opens PR)
                            │
                         COMPLETE
                            ↓
                         To Review ←── auto-detected PR
                            │
                     APPROVED/SKIP
                            ↓
                         To Publish (PR merged, content in main branch)
                            │
                          PICKUP (Publisher worker)
                            ↓
                         Publishing (Publisher posts to platform)
                            │
                           PASS
                            ↓
                         Published (hold — waiting 7 days)
                            │
                    [heartbeat cron after 7 days]
                            ↓
                         To Analyze → Analyzing → Done
```

**Revision loop**: Any step can route to `To Improve → Creating` for fixes.

---

## Configuration

Edit `marketclaw/workflow.yaml` in your workspace:

```yaml
workflow:
  reviewPolicy: human    # human | agent | skip
  publishPolicy: agent   # agent | skip | human
  analyzeAfterDays: 7    # Days after publish before analytics
  
roles:
  creator:
    models:
      medior: anthropic/claude-sonnet-4-5
  publisher:
    models:
      junior: anthropic/claude-sonnet-4-5
```

---

## Content File Format

All content files use frontmatter:

```yaml
---
platform: linkedin
campaign: q1-launch
publish_date: "2024-03-15"
hashtags: ["#AI", "#SaaS"]
status: draft
---

Content goes here...
```

See `defaults/marketclaw/CONTENT_SPEC.md` for the full spec.

---

## Tools

MarketClaw registers the same tools as DevClaw with marketing-appropriate descriptions:

| Tool | What it does |
|------|--------------|
| `task_create` | Create campaign issues |
| `task_start` | Advance issue to next queue |
| `research_task` | Dispatch Strategist for campaign research |
| `work_finish` | Complete a worker's task |
| `tasks_status` | Live dashboard of all campaign work |
| `project_register` | Register campaign repo |
| `setup` | Configure MarketClaw |

---

## License

MIT — [MinglesAI](https://mingles.ai)
