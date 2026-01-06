---
name: enrich
description: Enrich a person or company with Apollo.io data
argument-hint: "<person|company> <identifier>"
allowed-tools:
  - mcp__apollo__enrich_person
  - mcp__apollo__enrich_company
  - mcp__apollo__enrich_company_by_name
  - mcp__apollo__bulk_enrich_companies
  - mcp__apollo__export_to_csv
  - Read
---

# Apollo Enrich Command

Enrich people or companies with full Apollo.io data. CONSUMES CREDITS.

## Instructions

### For Person Enrichment

User can provide:
- Email: `enrich person john@company.com`
- Name + Company: `enrich person "John Doe" at Anthropic`
- LinkedIn URL: `enrich person https://linkedin.com/in/johndoe`

Use `enrich_person` with appropriate parameters.

### For Company Enrichment

User can provide:
- Domain: `enrich company apollo.io`
- Name: `enrich company "Anthropic"`

For domain: Use `enrich_company`
For name: Use `enrich_company_by_name` (auto-finds domain)

### For Bulk Company Enrichment

If user provides a list or file:
- Parse company names
- Use `bulk_enrich_companies`
- Report success/failure for each

## Output Format

### Person Results
Display:
- Full name and title
- Email (with verification status)
- Company and industry
- Location
- LinkedIn URL
- Employment history (if available)

### Company Results
Display:
- Company name and website
- Industry and description
- Employee count
- Revenue
- Total funding and latest round
- Technologies used
- Headcount by department

## Tips

Remind user:
- Enrichment consumes credits
- Company enrichment by name uses 2 API calls (search + enrich)
- Results can be exported to CSV
