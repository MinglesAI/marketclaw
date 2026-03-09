# Social Media Content

Platform-specific social media posts.

## Directory Structure

```
social/
  linkedin/
    <campaign-slug>/
      <post-slug>.md
  twitter/
    <campaign-slug>/
      <post-slug>.md     # Thread: each tweet separated by ---
  telegram/
    <campaign-slug>/
      <post-slug>.md
```

## Frontmatter Spec

```yaml
---
platform: linkedin        # linkedin | twitter | telegram | instagram
campaign: <slug>
publish_date: "YYYY-MM-DD"   # Leave blank for ASAP
hashtags:
  - "#SaaS"
  - "#AI"
status: draft             # draft | review | published
published_url: ""         # Filled by Publisher
published_at: ""          # ISO 8601, filled by Publisher
---
```

## Platform Notes

### LinkedIn
- 150-300 words for standard posts
- Hook in first 2 lines (before "see more")
- No markdown formatting — use plain text with line breaks
- Add hashtags at the bottom

### Twitter / X Thread
- Separate tweets with `---` on its own line
- First tweet is the hook (standalone value)
- Label: `🧵 Thread: <topic> (1/N)` in tweet 1
- Final tweet: CTA

### Telegram
- 100-300 words
- Use **bold** for emphasis
- Emoji sparingly (1-3 per post)
