# openapi-to-ts-mcp-server 使用文档

基于 OpenAPI 3.0 规范自动生成 TypeScript/JavaScript API 客户端代码的 MCP Server。

---

## 安装

```bash
# 从私有 npm 安装
npm install openapi-to-ts-mcp-server

# 或本地开发
npm install
npm run build
```

---

## 在 Claude Code 中配置

### 单服务配置

在项目根目录 `.claude/settings.json` 中添加：

```json
{
  "mcpServers": {
    "openapi-to-ts": {
      "command": "npx",
      "args": ["openapi-to-ts-mcp-server"],
      "env": {
        "OPENAPI_DOCS_URL": "https://your-api-host/openapi.json",
        "OPENAPI_IMPORT_CODE": "import request from '@/utils/request'",
        "OPENAPI_EXTEND_TYPE": "RequestOptions",
        "DEEPSEEK_API_KEY": "sk-xxxx"
      }
    }
  }
}
```

### 多服务（微服务）配置

当后端有多个微服务时，配置多个 MCP 实例，通过 `OPENAPI_SERVICE_NAME` 区分：

```json
{
  "mcpServers": {
    "payment-api": {
      "command": "npx",
      "args": ["openapi-to-ts-mcp-server"],
      "env": {
        "OPENAPI_DOCS_URL": "https://payment.example.com/openapi.json",
        "OPENAPI_IMPORT_CODE": "import request from '@/utils/request'",
        "OPENAPI_SERVICE_NAME": "支付系统(Payment)"
      }
    },
    "order-api": {
      "command": "npx",
      "args": ["openapi-to-ts-mcp-server"],
      "env": {
        "OPENAPI_DOCS_URL": "https://order.example.com/openapi.json",
        "OPENAPI_IMPORT_CODE": "import request from '@/utils/request'",
        "OPENAPI_SERVICE_NAME": "订单管理系统(Order)"
      }
    },
    "warehouse-api": {
      "command": "npx",
      "args": ["openapi-to-ts-mcp-server"],
      "env": {
        "OPENAPI_DOCS_URL": "https://warehouse.example.com/openapi.json",
        "OPENAPI_IMPORT_CODE": "import request from '@/utils/request'",
        "OPENAPI_SERVICE_NAME": "仓库管理系统(Warehouse)"
      }
    }
  }
}
```

配置 `OPENAPI_SERVICE_NAME` 后，工具描述会显示为 `[支付系统(Payment)] Generate TypeScript/JavaScript API client code...`，Claude 会根据用户意图自动匹配正确的服务。

### 配置位置

| 位置 | 文件 | 作用范围 |
|------|------|----------|
| 项目级（推荐） | `.claude/settings.json` | 仅当前项目 |
| 全局 | `~/.claude/settings.json` | 所有项目 |

配置完成后，在 Claude Code 中运行 `/mcp` 可查看已连接的 MCP 服务器状态。

---

## 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `OPENAPI_DOCS_URL` | ✅ | OpenAPI 文档地址（HTTP GET 或 Apifox POST） |
| `OPENAPI_IMPORT_CODE` | ✅ | 生成文件的 import 头，如 `import request from '@/utils/request'` |
| `OPENAPI_SERVICE_NAME` | ❌ | 服务名标签，显示在工具描述中，如 `支付系统(Payment)`。多服务场景必填 |
| `OPENAPI_EXTEND_TYPE` | ❌ | 请求函数 options 参数的扩展类型名，如 `RequestOptions` |
| `OPENAPI_APIFOX_BODY` | ❌ | Apifox 格式的 POST body（JSON 字符串），用于需要鉴权的私有文档 |
| `DEEPSEEK_API_KEY` | ❌ | DeepSeek API Key，用于 AI 辅助解决函数名冲突和中文 tag 翻译 |
| `DEEPSEEK_BASE_URL` | ❌ | DeepSeek 接口地址，默认 `https://api.deepseek.com` |

### Apifox 私有文档示例

如果文档需要登录才能访问（Apifox 团队项目），配置 `OPENAPI_APIFOX_BODY`：

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

## 工具参数

工具名：`generate_api_code`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tags` | `string[]` | 条件必填 | OpenAPI tag 名称列表（按模块分组） |
| `interfaces` | `string[]` | 条件必填 | 指定接口列表，格式：`"method_url"`，如 `"get_/users/list"` |
| `language` | `"ts" \| "js" \| "all"` | ❌ | 输出语言，默认 `"all"` |
| `description` | `string` | ❌ | 语义描述，用于文件命名和头部注释，如 `"用户管理系统"` |

> `tags` 和 `interfaces` 至少填写一个，可以同时使用。

### 返回结构

```json
{
  "tagNameMap": { "货品入库": "goodsInbound" },
  "ts": "// TypeScript 代码（含类型引用）\nexport const getUserListApi...",
  "dts": "// 类型定义文件内容\nexport interface UserListParams...",
  "js": "// 纯 JavaScript 代码\nexport const getUserListApi..."
}
```

- `tagNameMap` — 源名称到英文文件名的映射，用作文件名
- `language: "ts"` 时只返回 `ts` + `dts`，`language: "js"` 时只返回 `js`

---

## 使用场景

### 场景一：生成新文件

> 帮我生成「货品入库」模块的 API 代码

Claude 调用工具后，将 `ts` 写入 `goodsInbound.ts`，`dts` 写入 `goodsInbound.types.ts`。

**重要：** 生成的代码以 MCP 返回为准。如果某个接口不在返回结果中，说明 OpenAPI 文档里不存在该接口，不会手动补充。

### 场景二：更新已有文件

> 帮我更新 goodsInbound.ts 里的接口

Claude 会读取文件头部注释中的 `tags`/`interfaces` 元数据，重新调用 MCP 工具，用最新结果覆盖整个文件。

生成的文件头部包含元数据：

```typescript
/**
 * openapi-to-ts 自动生成
 * time: 2026-03-25 14:30:00
 * tags: ["货品入库"]
 */
```

---

## 用户提问示例

### 示例 1：按模块生成全部接口

> 帮我生成「个人中心」模块的 API 代码

```json
{ "tags": ["个人中心"] }
```

### 示例 2：生成多个模块

> 把「订单管理」和「商品列表」这两个模块的接口代码生成出来，只要 TypeScript 版本

```json
{ "tags": ["订单管理", "商品列表"], "language": "ts" }
```

### 示例 3：生成指定接口

> 帮我生成 POST /api/login 和 GET /api/user/info 这两个接口的代码

```json
{ "interfaces": ["post_/api/login", "get_/api/user/info"] }
```

### 示例 4：混合 tags 和 interfaces

> 生成「权限管理」模块的代码，另外加上 DELETE /api/cache/clear 这个接口

```json
{ "tags": ["权限管理"], "interfaces": ["delete_/api/cache/clear"] }
```

### 示例 5：多服务场景

> 帮我生成支付系统里「退款管理」模块的接口

Claude 会自动匹配 `OPENAPI_SERVICE_NAME` 为 `支付系统(Payment)` 的 MCP 实例并调用。

---

## 常见问题

**Q: 提示 `No matching interfaces found`**

检查 `tags` 名称是否与 OpenAPI 文档中的 tag 完全一致（包括中文、大小写）。

**Q: 出现函数名冲突警告**

配置 `DEEPSEEK_API_KEY` 后，工具会自动用 AI 生成区分性更好的函数名。不配置时使用 HTTP 方法前缀兜底（如 `getUsers` / `postUsers`）。

**Q: 多服务场景下 Claude 调错了工具**

确保每个实例都配置了 `OPENAPI_SERVICE_NAME`，名称要有辨识度，建议格式：`中文名(English)`。

**Q: 连接 MCP 服务失败**

1. 确认 `npx openapi-to-ts-mcp-server` 能正常运行
2. 在 Claude Code 中执行 `/mcp` 查看错误详情
