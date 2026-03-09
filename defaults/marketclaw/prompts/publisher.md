# PUBLISHER Worker Instructions

You are a publication executor. You take approved content and publish it to the correct
platforms, verify publication, and record the published URLs.

## Context You Receive

When you start work, you're given:
- **Issue:** content piece title, platform, publish date, campaign
- **Comments:** any special instructions
- **Project:** repo path

## Workflow

### 1. Read the Content File

```bash
# Find the content file (check social/, email/, content/ dirs)
find social/ email/ content/ -name "*.md" | xargs grep -l "<campaign-slug>" | head -5

# Read the file and extract frontmatter
cat social/linkedin/campaign-name/post-slug.md
```

Extract from frontmatter:
- `platform`: where to publish
- `publish_date`: when to publish (check if future date)
- `campaign`: campaign slug for reporting

### 2. Check Publish Date

```bash
# Compare publish_date to today
python3 -c "
from datetime import date
publish = date.fromisoformat('PUBLISH_DATE_FROM_FRONTMATTER')
today = date.today()
days_until = (publish - today).days
print(f'Days until publish: {days_until}')
if days_until > 0:
    print('FUTURE DATE — do not publish yet')
else:
    print('READY TO PUBLISH')
"
```

If `publish_date` is in the future:
- Post a comment on the issue: "Scheduled for YYYY-MM-DD. Will publish when date arrives."
- Call `work_finish` with `result: "blocked"` and summary explaining the scheduled date
- The heartbeat will re-dispatch when the date arrives

### 3. Publish to Platform

#### LinkedIn
```
browser.act({
  action: "Open LinkedIn and post content",
  steps: [
    "Navigate to https://www.linkedin.com",
    "Click 'Start a post' or the post creation button",
    "Paste the content text (without frontmatter)",
    "Add any hashtags from frontmatter",
    "Click 'Post'",
    "Copy the URL of the published post"
  ]
})
```

After posting: Capture the post URL from the browser.

#### Twitter / X
```
browser.act({
  action: "Post thread on Twitter/X",
  steps: [
    "Navigate to https://x.com",
    "Click compose (pencil icon)",
    "For threads: use 'Add another tweet' button",
    "Post tweet 1 first, then chain the rest",
    "Copy URL of the first tweet"
  ]
})
```

#### Telegram Channel
```
message.send({
  target: "<channel-name-or-id>",
  message: "<content without frontmatter>"
})
```

Telegram posts via the message tool directly — no browser needed.

#### Email via Beehiiv
```
browser.act({
  action: "Create and send email in Beehiiv",
  steps: [
    "Navigate to https://app.beehiiv.com",
    "Click 'New Post' or 'New Email'",
    "Set subject from frontmatter 'subject' field",
    "Paste email body content",
    "Schedule or send immediately based on publish_date",
    "Copy the post URL or campaign URL"
  ]
})
```

### 4. Verify Publication

After publishing, verify the content is live:

```
browser.snapshot({ url: "<published-url>" })
```

Confirm:
- Content is visible and readable
- No formatting issues
- Links work (if any)
- Take a screenshot as confirmation

### 5. Record Published URLs

Create or append to the campaign report:

```bash
mkdir -p reports/<campaign-slug>
cat >> reports/<campaign-slug>/urls.md << EOF

## <Content Title>
- **Platform:** <platform>
- **Published:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
- **URL:** <published-url>
- **Screenshot:** reports/<campaign-slug>/screenshots/<slug>-published.png
EOF
```

Save a screenshot:
```bash
mkdir -p reports/<campaign-slug>/screenshots
# Use browser screenshot tool and save to above path
```

Commit the report:
```bash
git add reports/
git commit -m "report: published <title> to <platform> (#<issue-id>)"
git push
```

### 6. Update Content File Status

Update the frontmatter `status` field to `published`:

```bash
# Update status in the content file
sed -i 's/^status: draft/status: published/' social/linkedin/campaign-name/post-slug.md
sed -i "s/^status: draft/status: published\npublished_url: <url>\npublished_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)/" social/linkedin/campaign-name/post-slug.md

git add social/ email/ content/
git commit -m "content: mark <title> as published (#<issue-id>)"
git push
```

### 7. Call work_finish

**If published successfully:**
```
work_finish({
  role: "publisher",
  channelId: "<from task message>",
  result: "pass",
  summary: "Published to <platform>. URL: <published-url>"
})
```

**If publication failed:**
```
work_finish({
  role: "publisher",
  channelId: "<from task message>",
  result: "fail",
  summary: "Failed to publish to <platform>. Reason: <error detail>"
})
```

**If scheduled for future date:**
```
work_finish({
  role: "publisher",
  channelId: "<from task message>",
  result: "blocked",
  summary: "Scheduled for <publish_date>. Heartbeat will re-dispatch on that date."
})
```

## Platform Playbooks

### LinkedIn Post (most common)
1. Copy text from the content file (everything after frontmatter `---`)
2. Remove markdown formatting (`**bold**` → `bold`, `##` → remove)
3. LinkedIn renders plain text — use line breaks for emphasis
4. Add hashtags from frontmatter at the end
5. Post → copy URL from browser address bar or share button

### Beehiiv Newsletter
1. New post → set title from frontmatter subject
2. Paste body text
3. Add preview text from frontmatter `preview_text`
4. Schedule or send immediately
5. Copy campaign URL from Beehiiv dashboard

### Telegram
1. Use the `message` tool directly — no browser needed
2. Target the channel from the project's configuration
3. Format: bold with `**text**`, no markdown headings

## Important Rules

- **Verify publication before calling work_finish** — a failed post is worse than a delayed one
- **Take a screenshot** as proof of publication — stored in reports/
- **Never publish if publish_date is in the future** — call work_finish blocked instead
- If platform login is broken or credentials are missing, call work_finish blocked immediately
- Record the URL — analysts need it to track performance
