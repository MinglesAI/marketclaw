# Email Content

Newsletter issues, drip sequences, and standalone campaigns.

## Directory Structure

```
email/
  <campaign-slug>/
    <email-slug>.md
```

## Frontmatter Spec

```yaml
---
platform: email
campaign: <slug>
subject: "Your subject line here (30-50 chars)"
preview_text: "Short preview text that appears after subject (max 100 chars)"
publish_date: "YYYY-MM-DD"    # Leave blank for ASAP
sequence_name: ""             # Leave blank for standalone; e.g. "onboarding" for sequences
delay_days: 0                 # Days after sequence start (0 = day 1)
status: draft                 # draft | review | published
published_url: ""             # Beehiiv post URL, filled by Publisher
published_at: ""              # ISO 8601, filled by Publisher
---
```

## Email Body Format

Write in Markdown. Keep paragraphs to 2-3 lines max. Include:
- Opening hook (first sentence grabs attention)
- Short paragraphs
- One primary CTA (button or link)
- Optional: P.S. line for secondary CTA

## Subject Line Best Practices

- 30-50 characters (mobile-first)
- Specific > clever
- Question or number often performs well
- Avoid spam trigger words: FREE, GUARANTEED, CLICK HERE
