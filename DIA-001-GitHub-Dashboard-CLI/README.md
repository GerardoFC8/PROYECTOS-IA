# GitHub Dashboard CLI

Real-time GitHub stats in your terminal. Displays commit activity, streaks, top languages, and most starred repos with auto-refresh every 30 seconds.

Supports both public and authenticated modes — with a token, it includes private repos and higher rate limits.

## Features

- Profile header: name, username, location, company, public/private repos, followers, following
- Commit stats: today, this week, this month, this year with visual bars
- Current streak of consecutive days with commits
- Mini bar graph of the last 14 days in terminal
- Top 6 most used languages with colored bars
- Top 6 repos sorted by stars (name, stars, forks, language, last push)
- Auto-refresh every 30 seconds
- ASCII art header with gradient colors

## Requirements

- Node.js 18+

## Installation

```bash
git clone <repo-url>
cd DIA-001-GitHub-Dashboard-CLI
npm install
```

## Usage

### With CLI arguments

```bash
# With token (includes private repos)
node dashboard.js YOUR_USERNAME ghp_yourtoken

# Without token (public repos only, reduced rate limit)
node dashboard.js YOUR_USERNAME
```

### With environment variables

```bash
export GH_USERNAME=your_username
export GH_TOKEN=ghp_yourtoken
node dashboard.js
```

### Using npm start

```bash
# After setting env vars
npm start

# Or with arguments
node dashboard.js YOUR_USERNAME ghp_yourtoken
```

### Without token (public mode)

```bash
node dashboard.js octocat
```

Only public repos are shown and the GitHub API rate limit is lower (60 requests/hour vs 5000 with a token).

### With token (authenticated mode)

```bash
node dashboard.js octocat ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

With a token the dashboard uses `GET /user/repos` to include private repos and gets a much higher rate limit.

## GitHub Token

1. Go to GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Generate a new token with these scopes: `repo` (full access to private repos), `read:user`
3. Copy the token and use it as the second CLI argument or set it as `GH_TOKEN`

## Tech Stack

- Node.js 18+ (ESM)
- axios — HTTP client for the GitHub API
- chalk v5 — Terminal colors
- ora v8 — Loading spinners
- cli-table3 — Table formatting
- figlet — ASCII art text
- gradient-string — Gradient colors for the header
