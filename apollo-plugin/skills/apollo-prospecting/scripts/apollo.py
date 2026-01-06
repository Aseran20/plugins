#!/usr/bin/env python3
"""
Apollo.io API Client for Claude Code
Replaces MCP server with simple HTTP calls
"""

import os
import sys
import json
import argparse
import csv
from io import StringIO
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode

APOLLO_API_BASE = "https://api.apollo.io/api/v1"

# Global companies that should not use location_hint
GLOBAL_COMPANIES = [
    'openai', 'anthropic', 'google', 'microsoft', 'amazon', 'meta', 'facebook',
    'apple', 'netflix', 'tesla', 'nvidia', 'datadog', 'stripe', 'salesforce',
    'oracle', 'ibm', 'intel', 'amd', 'cisco', 'adobe', 'spotify', 'uber',
    'airbnb', 'twitter', 'linkedin', 'slack', 'zoom', 'dropbox', 'github',
    'gitlab', 'atlassian', 'shopify', 'twilio', 'snowflake', 'palantir',
    'mistral', 'cohere', 'hugging face', 'huggingface', 'stability ai'
]

def get_api_key():
    """Get Apollo API key from environment"""
    api_key = os.environ.get('APOLLO_API_KEY')
    if not api_key:
        print("Error: APOLLO_API_KEY environment variable is required", file=sys.stderr)
        sys.exit(1)
    return api_key

def apollo_request(endpoint, method="POST", body=None):
    """Make request to Apollo API"""
    api_key = get_api_key()
    url = f"{APOLLO_API_BASE}{endpoint}"

    headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": api_key,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }

    if method == "GET" and body:
        params = urlencode({k: v for k, v in body.items() if v is not None})
        url = f"{url}?{params}"
        body = None

    data = json.dumps(body).encode('utf-8') if body else None
    req = Request(url, data=data, headers=headers, method=method)

    try:
        with urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"Apollo API error ({e.code}): {error_body}", file=sys.stderr)
        sys.exit(1)

def search_people(args):
    """Search for people/contacts in Apollo database (FREE)"""
    body = {}

    if args.titles:
        body['person_titles'] = args.titles
    if args.seniorities:
        body['person_seniorities'] = args.seniorities
    if args.locations:
        body['person_locations'] = args.locations
    if args.org_locations:
        body['organization_locations'] = args.org_locations
    if args.employees:
        body['organization_num_employees_ranges'] = args.employees
    if args.domains:
        body['q_organization_domains_list'] = args.domains
    if args.keywords:
        body['q_keywords'] = args.keywords
    if args.technologies:
        body['currently_using_any_of_technology_uids'] = args.technologies

    body['page'] = args.page
    body['per_page'] = min(args.per_page, 100)

    result = apollo_request("/mixed_people/search", "POST", body)
    return result

def search_companies(args):
    """Search for companies in Apollo database (CONSUMES CREDITS)"""
    body = {}

    if args.name:
        body['q_organization_name'] = args.name
    if args.locations:
        body['organization_locations'] = args.locations
    if args.employees:
        body['organization_num_employees_ranges'] = args.employees
    if args.technologies:
        body['currently_using_any_of_technology_uids'] = args.technologies
    if args.keywords:
        body['q_organization_keyword_tags'] = args.keywords

    body['page'] = args.page
    body['per_page'] = min(args.per_page, 100)

    result = apollo_request("/mixed_companies/search", "POST", body)
    return result

def enrich_person(args):
    """Enrich person data (CONSUMES CREDITS)"""
    body = {}

    if args.email:
        body['email'] = args.email
    if args.first_name:
        body['first_name'] = args.first_name
    if args.last_name:
        body['last_name'] = args.last_name
    if args.name:
        body['name'] = args.name
    if args.domain:
        body['domain'] = args.domain
    if args.company:
        body['organization_name'] = args.company
    if args.linkedin:
        body['linkedin_url'] = args.linkedin
    if args.id:
        body['id'] = args.id

    result = apollo_request("/people/match", "POST", body)
    return result

def enrich_company(args):
    """Enrich company by domain (CONSUMES CREDITS)"""
    result = apollo_request(f"/organizations/enrich?domain={args.domain}", "GET")
    return result

def enrich_company_by_name(args):
    """Find and enrich company by name (CONSUMES 2 CREDITS)"""
    # Step 1: Search for company
    search_body = {
        'q_organization_name': args.name,
        'per_page': 5
    }

    if args.location:
        # Check if global company
        normalized = args.name.lower().strip()
        is_global = any(gc in normalized or normalized in gc for gc in GLOBAL_COMPANIES)
        if is_global:
            print(f"Warning: '{args.name}' is a global company, location_hint may cause issues", file=sys.stderr)
        search_body['organization_locations'] = [args.location]

    search_result = apollo_request("/mixed_companies/search", "POST", search_body)

    organizations = search_result.get('organizations', [])
    if not organizations:
        return {"error": f"No company found matching '{args.name}'", "found": False}

    # Step 2: Get best match
    best_match = organizations[0]
    domain = best_match.get('primary_domain')

    if not domain:
        return {
            "error": f"Company '{best_match.get('name')}' found but no domain available",
            "found": True,
            "company_name": best_match.get('name')
        }

    # Step 3: Enrich
    enrich_result = apollo_request(f"/organizations/enrich?domain={domain}", "GET")

    return {
        "search_match": best_match.get('name'),
        "search_domain": domain,
        "enrichment": enrich_result
    }

def bulk_enrich(args):
    """Bulk enrich companies (CONSUMES 2 CREDITS PER COMPANY)"""
    results = []

    for name in args.names:
        try:
            # Create a mock args object
            class MockArgs:
                pass
            mock_args = MockArgs()
            mock_args.name = name
            mock_args.location = args.location

            result = enrich_company_by_name(mock_args)
            results.append({
                "company_name": name,
                "status": "success",
                "data": result
            })
        except Exception as e:
            results.append({
                "company_name": name,
                "status": "error",
                "error": str(e)
            })

    return {
        "total": len(args.names),
        "successful": len([r for r in results if r["status"] == "success"]),
        "failed": len([r for r in results if r["status"] == "error"]),
        "results": results
    }

def export_csv(args):
    """Export data to CSV format"""
    data = json.loads(args.data)

    if not data:
        return ""

    output = StringIO()

    # Determine columns
    if args.columns:
        columns = args.columns
    else:
        columns = list(data[0].keys()) if data else []

    writer = csv.DictWriter(output, fieldnames=columns, extrasaction='ignore')
    writer.writeheader()

    for row in data:
        # Flatten nested objects
        flat_row = {}
        for col in columns:
            val = row.get(col)
            if isinstance(val, (dict, list)):
                flat_row[col] = json.dumps(val)
            else:
                flat_row[col] = val
        writer.writerow(flat_row)

    return output.getvalue()

def main():
    parser = argparse.ArgumentParser(description='Apollo.io API Client')
    subparsers = parser.add_subparsers(dest='command', help='Commands')

    # search-people
    sp = subparsers.add_parser('search-people', help='Search for people (FREE)')
    sp.add_argument('--titles', nargs='+', help='Job titles (e.g., CEO CTO)')
    sp.add_argument('--seniorities', nargs='+', help='Seniority levels')
    sp.add_argument('--locations', nargs='+', help='Person locations')
    sp.add_argument('--org-locations', nargs='+', help='Company locations')
    sp.add_argument('--employees', nargs='+', help='Employee ranges (e.g., "11,50" "51,200")')
    sp.add_argument('--domains', nargs='+', help='Company domains')
    sp.add_argument('--keywords', help='Keywords')
    sp.add_argument('--technologies', nargs='+', help='Technologies')
    sp.add_argument('--page', type=int, default=1, help='Page number')
    sp.add_argument('--per-page', type=int, default=25, help='Results per page')

    # search-companies
    sc = subparsers.add_parser('search-companies', help='Search companies (CREDITS)')
    sc.add_argument('--name', help='Company name')
    sc.add_argument('--locations', nargs='+', help='HQ locations')
    sc.add_argument('--employees', nargs='+', help='Employee ranges')
    sc.add_argument('--technologies', nargs='+', help='Technologies')
    sc.add_argument('--keywords', nargs='+', help='Industry keywords')
    sc.add_argument('--page', type=int, default=1, help='Page number')
    sc.add_argument('--per-page', type=int, default=25, help='Results per page')

    # enrich-person
    ep = subparsers.add_parser('enrich-person', help='Enrich person (CREDITS)')
    ep.add_argument('--email', help='Person email')
    ep.add_argument('--first-name', help='First name')
    ep.add_argument('--last-name', help='Last name')
    ep.add_argument('--name', help='Full name')
    ep.add_argument('--domain', help='Company domain')
    ep.add_argument('--company', help='Company name')
    ep.add_argument('--linkedin', help='LinkedIn URL')
    ep.add_argument('--id', help='Apollo person ID')

    # enrich-company
    ec = subparsers.add_parser('enrich-company', help='Enrich company by domain (CREDITS)')
    ec.add_argument('domain', help='Company domain (e.g., apollo.io)')

    # enrich-company-by-name
    ecn = subparsers.add_parser('enrich-company-by-name', help='Enrich company by name (2 CREDITS)')
    ecn.add_argument('name', help='Company name')
    ecn.add_argument('--location', help='Location hint')

    # bulk-enrich
    be = subparsers.add_parser('bulk-enrich', help='Bulk enrich companies (2 CREDITS each)')
    be.add_argument('names', nargs='+', help='Company names')
    be.add_argument('--location', help='Location hint for all')

    # export
    ex = subparsers.add_parser('export', help='Export to CSV')
    ex.add_argument('data', help='JSON data to export')
    ex.add_argument('--columns', nargs='+', help='Columns to include')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # Execute command
    result = None

    if args.command == 'search-people':
        result = search_people(args)
    elif args.command == 'search-companies':
        result = search_companies(args)
    elif args.command == 'enrich-person':
        result = enrich_person(args)
    elif args.command == 'enrich-company':
        result = enrich_company(args)
    elif args.command == 'enrich-company-by-name':
        result = enrich_company_by_name(args)
    elif args.command == 'bulk-enrich':
        result = bulk_enrich(args)
    elif args.command == 'export':
        result = export_csv(args)

    # Output result
    if isinstance(result, str):
        print(result)
    else:
        print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
