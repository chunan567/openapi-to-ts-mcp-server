# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build (TypeScript -> dist/)
npm run build

# Watch mode for development
npm run dev

# Run the compiled MCP server
npm start
```

No test or lint scripts are configured.

## Architecture

This is an **MCP (Model Context Protocol) server** that exposes a single tool `generate_api_code`. It fetches an OpenAPI 3.0 spec and generates TypeScript/JavaScript API client code.

### Pipeline

```
fetch OpenAPI spec (HTTP GET or POST)
  → filter paths by tags or specific "method_url" keys
  → generate code (first pass, detect naming conflicts)
  → resolve conflicts via DeepSeek AI or method-prefix fallback
  → re-generate with resolved aliases if needed
  → return { ts, dts, js }
```

### Key Files

| File | Role |
|------|------|
| `src/index.ts` | MCP server entry, tool schema (`generate_api_code`) |
| `src/config.ts` | All env var parsing |
| `src/fetch-spec.ts` | Fetches & caches OpenAPI spec; supports Apifox POST format |
| `src/filter.ts` | Filters paths by `tags[]` or `interfaces[]` (format: `"method_url"`) |
| `src/alias-resolver.ts` | Detects duplicate function names; calls DeepSeek or uses method-prefix fallback |
| `src/gen/gen-code.ts` | Orchestrates code generation for all matched paths |
| `src/gen/core.ts` | Recursive schema-to-TypeScript converter; handles allOf/anyOf/oneOf/enums/cycles |
| `src/gen/request-type-tools.ts` | Extracts types from request body, path params, query params, responses |
| `src/gen/tools.ts` | Shared utilities: `$ref` resolution, name extraction, path parsing |
| `bin.js` | Thin CLI shim → `dist/index.js` |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAPI_DOCS_URL` | Yes | URL to fetch OpenAPI spec |
| `OPENAPI_IMPORT_CODE` | Yes | Import prefix for generated files |
| `OPENAPI_EXTEND_TYPE` | No | Type name for extending request options |
| `OPENAPI_APIFOX_BODY` | No | JSON body for Apifox POST-based spec fetch |
| `DEEPSEEK_API_KEY` | No | Enables AI-based conflict resolution |
| `OPENAPI_SERVICE_NAME` | No | Service label shown in tool description, e.g. `支付系统(Payment)` |
| `DEEPSEEK_BASE_URL` | No | DeepSeek endpoint (default: `https://api.deepseek.com`) |

### Module System

- ES modules (`"type": "module"` in package.json)
- TypeScript target: ES2022, moduleResolution: Node16
- Output: `dist/` with `.d.ts` declarations

### Naming Conflict Resolution

When two API paths produce the same function name, `alias-resolver.ts` sends all conflicting names to DeepSeek with the original path context to get distinct aliases. If `DEEPSEEK_API_KEY` is not set or the call fails, a fallback adds the HTTP method as a prefix (e.g., `getUsers`, `postUsers`).
