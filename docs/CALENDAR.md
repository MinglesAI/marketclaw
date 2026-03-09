# Content Calendar

MarketClaw uses GitHub Projects Roadmap view as the content calendar.

## How It Works

1. **Issues = content pieces** — Each blog post, LinkedIn article, or email is an issue
2. **Publish Date = timeline anchor** — Set via `publish_date` frontmatter or GitHub Projects field
3. **Roadmap view = calendar** — GitHub Projects Roadmap shows issues by Publish Date

## Setting Up the Content Calendar

### 1. Create a GitHub Project

```bash
gh project create --owner <org-or-user> --title "Content Calendar" --format "json"
```

Or create via GitHub UI: Repo → Projects → New Project → Roadmap

### 2. Add Custom Fields

In GitHub Projects UI:
- Add field: **Publish Date** (type: Date)
- Add field: **Platform** (type: Single select: LinkedIn, Twitter, Email, Telegram)
- Add field: **Campaign** (type: Text)

### 3. Add Issues to Project

Link your campaign repo to the project. All new content issues will appear in the calendar.

### 4. Set Publish Dates

**Strategist sets dates** when creating implementation tasks:
```
task_create({
  title: "Creator: LinkedIn post — Q1 launch announcement",
  description: "...\n\nPublish date: 2024-03-15\nPlatform: LinkedIn"
})
```

**Human operators** can adjust dates in the GitHub Projects Roadmap UI.

## Scheduled Publishing

The heartbeat checks `publish_date` on issues in the "To Publish" queue:

```
To Publish queue → heartbeat checks publish_date
  ├─ publish_date ≤ today → dispatch Publisher immediately
  └─ publish_date > today → skip (re-checked on next tick)
```

Publisher reads `publish_date` from content file frontmatter:

```yaml
---
platform: linkedin
campaign: q1-launch
publish_date: "2024-03-15"  # Publisher checks this
---
```

If the date is in the future, Publisher calls `work_finish(blocked)` and the heartbeat
re-dispatches when the date arrives.

## Analytics Scheduling

The heartbeat also tracks publication timestamps:

```
Published state → heartbeat checks published_at + analyzeAfterDays
  ├─ published_at + analyzeAfterDays ≤ today → transition to To Analyze
  └─ too early → skip
```

Default is 7 days. Configure in `marketclaw/workflow.yaml`:

```yaml
workflow:
  analyzeAfterDays: 7  # 0 to disable automatic analytics
```

## Viewing the Calendar

In GitHub Projects Roadmap view:
- **X-axis**: Time (weeks/months)
- **Y-axis**: Issues (content pieces)
- **Color-coded** by workflow state label
- **Filtered** by campaign, platform, or assignee

The Roadmap gives you a visual timeline of:
- What's being written this week
- What publishes next month
- What's awaiting analytics

## Best Practices

1. **Set publish dates in campaign brief** — Strategist includes a publish schedule table
2. **Create issues with dates** — Creator tasks should include publish_date in description
3. **Buffer time** — Schedule content 3-5 days before intended publish date to allow for review
4. **Campaign blocks** — Group related content with nearby publish dates for coordinated campaigns
