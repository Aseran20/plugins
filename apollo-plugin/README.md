# Apollo.io Plugin for Claude Code

Sales prospecting plugin that integrates Apollo.io's B2B database with Claude Code.

## Features

- **Search Contacts** - Find prospects by job title, location, company size (FREE)
- **Search Companies** - Find companies by name, industry, funding, tech stack
- **Enrich People** - Get emails, phones, employment history
- **Enrich Companies** - Get full company data: funding, tech stack, headcount
- **Bulk Enrichment** - Enrich multiple companies from a list
- **CSV Export** - Export results for use in other tools

## Prerequisites

- Node.js 18+
- Apollo.io API key (from Settings > Integrations > API Keys)

## Installation

1. Clone or copy this plugin to your plugins directory

2. Install MCP server dependencies:
   ```bash
   cd mcp-server
   npm install
   npm run build
   ```

3. Set your Apollo API key as environment variable:
   ```bash
   # Windows (PowerShell)
   $env:APOLLO_API_KEY = "your-api-key-here"

   # macOS/Linux
   export APOLLO_API_KEY="your-api-key-here"
   ```

4. Enable the plugin in Claude Code:
   ```bash
   claude --plugin-dir /path/to/apollo-plugin
   ```

## Usage

### Natural Language
Just ask Claude naturally:
- "Find CTOs at French startups with 50-200 employees"
- "Enrich Anthropic company"
- "Search for Sales Directors in fintech companies"

### Slash Commands
- `/apollo:search people|companies [criteria]` - Search the database
- `/apollo:enrich person|company <identifier>` - Enrich with full data
- `/apollo:export [filename.csv]` - Export results to CSV

### Direct MCP Tools
The plugin exposes these tools:
- `search_people` - Search contacts (FREE)
- `search_companies` - Search organizations
- `enrich_person` - Enrich a person
- `enrich_company` - Enrich by domain
- `enrich_company_by_name` - Enrich by company name
- `bulk_enrich_companies` - Bulk enrichment
- `export_to_csv` - Format as CSV

## API Credits

| Action | Credits |
|--------|---------|
| Search People | FREE |
| Search Companies | Consumes |
| Enrich Person | Consumes |
| Enrich Company | Consumes |
| Enrich by Name | 2x (search + enrich) |

## Configuration

The plugin requires `APOLLO_API_KEY` environment variable.

Create your API key at: Apollo.io > Settings > Integrations > Apollo API > Create new key

## Examples

### Find Tech Leaders
```
Search for VPs and Directors of Engineering at companies
using Salesforce in the United States, 200-1000 employees
```

### Enrich a Target Company
```
Enrich the company "Stripe" - I need their funding history
and tech stack
```

### Bulk Enrichment
```
Enrich these companies: Anthropic, OpenAI, Cohere, Mistral
```

## Troubleshooting

**"APOLLO_API_KEY environment variable is required"**
- Ensure you've set the environment variable before starting Claude Code

**"Apollo API error (401)"**
- Check your API key is valid and has the required permissions

**"Apollo API error (429)"**
- Rate limited - wait and try again, or reduce request frequency

## License

MIT
