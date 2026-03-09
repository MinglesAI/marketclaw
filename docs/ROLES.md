# MarketClaw Roles

## Strategist

**Analogy:** CMO / Head of Marketing  
**Trigger:** `research_task()` or issue in "To Research" queue  
**Output:** Campaign brief + OKRs + implementation tasks  

The Strategist researches markets, competitors, and audiences. They write detailed campaign
briefs that give Creators everything needed to produce effective content. They also create
the implementation tasks for each content piece.

**Levels:**
- `junior` — Standard campaigns, existing markets
- `senior` — New market entries, complex positioning, competitor analysis

**Completion:**
- `done` — Brief written, tasks created → closes research issue
- `blocked` → Refining (needs human input)

---

## Creator

**Analogy:** Content Writer / Copywriter  
**Trigger:** Issue in "To Do" or "To Improve" queue  
**Output:** Content files in `/content/`, `/social/`, `/email/` + PR  

The Creator reads the campaign brief and writes the specified content piece. They
open a content PR just like DevClaw developers — the same review/merge pipeline works
unchanged.

**Levels:**
- `junior` — Short social posts, templated newsletters
- `medior` — LinkedIn articles, email campaigns, blog posts
- `senior` — Thought leadership, launch announcements, complex multi-piece series

**Completion:**
- `done` — Content written, PR opened → enters review
- `blocked` → Refining (missing brief, unclear requirements, etc.)

---

## Reviewer

**Analogy:** Brand Manager / Editor  
**Trigger:** Issue in "Reviewing" queue (or PR approved via policy)  
**Output:** PR approval or rejection with feedback  

The Reviewer checks every content piece against brand standards before it goes live.
They use a structured checklist: brand voice, factual accuracy, audience fit, CTA
effectiveness, and platform-specific requirements.

**Levels:**
- `junior` — Routine content review with checklist
- `senior` — Sensitive campaigns, new brand territory, complex positioning

**Completion:**
- `approve` — Merges PR → content enters "To Publish"
- `reject` → To Improve (Creator fixes based on feedback)
- `blocked` → Refining

---

## Publisher

**Analogy:** Social Media Manager / Email Manager  
**Trigger:** Issue in "To Publish" queue  
**Output:** Content live on platform + published URL recorded  

The Publisher takes reviewed content and posts it to the correct platform. They
verify publication, take a screenshot, and record the URL in the campaign report.
If the publish date is in the future, they note the schedule and wait for the
heartbeat to re-dispatch when the date arrives.

**Platforms:** LinkedIn, Twitter/X, Telegram, Beehiiv email

**Levels:**
- `junior` — Standard platform publishing (LinkedIn posts, newsletter)
- `senior` — Complex multi-platform campaigns, scheduled sequences

**Completion:**
- `pass` — Successfully published → issue moves to "Published"
- `fail` → To Improve (publishing error, credentials issue, platform down)
- `blocked` → Refining (future publish date → re-dispatched when date arrives)

---

## Analyst

**Analogy:** Performance Marketing Manager  
**Trigger:** Heartbeat cron ~7 days after publication  
**Output:** Metrics report + comment on campaign brief issue  

The Analyst collects engagement data from published content and compares it to the
campaign KPIs. They write a structured report with what worked, what didn't, and
specific recommendations for the next campaign. They also post a summary comment
on the original campaign brief issue so the Strategist has data for the next brief.

**Levels:**
- `junior` — Standard metrics collection from platform analytics
- `senior` — Cross-platform analysis, attribution modeling, deep insights

**Completion:**
- `done` — Report written, findings posted → issue closes
- `blocked` → Refining (no analytics access, platform API down)

---

## Level Selection Guide

| Task Type | Recommended Level |
|-----------|------------------|
| Short social post (LinkedIn, Telegram) | junior |
| Standard blog post / email campaign | medior |
| Campaign brief / strategy research | junior (or senior for complex) |
| Thought leadership / launch campaign | senior |
| Routine platform publishing | junior |
| Complex multi-platform campaign | senior |
| Standard metrics collection | junior |
| Cross-platform attribution analysis | senior |
