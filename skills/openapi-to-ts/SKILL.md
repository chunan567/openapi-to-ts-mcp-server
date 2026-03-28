---
name: openapi-to-ts
description: Use when user asks to generate API code, TypeScript interfaces, or API client files from an OpenAPI spec — especially by module name, tag name, or specific endpoint path. Triggers on phrases like "生成XX模块的API代码", "帮我生成接口", "generate API code for", "生成TS接口".
---

# openapi-to-ts: Generate API Client Code

## Core Rule

**Call `generate_api_code` immediately.** Do NOT ask where the OpenAPI spec is — the spec URL is pre-configured via environment variables on the MCP server.

## Multi-Service Setup

When multiple MCP server instances are configured (e.g. `payment-api`, `order-api`, `warehouse-api`), each tool description starts with a `[ServiceName]` label. **Match the user's intent to the correct MCP server** by reading the service label in the tool description. For example, if the user says "生成支付模块的接口", use the tool whose description contains `[支付系统(Payment)]`.

## When to Use

- User mentions a module/tag name and wants API code generated
- User asks to generate TypeScript or JavaScript API interfaces
- User references specific endpoints and wants client code

## Tool: `generate_api_code`

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `tags` | `string[]` | one of these | Module/tag names, e.g. `["个人中心", "订单管理"]` |
| `interfaces` | `string[]` | one of these | Specific endpoints: `"method_url"` format, e.g. `"get_/users/list"` |
| `language` | `"ts"\|"js"\|"all"` | No | Default `"all"` |

> `tags` and `interfaces` can be combined. At least one must be provided.

## Quick Reference

```
User: 帮我生成「货品入库」模块的 ts API 代码
→ generate_api_code({ tags: ["货品入库"], language: "ts" })

User: 生成「订单管理」和「用户中心」的接口代码
→ generate_api_code({ tags: ["订单管理", "用户中心"] })

User: 生成 POST /api/login 和 GET /api/user/info 的代码
→ generate_api_code({ interfaces: ["post_/api/login", "get_/api/user/info"] })

User: 生成「权限管理」模块，加上 DELETE /api/cache/clear
→ generate_api_code({ tags: ["权限管理"], interfaces: ["delete_/api/cache/clear"] })
```

## Output

The tool returns JSON with:
- `tagNameMap` — Maps source names to resolved English filenames, e.g. `{"货品入库": "goodsInbound"}`
- `ts` — TypeScript code (imports from `.types` file)
- `dts` — Type definitions (`.d.ts` content)
- `js` — Plain JavaScript

Use `tagNameMap` values as filenames. Write `ts` to `{tagName}.ts` and `dts` to `{tagName}.types.ts`.

## Scenario 1: Generate New Files

1. Call `generate_api_code` with the user's tags/interfaces
2. **MCP output is the sole authority** — NEVER write, supplement, or fabricate any interface code yourself
3. If the user mentions an interface that is missing from the result (or appears in warnings), tell them it does not exist in the OpenAPI spec. Do NOT create it manually
4. Use `tagNameMap` values for filenames

## Scenario 2: Update Existing Files

When the user asks to update/refresh an existing API file:

1. Read the **file header comment** to extract metadata:
   ```
   /**
    * openapi-to-ts 自动生成
    * time: 2026-03-25 14:30:00
    * tags: ["货品入库"]
    * interfaces: ["post_/api/goods/inbound"]
    */
   ```
2. Re-call `generate_api_code` with the extracted `tags` and/or `interfaces`
3. **Overwrite the entire file** (both `.ts` and `.types.ts`) with the new MCP output — do not merge or partially update

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Asking user for OpenAPI URL/spec | Don't — spec is pre-configured, call tool directly |
| Asking user to confirm tag names first | Call with the tag name as given; tool returns warnings if not found |
| Not writing files after generation | Always write the generated code to the `api/` directory (or wherever user specifies) |
| Writing interface code yourself to fill gaps | Never — if MCP says it doesn't exist, tell the user |
| Partially updating a file on refresh | Always overwrite the entire file with fresh MCP output |
