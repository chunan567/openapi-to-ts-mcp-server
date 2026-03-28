# openapi-to-ts-mcp-server

[English](README.md)

基于 OpenAPI 3.0 规范，自动生成 TypeScript/JavaScript API 客户端代码的 **MCP Server**。

配置一次，在 Claude Code 中直接说「帮我生成 XX 模块的接口代码」即可，无需手动复制文档、手写类型定义。

---

## 特性

- 按 **tag 分组**或**指定接口**生成代码
- 同时输出 `.ts`（含类型引用）、`.d.ts`（类型定义）、`.js`（纯 JS）
- 中文 tag 名自动翻译为英文驼峰文件名
- 函数名冲突时自动解决（AI 或 method 前缀兜底）
- 支持 **多服务（微服务）** 配置，每个实例独立指向不同的 OpenAPI 文档
- 支持 Apifox 私有文档（POST 鉴权模式）

---

## 安装

```bash
npm install openapi-to-ts-mcp-server
```

> 需要 Node.js >= 18

---

## 快速上手

在项目 `.claude/settings.json` 中添加 MCP 配置：

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

然后在 Claude Code 中：

```
帮我生成「订单管理」模块的 TypeScript API 代码
```

---

## 多服务（微服务）配置

后端有多个微服务时，配置多个实例，通过 `OPENAPI_SERVICE_NAME` 区分：

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
    }
  }
}
```

Claude 会根据用户意图自动匹配 `[ServiceName]` 标签对应的 MCP 实例。

---

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `OPENAPI_DOCS_URL` | ✅ | OpenAPI 文档地址 |
| `OPENAPI_IMPORT_CODE` | ✅ | 生成文件的 import 头，如 `import request from '@/utils/request'` |
| `OPENAPI_SERVICE_NAME` | ❌ | 服务名标签，多服务场景必填，建议格式：`中文名(English)` |
| `OPENAPI_EXTEND_TYPE` | ❌ | 请求函数 options 参数的扩展类型名 |
| `OPENAPI_APIFOX_BODY` | ❌ | Apifox POST 鉴权 body（JSON 字符串） |
| `DEEPSEEK_API_KEY` | ❌ | 启用 AI 辅助：函数名冲突解决 + 中文 tag 翻译 |
| `DEEPSEEK_BASE_URL` | ❌ | DeepSeek 接口地址，默认 `https://api.deepseek.com` |

详细使用说明见 [docs/usage.md](docs/usage.md)。

---

## 工具参数：`generate_api_code`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tags` | `string[]` | 条件必填 | OpenAPI tag 名称列表，如 `["订单管理", "用户中心"]` |
| `interfaces` | `string[]` | 条件必填 | 指定接口，格式：`"method_url"`，如 `["get_/users/list"]` |
| `language` | `"ts" \| "js" \| "all"` | ❌ | 输出语言，默认 `"all"` |
| `description` | `string` | ❌ | 语义描述，用于文件命名 |

> `tags` 和 `interfaces` 至少填写一个，可以同时使用。

---

## 开发

```bash
# 安装依赖
npm install

# 编译（输出到 dist/）
npm run build

# 监听模式（开发时使用）
npm run dev

# 运行服务
npm start
```

---

## 发包

```bash
# 构建 + 发布（prepublishOnly 会自动执行 tsc）
npm publish
```

`files` 字段已配置为只打包 `dist/` 和 `bin.js`，源码不会包含在发布产物中。

---

## 目录结构

```
src/
├── index.ts              # MCP server 入口，工具定义
├── config.ts             # 环境变量解析
├── fetch-spec.ts         # 拉取并缓存 OpenAPI spec
├── filter.ts             # 按 tags/interfaces 过滤路径
├── alias-resolver.ts     # 函数名冲突解决
├── tag-name-resolver.ts  # 中文 tag 翻译为英文文件名
├── types.ts              # 公共类型定义
└── gen/
    ├── gen-code.ts        # 代码生成主流程
    ├── core.ts            # schema → TypeScript 类型转换
    ├── request-type-tools.ts  # 请求/响应类型提取
    └── tools.ts           # 工具函数
bin.js                    # CLI 入口
```

---

## License

MIT
