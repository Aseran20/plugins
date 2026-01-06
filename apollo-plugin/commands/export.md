---
name: export
description: Export Apollo.io results to CSV file
argument-hint: "[filename]"
allowed-tools:
  - mcp__apollo__export_to_csv
  - Write
---

# Apollo Export Command

Export search or enrichment results to CSV format.

## Instructions

1. Check if there are recent Apollo results in the conversation
2. If user specifies a filename, use it; otherwise suggest one
3. Use `export_to_csv` to format the data
4. Write the CSV content to the specified file using the Write tool

## Usage Examples

- `export` - Export last results to default filename
- `export prospects.csv` - Export to specific file
- `export companies_france.csv` - Custom filename

## Data Formatting

For people data, include columns:
- name, title, company, email, location, linkedin_url

For company data, include columns:
- name, domain, industry, employees, revenue, location, funding_total

## Output

1. Show preview of first few rows
2. Confirm file was written
3. Show full path to the file
