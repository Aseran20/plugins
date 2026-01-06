---
name: Apollo Prospecting
description: |
  Use this skill when the user mentions "apollo", "prospection", "recherche contacts", "leads", "enrichissement", "B2B data", "find prospects", "company enrichment", or asks about searching for people or companies for sales purposes. This skill provides expertise on using Apollo.io API through the MCP tools.
version: 1.0.0
---

# Apollo.io Prospecting Guide

## ⚠️ LIMITATIONS CRITIQUES - LIRE EN PREMIER

Ces limitations sont côté API Apollo. Les ignorer causera des erreurs silencieuses:

### 1. Caractères accentués = 0 résultats
L'API Apollo ne gère PAS les accents dans `q_keywords`:
- ❌ `"François Müller"` → 0 résultats
- ✅ `"Francois Muller"` → 80 résultats
- Pas de normalisation automatique (Muller ≠ Mueller = résultats différents)

**Action**: Toujours retirer les accents des recherches par mots-clés.

### 2. location_hint peut causer des faux positifs
Avec `enrich_company_by_name`, le `location_hint` filtre trop agressivement:
- ❌ `company_name="OpenAI", location_hint="France"` → Retourne "OpenAirlines" (entreprise française)
- ✅ `company_name="OpenAI"` (sans hint) → Retourne correctement OpenAI

**Action**: Ne PAS utiliser `location_hint` pour des entreprises globales connues.

### 3. Noms masqués en recherche
`search_people` retourne `last_name_obfuscated` (ex: "Du***t" au lieu de "Dupont").
- Pour avoir le nom complet → utiliser `enrich_person`

### 4. Pagination limitée à 100
- Demander `per_page: 200` → Reçoit silencieusement 100
- Maximum absolu: 100 résultats par page

### 5. LinkedIn enrichment peu fiable
`enrich_person` par `linkedin_url` retourne souvent des données vides.
- **Préférer**: `first_name` + `last_name` + `domain`

### 6. PME/TPE peu représentées
Les petites entreprises locales (ex: "FTS Forêts Sàrl") ne sont souvent pas dans Apollo.
- Apollo est optimisé pour entreprises B2B avec présence digitale

### 7. Domaine invalide = objet vide
`enrich_company` avec domaine inexistant retourne `{}` sans erreur.
- Toujours vérifier si la réponse contient des données

---

## Available Tools

The Apollo plugin provides these MCP tools:

| Tool | Purpose | Credits |
|------|---------|---------|
| `search_people` | Find contacts by job title, location, company size | FREE |
| `search_companies` | Find companies by name, location, funding, tech stack | Consumes |
| `enrich_person` | Get email, phone, employment history for a contact | Consumes |
| `enrich_company` | Get full company data by domain | Consumes |
| `enrich_company_by_name` | Find + enrich company by name (auto-matches domain) | Consumes |
| `bulk_enrich_companies` | Enrich multiple companies from a name list | Consumes |
| `export_to_csv` | Export results to CSV format | FREE |

## Search Filters Reference

### People Search Filters

**Job Titles** (`person_titles`):
- Use specific titles: "CEO", "CTO", "VP Sales", "Head of Marketing"
- Apollo matches similar titles automatically

**Seniority Levels** (`person_seniorities`):
- `owner`, `founder` - Company owners
- `c_suite` - C-level executives
- `vp`, `head`, `director` - Leadership
- `manager`, `senior` - Mid-level
- `entry`, `intern` - Entry level

**Locations**:
- `person_locations` - Where the person lives
- `organization_locations` - Company HQ location
- Use: countries ("France"), cities ("Paris"), US states ("California")

**Company Size** (`organization_num_employees_ranges`):
- `"1,10"` - Micro (1-10)
- `"11,50"` - Small (11-50)
- `"51,200"` - Medium (51-200)
- `"201,500"` - Growth (201-500)
- `"501,1000"` - Large (501-1000)
- `"1001,5000"` - Enterprise (1001-5000)
- `"5001,10000"` - Large Enterprise

**Technologies** (`currently_using_any_of_technology_uids`):
- Use underscore for spaces: `google_analytics`, `wordpress_org`
- Common: `salesforce`, `hubspot`, `stripe`, `intercom`, `slack`

### Company Search Filters

- `q_organization_name` - Partial name match ("Anthropic")
- `q_organization_keyword_tags` - Industry tags ("fintech", "saas", "ai")
- `revenue_range_min/max` - Revenue in dollars (no symbols)
- `latest_funding_amount_range_min/max` - Last funding round
- `total_funding_range_min/max` - Total raised

## Best Practices

### 1. Start with Free People Search
```
search_people with person_titles=["CTO", "VP Engineering"]
and organization_num_employees_ranges=["51,200"]
```
This is FREE - find prospects without consuming credits.

### 2. Then Enrich Specific Targets
Only enrich contacts you actually want to contact.

### 3. Use Location Hints for Company Enrichment
When enriching by name, add `location_hint` for better matching:
```
enrich_company_by_name("Anthropic", location_hint="San Francisco")
```

### 4. Combine Filters for Quality
More filters = fewer but higher quality results:
- Title + Seniority + Location + Company Size

### 5. Pagination for Large Results
Use `page` and `per_page` (max 100) to iterate through results.
Maximum: 50,000 records (500 pages × 100).

## Common Queries

### Find Tech Startup CTOs in France
```json
{
  "person_titles": ["CTO", "Chief Technology Officer", "VP Engineering"],
  "person_locations": ["France"],
  "organization_num_employees_ranges": ["11,50", "51,200"],
  "per_page": 50
}
```

### Find SaaS Companies Using Stripe
```json
{
  "q_organization_keyword_tags": ["saas", "software"],
  "currently_using_any_of_technology_uids": ["stripe"],
  "organization_num_employees_ranges": ["51,200", "201,500"]
}
```

### Enrich a Company from Name Only
```json
{
  "company_name": "OpenAI",
  "location_hint": "San Francisco"
}
```
Returns: company details, funding history, tech stack, employee count by department.

## Data Returned

### Person Enrichment Returns:
- Email (verified/unverified status)
- Phone numbers (with `reveal_phone_number`)
- Current title and company
- Employment history
- LinkedIn URL
- Location (city, state, country)
- Seniority level
- Department

### Company Enrichment Returns:
- Website, social URLs (LinkedIn, Twitter, Facebook)
- Industry and keywords
- Employee count (estimated)
- Revenue (annual)
- Funding: total raised, rounds, investors
- Technologies used (32+ detected)
- Headcount by department (Engineering, Sales, Marketing...)
- Full address
- Description

## Credit Conservation Tips

1. **Use search_people first** - It's free and helps identify targets
2. **Batch enrichments** - Use bulk_enrich_companies for lists
3. **Cache results** - Don't re-enrich the same company twice
4. **Filter aggressively** - More filters = fewer credits used
