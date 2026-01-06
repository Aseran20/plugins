#!/usr/bin/env node

import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from plugin root
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const APOLLO_API_BASE = "https://api.apollo.io/api/v1";

// ============================================
// WARNING DETECTION HELPERS
// ============================================

// Detect accented characters that Apollo API doesn't handle well
function detectAccents(text: string): { hasAccents: boolean; normalized: string } {
  const accentMap: Record<string, string> = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ñ': 'n', 'ç': 'c',
    'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
    'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
    'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O',
    'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
    'Ý': 'Y', 'Ñ': 'N', 'Ç': 'C'
  };

  let normalized = text;
  let hasAccents = false;

  for (const [accent, replacement] of Object.entries(accentMap)) {
    if (text.includes(accent)) {
      hasAccents = true;
      normalized = normalized.split(accent).join(replacement);
    }
  }

  return { hasAccents, normalized };
}

// Well-known global companies that should NOT use location_hint
const GLOBAL_COMPANIES = [
  'openai', 'anthropic', 'google', 'microsoft', 'amazon', 'meta', 'facebook',
  'apple', 'netflix', 'tesla', 'nvidia', 'datadog', 'stripe', 'salesforce',
  'oracle', 'ibm', 'intel', 'amd', 'cisco', 'adobe', 'spotify', 'uber',
  'airbnb', 'twitter', 'linkedin', 'slack', 'zoom', 'dropbox', 'github',
  'gitlab', 'atlassian', 'shopify', 'twilio', 'snowflake', 'palantir',
  'mistral', 'cohere', 'hugging face', 'huggingface', 'stability ai'
];

function isGlobalCompany(name: string): boolean {
  const normalized = name.toLowerCase().trim();
  return GLOBAL_COMPANIES.some(gc => normalized.includes(gc) || gc.includes(normalized));
}

// Build warnings array based on detected issues
interface WarningResult {
  warnings: string[];
  suggestions: string[];
}

function buildWarnings(args: Record<string, unknown>, resultCount?: number): WarningResult {
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for accents in q_keywords
  if (args.q_keywords && typeof args.q_keywords === 'string') {
    const { hasAccents, normalized } = detectAccents(args.q_keywords);
    if (hasAccents) {
      warnings.push(`⚠️ ACCENTS DÉTECTÉS dans q_keywords: "${args.q_keywords}"`);
      suggestions.push(`Apollo ne gère pas les accents. Essayez sans accents: "${normalized}"`);
    }
  }

  // Check for location_hint with global companies
  if (args.company_name && args.location_hint) {
    const companyName = args.company_name as string;
    if (isGlobalCompany(companyName)) {
      warnings.push(`⚠️ LOCATION_HINT avec entreprise globale: "${companyName}"`);
      suggestions.push(`"${companyName}" est une entreprise globale. location_hint peut causer des faux positifs. Essayez sans location_hint.`);
    }
  }

  // Check for zero results with potential issues
  if (resultCount === 0) {
    if (args.q_keywords && typeof args.q_keywords === 'string') {
      const { hasAccents } = detectAccents(args.q_keywords);
      if (hasAccents) {
        warnings.push(`⚠️ 0 RÉSULTATS - Probablement dû aux accents dans la recherche`);
      }
    }
  }

  return { warnings, suggestions };
}

// Get API key from environment
function getApiKey(): string {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error("APOLLO_API_KEY environment variable is required");
  }
  return apiKey;
}

// Apollo API request helper
async function apolloRequest(
  endpoint: string,
  method: "GET" | "POST" = "POST",
  body?: Record<string, unknown>
): Promise<unknown> {
  const apiKey = getApiKey();
  const url = `${APOLLO_API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "x-api-key": apiKey,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method === "POST") {
    options.body = JSON.stringify(body);
  } else if (body && method === "GET") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    const queryString = params.toString();
    if (queryString) {
      const response = await fetch(`${url}?${queryString}`, options);
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Apollo API error (${response.status}): ${error}`);
      }
      return response.json();
    }
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Apollo API error (${response.status}): ${error}`);
  }
  return response.json();
}

// Tool definitions
const tools: Tool[] = [
  {
    name: "search_people",
    description: "Search for people/contacts in Apollo database. Returns prospects matching filters. Does NOT return emails/phones - use enrich_person for that. FREE - no credits consumed.",
    inputSchema: {
      type: "object",
      properties: {
        person_titles: {
          type: "array",
          items: { type: "string" },
          description: "Job titles to search (e.g., ['CEO', 'CTO', 'Sales Director'])"
        },
        person_seniorities: {
          type: "array",
          items: { type: "string" },
          description: "Seniority levels: owner, founder, c_suite, partner, vp, head, director, manager, senior, entry, intern"
        },
        person_locations: {
          type: "array",
          items: { type: "string" },
          description: "Person locations (e.g., ['France', 'Paris', 'California'])"
        },
        organization_locations: {
          type: "array",
          items: { type: "string" },
          description: "Company HQ locations (e.g., ['Germany', 'London'])"
        },
        organization_num_employees_ranges: {
          type: "array",
          items: { type: "string" },
          description: "Employee count ranges (e.g., ['1,10', '11,50', '51,200', '201,500', '501,1000', '1001,5000', '5001,10000'])"
        },
        q_organization_domains_list: {
          type: "array",
          items: { type: "string" },
          description: "Company domains to filter (e.g., ['apollo.io', 'microsoft.com'])"
        },
        q_keywords: {
          type: "string",
          description: "Keywords to filter results"
        },
        contact_email_status: {
          type: "array",
          items: { type: "string" },
          description: "Email status filter: verified, unverified, likely to engage, unavailable"
        },
        revenue_range_min: {
          type: "number",
          description: "Minimum company revenue (no currency symbols)"
        },
        revenue_range_max: {
          type: "number",
          description: "Maximum company revenue (no currency symbols)"
        },
        currently_using_any_of_technology_uids: {
          type: "array",
          items: { type: "string" },
          description: "Technologies used by company (e.g., ['salesforce', 'hubspot', 'google_analytics'])"
        },
        page: {
          type: "number",
          description: "Page number (default: 1)",
          default: 1
        },
        per_page: {
          type: "number",
          description: "Results per page (max 100, default: 25)",
          default: 25
        }
      }
    }
  },
  {
    name: "search_companies",
    description: "Search for companies/organizations in Apollo database. CONSUMES CREDITS.",
    inputSchema: {
      type: "object",
      properties: {
        q_organization_name: {
          type: "string",
          description: "Company name to search (partial match supported)"
        },
        organization_locations: {
          type: "array",
          items: { type: "string" },
          description: "HQ locations (e.g., ['France', 'United States'])"
        },
        organization_not_locations: {
          type: "array",
          items: { type: "string" },
          description: "Locations to exclude"
        },
        organization_num_employees_ranges: {
          type: "array",
          items: { type: "string" },
          description: "Employee ranges (e.g., ['1,10', '51,200'])"
        },
        revenue_range_min: {
          type: "number",
          description: "Minimum revenue"
        },
        revenue_range_max: {
          type: "number",
          description: "Maximum revenue"
        },
        latest_funding_amount_range_min: {
          type: "number",
          description: "Minimum latest funding amount"
        },
        latest_funding_amount_range_max: {
          type: "number",
          description: "Maximum latest funding amount"
        },
        total_funding_range_min: {
          type: "number",
          description: "Minimum total funding"
        },
        total_funding_range_max: {
          type: "number",
          description: "Maximum total funding"
        },
        currently_using_any_of_technology_uids: {
          type: "array",
          items: { type: "string" },
          description: "Technologies used (e.g., ['salesforce', 'stripe'])"
        },
        q_organization_keyword_tags: {
          type: "array",
          items: { type: "string" },
          description: "Industry keywords (e.g., ['fintech', 'saas'])"
        },
        page: {
          type: "number",
          default: 1
        },
        per_page: {
          type: "number",
          default: 25
        }
      }
    }
  },
  {
    name: "enrich_person",
    description: "Enrich a person's data to get email, phone, employment history, etc. CONSUMES CREDITS. Provide at least one identifier.",
    inputSchema: {
      type: "object",
      properties: {
        email: {
          type: "string",
          description: "Person's email address"
        },
        first_name: {
          type: "string",
          description: "First name (use with last_name and domain/organization_name)"
        },
        last_name: {
          type: "string",
          description: "Last name"
        },
        name: {
          type: "string",
          description: "Full name (alternative to first_name + last_name)"
        },
        domain: {
          type: "string",
          description: "Company domain (e.g., 'apollo.io')"
        },
        organization_name: {
          type: "string",
          description: "Company name"
        },
        linkedin_url: {
          type: "string",
          description: "LinkedIn profile URL"
        },
        id: {
          type: "string",
          description: "Apollo person ID (from search results)"
        },
        reveal_personal_emails: {
          type: "boolean",
          description: "Include personal emails (may consume extra credits)",
          default: false
        }
      }
    }
  },
  {
    name: "enrich_company",
    description: "Enrich company data by domain. Returns full company details: employees, revenue, funding, technologies, etc. CONSUMES CREDITS.",
    inputSchema: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          description: "Company domain (e.g., 'apollo.io', 'microsoft.com'). Required."
        }
      },
      required: ["domain"]
    }
  },
  {
    name: "enrich_company_by_name",
    description: "Find and enrich a company by name. Automatically searches for the company, finds best match, and enriches it. CONSUMES CREDITS (2 calls: search + enrich).",
    inputSchema: {
      type: "object",
      properties: {
        company_name: {
          type: "string",
          description: "Company name to search and enrich (e.g., 'Anthropic', 'OpenAI')"
        },
        location_hint: {
          type: "string",
          description: "Optional location hint to improve matching (e.g., 'San Francisco', 'France')"
        }
      },
      required: ["company_name"]
    }
  },
  {
    name: "bulk_enrich_companies",
    description: "Enrich multiple companies from a list of names. Returns enriched data for each company found. CONSUMES CREDITS (2 per company).",
    inputSchema: {
      type: "object",
      properties: {
        company_names: {
          type: "array",
          items: { type: "string" },
          description: "List of company names to enrich"
        },
        location_hint: {
          type: "string",
          description: "Optional location hint for all companies"
        }
      },
      required: ["company_names"]
    }
  },
  {
    name: "export_to_csv",
    description: "Format data as CSV string. Use this to export search or enrichment results.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { type: "object" },
          description: "Array of objects to convert to CSV"
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Optional: specific columns to include (default: all)"
        }
      },
      required: ["data"]
    }
  }
];

// Tool implementations
async function searchPeople(args: Record<string, unknown>): Promise<unknown> {
  const body: Record<string, unknown> = {};

  // Map arguments to Apollo API format
  if (args.person_titles) body.person_titles = args.person_titles;
  if (args.person_seniorities) body.person_seniorities = args.person_seniorities;
  if (args.person_locations) body.person_locations = args.person_locations;
  if (args.organization_locations) body.organization_locations = args.organization_locations;
  if (args.organization_num_employees_ranges) body.organization_num_employees_ranges = args.organization_num_employees_ranges;
  if (args.q_organization_domains_list) body.q_organization_domains_list = args.q_organization_domains_list;
  if (args.q_keywords) body.q_keywords = args.q_keywords;
  if (args.contact_email_status) body.contact_email_status = args.contact_email_status;
  if (args.currently_using_any_of_technology_uids) body.currently_using_any_of_technology_uids = args.currently_using_any_of_technology_uids;

  if (args.revenue_range_min || args.revenue_range_max) {
    body["revenue_range[min]"] = args.revenue_range_min;
    body["revenue_range[max]"] = args.revenue_range_max;
  }

  body.page = args.page || 1;
  body.per_page = Math.min(args.per_page as number || 25, 100);

  const result = await apolloRequest("/mixed_people/api_search", "POST", body) as {
    total_entries?: number;
    people?: unknown[];
  };

  // Check for warnings
  const resultCount = result.people?.length ?? result.total_entries ?? 0;
  const { warnings, suggestions } = buildWarnings(args, resultCount);

  // Add warnings to response if any detected
  if (warnings.length > 0) {
    return {
      _warnings: warnings,
      _suggestions: suggestions,
      total_entries: result.total_entries,
      people: result.people
    };
  }

  return result;
}

async function searchCompanies(args: Record<string, unknown>): Promise<unknown> {
  const body: Record<string, unknown> = {};

  if (args.q_organization_name) body.q_organization_name = args.q_organization_name;
  if (args.organization_locations) body.organization_locations = args.organization_locations;
  if (args.organization_not_locations) body.organization_not_locations = args.organization_not_locations;
  if (args.organization_num_employees_ranges) body.organization_num_employees_ranges = args.organization_num_employees_ranges;
  if (args.currently_using_any_of_technology_uids) body.currently_using_any_of_technology_uids = args.currently_using_any_of_technology_uids;
  if (args.q_organization_keyword_tags) body.q_organization_keyword_tags = args.q_organization_keyword_tags;

  if (args.revenue_range_min || args.revenue_range_max) {
    body["revenue_range[min]"] = args.revenue_range_min;
    body["revenue_range[max]"] = args.revenue_range_max;
  }
  if (args.latest_funding_amount_range_min || args.latest_funding_amount_range_max) {
    body["latest_funding_amount_range[min]"] = args.latest_funding_amount_range_min;
    body["latest_funding_amount_range[max]"] = args.latest_funding_amount_range_max;
  }
  if (args.total_funding_range_min || args.total_funding_range_max) {
    body["total_funding_range[min]"] = args.total_funding_range_min;
    body["total_funding_range[max]"] = args.total_funding_range_max;
  }

  body.page = args.page || 1;
  body.per_page = Math.min(args.per_page as number || 25, 100);

  return apolloRequest("/mixed_companies/search", "POST", body);
}

async function enrichPerson(args: Record<string, unknown>): Promise<unknown> {
  const body: Record<string, unknown> = {};

  if (args.email) body.email = args.email;
  if (args.first_name) body.first_name = args.first_name;
  if (args.last_name) body.last_name = args.last_name;
  if (args.name) body.name = args.name;
  if (args.domain) body.domain = args.domain;
  if (args.organization_name) body.organization_name = args.organization_name;
  if (args.linkedin_url) body.linkedin_url = args.linkedin_url;
  if (args.id) body.id = args.id;
  if (args.reveal_personal_emails) body.reveal_personal_emails = args.reveal_personal_emails;

  return apolloRequest("/people/match", "POST", body);
}

async function enrichCompany(args: Record<string, unknown>): Promise<unknown> {
  const domain = args.domain as string;
  return apolloRequest(`/organizations/enrich?domain=${encodeURIComponent(domain)}`, "GET");
}

async function enrichCompanyByName(args: Record<string, unknown>): Promise<unknown> {
  const companyName = args.company_name as string;
  const locationHint = args.location_hint as string | undefined;

  // Check for warnings BEFORE making the request
  const { warnings, suggestions } = buildWarnings(args);

  // Step 1: Search for the company
  const searchBody: Record<string, unknown> = {
    q_organization_name: companyName,
    per_page: 5
  };

  if (locationHint) {
    searchBody.organization_locations = [locationHint];
  }

  const searchResult = await apolloRequest("/mixed_companies/search", "POST", searchBody) as {
    organizations?: Array<{ primary_domain?: string; name?: string }>;
  };

  if (!searchResult.organizations || searchResult.organizations.length === 0) {
    const response: Record<string, unknown> = {
      error: `No company found matching "${companyName}"`,
      found: false
    };
    if (warnings.length > 0) {
      response._warnings = warnings;
      response._suggestions = suggestions;
    }
    return response;
  }

  // Step 2: Get the best match (first result)
  const bestMatch = searchResult.organizations[0];
  const domain = bestMatch.primary_domain;

  if (!domain) {
    const response: Record<string, unknown> = {
      error: `Company "${bestMatch.name}" found but no domain available`,
      found: true,
      company_name: bestMatch.name
    };
    if (warnings.length > 0) {
      response._warnings = warnings;
      response._suggestions = suggestions;
    }
    return response;
  }

  // Step 3: Enrich the company
  const enrichResult = await apolloRequest(`/organizations/enrich?domain=${encodeURIComponent(domain)}`, "GET");

  // Check if the match looks suspicious (name very different from search)
  const matchName = bestMatch.name?.toLowerCase() || '';
  const searchName = companyName.toLowerCase();
  const nameMismatch = !matchName.includes(searchName) && !searchName.includes(matchName);

  if (nameMismatch && locationHint) {
    warnings.push(`⚠️ MATCH POTENTIELLEMENT INCORRECT: Recherche "${companyName}" → Trouvé "${bestMatch.name}"`);
    suggestions.push(`Le résultat ne correspond pas exactement. Vérifiez si c'est la bonne entreprise ou réessayez sans location_hint.`);
  }

  const response: Record<string, unknown> = {
    search_match: bestMatch.name,
    search_domain: domain,
    enrichment: enrichResult
  };

  if (warnings.length > 0) {
    response._warnings = warnings;
    response._suggestions = suggestions;
  }

  return response;
}

async function bulkEnrichCompanies(args: Record<string, unknown>): Promise<unknown> {
  const companyNames = args.company_names as string[];
  const locationHint = args.location_hint as string | undefined;

  const results: Array<{
    company_name: string;
    status: string;
    data?: unknown;
    error?: string;
  }> = [];

  for (const name of companyNames) {
    try {
      const result = await enrichCompanyByName({
        company_name: name,
        location_hint: locationHint
      });
      results.push({
        company_name: name,
        status: "success",
        data: result
      });
    } catch (error) {
      results.push({
        company_name: name,
        status: "error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    total: companyNames.length,
    successful: results.filter(r => r.status === "success").length,
    failed: results.filter(r => r.status === "error").length,
    results
  };
}

function exportToCsv(args: Record<string, unknown>): string {
  const data = args.data as Record<string, unknown>[];
  const columns = args.columns as string[] | undefined;

  if (!data || data.length === 0) {
    return "";
  }

  // Determine columns
  const cols = columns || Object.keys(data[0]);

  // Helper to flatten nested objects
  function getValue(obj: Record<string, unknown>, key: string): string {
    const value = obj[key];
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  // Build CSV
  const header = cols.join(",");
  const rows = data.map(row =>
    cols.map(col => {
      const val = getValue(row, col);
      // Escape quotes and wrap in quotes if contains comma or quote
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(",")
  );

  return [header, ...rows].join("\n");
}

// Main server
const server = new Server(
  { name: "apollo-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "search_people":
        result = await searchPeople(args || {});
        break;
      case "search_companies":
        result = await searchCompanies(args || {});
        break;
      case "enrich_person":
        result = await enrichPerson(args || {});
        break;
      case "enrich_company":
        result = await enrichCompany(args || {});
        break;
      case "enrich_company_by_name":
        result = await enrichCompanyByName(args || {});
        break;
      case "bulk_enrich_companies":
        result = await bulkEnrichCompanies(args || {});
        break;
      case "export_to_csv":
        result = exportToCsv(args || {});
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Apollo MCP server running on stdio");
}

main().catch(console.error);
