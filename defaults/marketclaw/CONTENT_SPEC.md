# Content File Specification

This document defines the frontmatter standard for all MarketClaw content files.

## Universal Fields (all content types)

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `platform` | ✅ | `linkedin`, `twitter`, `telegram`, `email`, `web` | Publication platform |
| `campaign` | ✅ | `<campaign-slug>` | Links to `/campaigns/<slug>/brief.md` |
| `publish_date` | 🔲 | `YYYY-MM-DD` | Leave blank for ASAP publishing |
| `status` | ✅ | `draft`, `review`, `published` | Content lifecycle state |
| `published_url` | auto | URL string | Filled by Publisher after posting |
| `published_at` | auto | ISO 8601 | Filled by Publisher after posting |

## Social Posts (LinkedIn, Twitter, Telegram)

Additional fields:

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `hashtags` | 🔲 | Array of strings | `["#SaaS", "#AI"]` — no spaces in tags |

## Email

Additional fields:

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `subject` | ✅ | String (30-50 chars) | Email subject line |
| `preview_text` | ✅ | String (max 100 chars) | Preview text shown after subject |
| `sequence_name` | 🔲 | String | Blank = standalone; set for drip sequences |
| `delay_days` | 🔲 | Integer | Days from sequence start (0 = day 1) |

## Directory Mapping

| Platform | Directory | Filename |
|----------|-----------|----------|
| LinkedIn article/post | `social/linkedin/<campaign>/` | `<slug>.md` |
| Twitter/X thread | `social/twitter/<campaign>/` | `<slug>.md` |
| Telegram post | `social/telegram/<campaign>/` | `<slug>.md` |
| Email | `email/<campaign>/` | `<slug>.md` |
| Blog/web content | `content/<campaign>/` | `<slug>.md` |

## Complete Examples

### LinkedIn Post

```yaml
---
platform: linkedin
campaign: linkedin-launch-q1
publish_date: "2024-03-15"
hashtags:
  - "#AI"
  - "#Marketing"
  - "#SaaS"
status: draft
published_url: ""
published_at: ""
---

Hook line here — compelling opening.

Supporting point that builds on the hook.

The key insight or reveal.

What this means for you as a [target audience].

👉 CTA text here

#AI #Marketing #SaaS
```

### Email

```yaml
---
platform: email
campaign: product-launch-v2
subject: "We shipped something you've been asking for"
preview_text: "Took 3 months. Worth every week."
publish_date: "2024-03-20"
sequence_name: ""
delay_days: 0
status: draft
published_url: ""
published_at: ""
---

Opening hook that gets to the point immediately.

Body paragraph with the core message.

**CTA text** — link to relevant page

P.S. Secondary message if needed.
```

### Twitter Thread

```yaml
---
platform: twitter
campaign: founder-story
publish_date: ""
hashtags:
  - "#buildinpublic"
status: draft
published_url: ""
published_at: ""
---

🧵 Thread hook — standalone value (1/8)

---

Second tweet builds on the hook.

---

Third tweet — key insight or data point.

---

[... more tweets ...]

---

Final tweet — CTA and follow prompt.

#buildinpublic
```
