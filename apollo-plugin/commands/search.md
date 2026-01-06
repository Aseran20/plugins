---
name: search
description: Search for contacts or companies in Apollo.io
argument-hint: "<people|companies> [filters...]"
allowed-tools:
  - mcp__apollo__search_people
  - mcp__apollo__search_companies
  - mcp__apollo__export_to_csv
---

# Apollo Search Command

Help the user search for people or companies in the Apollo.io database.

## Instructions

1. Determine if user wants to search **people** or **companies**
2. Parse their criteria into appropriate filters
3. Execute the search using the correct MCP tool
4. Present results in a clear, formatted way
5. Offer to export to CSV if they have good results

## For People Search (FREE)

Use `search_people` with these common filters:
- `person_titles` - Job titles like ["CEO", "CTO"]
- `person_seniorities` - Levels like ["c_suite", "vp", "director"]
- `person_locations` - Where they live ["France", "Paris"]
- `organization_locations` - Company HQ location
- `organization_num_employees_ranges` - Size like ["51,200"]

## For Company Search (USES CREDITS)

Use `search_companies` with:
- `q_organization_name` - Company name (partial match)
- `organization_locations` - HQ location
- `q_organization_keyword_tags` - Industry tags ["fintech", "saas"]
- `organization_num_employees_ranges` - Size

## Output Format

Present results as a table with key columns:
- For people: Name, Title, Company, Location, Has Email
- For companies: Name, Industry, Employees, Location, Revenue

Ask if user wants to:
1. Refine the search with more filters
2. See more results (next page)
3. Export to CSV
4. Enrich specific results
