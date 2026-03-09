# Content

Long-form content: blog posts, articles, guides.

## Directory Structure

```
content/
  <campaign-slug>/
    <post-slug>.md
```

## Frontmatter Spec

```yaml
---
platform: web           # web | medium | substack
campaign: <slug>
publish_date: "YYYY-MM-DD"   # Leave blank for ASAP
status: draft           # draft | review | published
published_url: ""       # Filled by Publisher after posting
published_at: ""        # ISO 8601 timestamp, filled by Publisher
---
```

## Content After Frontmatter

Write in Markdown. Include:
- H1 title (SEO target keyword + compelling promise)
- Introduction hook
- Subheadings (H2/H3)
- Conclusion with CTA
