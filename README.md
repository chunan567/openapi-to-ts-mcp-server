# openapi-to-ts-mcp-server

[中文文档](README.zh-CN.md)

An **MCP (Model Context Protocol) server** that generates TypeScript/JavaScript API client code from OpenAPI 3.0 specs.

Configure once, then simply tell Claude _"generate the API code for the Order module"_ — no manual copying from docs or hand-writing type definitions.

---

## Features

- Generate code by **tag groups** or **specific endpoints**
- Outputs `.ts` (with type imports), `.d.ts` (type definitions), and `.js` (plain JS)
- Auto-translates non-English tag names into English camelCase filenames
- Automatic function name conflict resolution (AI-powered or method-prefix fallback)
- **Multi-service (microservice)** support — each instance points to a different OpenAPI doc
- Supports Apifox private docs (POST authentication mode)

---

## Installation

```bash
npm install openapi-to-ts-mcp-server
```

> Requires Node.js >= 18

---

## Quick Start

Add MCP configuration to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "openapi-to-ts": {
      "command": "npx",
      "args": ["openapi-to-ts-mcp-server"],
      "env": {
        "OPENAPI_DOCS_URL": "https://your-api-host/openapi.json",
        "OPENAPI_IMPORT_CODE": "import request from '@/utils/request'"
      }
    }
  }
}
```

Then in Claude Code:

```
Generate the TypeScript API code for the "Order Management" module
```

---

## Multi-Service (Microservice) Setup

When your backend has multiple microservices, configure multiple instances with `OPENAPI_SERVICE_NAME`:

```json
{
  "mcpServers": {
    "payment-api": {
      "command": "npx",
      "args": ["openapi-to-ts-mcp-server"],
      "env": {
        "OPENAPI_DOCS_URL": "https://payment.example.com/openapi.json",
        "OPENAPI_IMPORT_CODE": "import request from '@/utils/request'",
        "OPENAPI_SERVICE_NAME": "Payment System"
      }
    },
    "order-api": {
      "command": "npx",
      "args": ["openapi-to-ts-mcp-server"],
      "env": {
        "OPENAPI_DOCS_URL": "https://order.example.com/openapi.json",
        "OPENAPI_IMPORT_CODE": "import request from '@/utils/request'",
        "OPENAPI_SERVICE_NAME": "Order System"
      }
    }
  }
}
```

Claude automatically matches the correct MCP instance based on the `[ServiceName]` label in the tool description.

### Configuration Location

| Location | File | Scope |
|----------|------|-------|
| Project-level (recommended) | `.claude/settings.json` | Current project only |
| Global | `~/.claude/settings.json` | All projects |

After setup, run `/mcp` in Claude Code to check the status of connected MCP servers.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAPI_DOCS_URL` | Yes | OpenAPI spec URL |
| `OPENAPI_IMPORT_CODE` | Yes | Import statement for generated files, e.g. `import request from '@/utils/request'` |
| `OPENAPI_SERVICE_NAME` | No | Service label for tool description. Required for multi-service setups |
| `OPENAPI_EXTEND_TYPE` | No | Type name for the options parameter extension |
| `OPENAPI_APIFOX_BODY` | No | Apifox POST auth body (JSON string) |
| `DEEPSEEK_API_KEY` | No | Enables AI-powered conflict resolution and non-English tag translation |
| `DEEPSEEK_BASE_URL` | No | DeepSeek API endpoint (default: `https://api.deepseek.com`) |

### Apifox Private Docs

If your docs require authentication (Apifox team projects), configure `OPENAPI_APIFOX_BODY`:

```json
{
  "mcpServers": {
    "openapi-to-ts": {
      "command": "npx",
      "args": ["openapi-to-ts-mcp-server"],
      "env": {
        "OPENAPI_DOCS_URL": "https://api.apifox.com/api/v1/projects/123456/export-openapi",
        "OPENAPI_IMPORT_CODE": "import request from '@/utils/request'",
        "OPENAPI_APIFOX_BODY": "{\"version\":\"3.0\",\"apiDetailRequested\":true}"
      }
    }
  }
}
```

---

## Tool: `generate_api_code`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tags` | `string[]` | Conditional | OpenAPI tag names, e.g. `["OrderManagement", "UserCenter"]` |
| `interfaces` | `string[]` | Conditional | Specific endpoints: `"method_url"` format, e.g. `["get_/users/list"]` |
| `language` | `"ts" \| "js" \| "all"` | No | Output language (default: `"all"`) |
| `description` | `string` | No | Semantic description for file naming |

> At least one of `tags` or `interfaces` must be provided. They can be combined.

### Response Structure

```json
{
  "tagNameMap": { "货品入库": "goodsInbound" },
  "ts": "// TypeScript code (with type imports)\nexport const getUserListApi...",
  "dts": "// Type definition file\nexport interface UserListParams...",
  "js": "// Plain JavaScript code\nexport const getUserListApi..."
}
```

- `tagNameMap` — maps source tag names to English camelCase filenames
- When `language: "ts"`, only `ts` + `dts` are returned; when `language: "js"`, only `js`

---

## Usage Scenarios

### Scenario 1: Generate New Files

> Generate the API code for the "Goods Inbound" module

Claude calls the tool and writes `ts` to `goodsInbound.ts`, `dts` to `goodsInbound.types.ts`.

**Important:** The generated code is based on the MCP response. If an endpoint is not in the result, it doesn't exist in the OpenAPI spec — no manual additions will be made.

### Scenario 2: Update Existing Files

> Update the API code in goodsInbound.ts

Claude reads the `tags`/`interfaces` metadata from the file's header comment, re-calls the MCP tool, and overwrites the file with the latest result.

Generated files include metadata in the header:

```typescript
/**
 * Auto-generated by openapi-to-ts
 * time: 2026-03-25 14:30:00
 * tags: ["货品入库"]
 */
```

---

## Examples

### Generate by Module

> Generate the API code for the "User Center" module

```json
{ "tags": ["UserCenter"] }
```

### Generate Multiple Modules

> Generate the API code for "Order Management" and "Product List", TypeScript only

```json
{ "tags": ["OrderManagement", "ProductList"], "language": "ts" }
```

### Generate Specific Endpoints

> Generate code for POST /api/login and GET /api/user/info

```json
{ "interfaces": ["post_/api/login", "get_/api/user/info"] }
```

### Combine Tags and Interfaces

> Generate the "Permission" module, plus DELETE /api/cache/clear

```json
{ "tags": ["Permission"], "interfaces": ["delete_/api/cache/clear"] }
```

### Multi-Service Scenario

> Generate the "Refund Management" APIs from the Payment service

Claude automatically matches the MCP instance with `OPENAPI_SERVICE_NAME` set to `Payment System`.

---

## FAQ

**Q: Getting `No matching interfaces found`**

Check that the `tags` names exactly match the tags in your OpenAPI spec (case-sensitive).

**Q: Function name conflict warning**

Configure `DEEPSEEK_API_KEY` to enable AI-powered distinct naming. Without it, the fallback adds an HTTP method prefix (e.g., `getUsers` / `postUsers`).

**Q: Claude picks the wrong tool in multi-service setup**

Ensure each instance has `OPENAPI_SERVICE_NAME` configured with a distinctive name.

**Q: MCP server connection fails**

1. Verify `npx openapi-to-ts-mcp-server` runs successfully
2. Run `/mcp` in Claude Code to check error details

---

## Development

```bash
# Install dependencies
npm install

# Build (outputs to dist/)
npm run build

# Watch mode
npm run dev

# Run the server
npm start
```

---

## Publishing

```bash
# Build + publish (prepublishOnly runs tsc automatically)
npm publish
```

The `files` field is configured to only include `dist/` and `bin.js` — source code is not published.

---

## Project Structure

```
src/
├── index.ts              # MCP server entry, tool definition
├── config.ts             # Environment variable parsing
├── fetch-spec.ts         # Fetch & cache OpenAPI spec
├── filter.ts             # Filter paths by tags/interfaces
├── alias-resolver.ts     # Function name conflict resolution
├── tag-name-resolver.ts  # Non-English tag name translation
├── types.ts              # Shared type definitions
└── gen/
    ├── gen-code.ts        # Code generation orchestrator
    ├── core.ts            # Schema -> TypeScript type converter
    ├── request-type-tools.ts  # Request/response type extraction
    └── tools.ts           # Utility functions
bin.js                    # CLI entry point
```

---

## License

MIT
