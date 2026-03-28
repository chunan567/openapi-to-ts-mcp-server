import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { fetchSpec } from './fetch-spec.js';
import { filterInterfaces } from './filter.js';
import { genCode } from './gen/gen-code.js';
import { resolveAliases } from './alias-resolver.js';
import { resolveTagName } from './tag-name-resolver.js';
import type { GenerateResult } from './types.js';

const config = loadConfig();

const server = new McpServer({
  name: 'openapi-to-ts',
  version: '0.1.0',
});

const toolDescription = config.serviceName
  ? `[${config.serviceName}] Generate TypeScript/JavaScript API client code from OpenAPI spec. Specify tags (group names) and/or specific interfaces (format: method_url, e.g. "get_/users/list"). Returns generated code as structured text.`
  : 'Generate TypeScript/JavaScript API client code from OpenAPI spec. Specify tags (group names) and/or specific interfaces (format: method_url, e.g. "get_/users/list"). Returns generated code as structured text.';

server.tool(
  'generate_api_code',
  toolDescription,
  {
    tags: z.array(z.string()).optional().describe('OpenAPI tag names to generate code for, e.g. ["个人中心", "订单管理"]'),
    interfaces: z.array(z.string()).optional().describe('Specific interfaces in method_url format, e.g. ["get_/users/list", "post_/login"]'),
    language: z.enum(['ts', 'js', 'all']).default('all').describe('Output language: ts (with types), js (plain), or all'),
    description: z.string().optional().describe('User semantic description for file naming and header comment, e.g. "用户管理系统". Takes priority over tags for naming.'),
  },
  async ({ tags, interfaces, language, description }) => {
    // Validate: at least one of tags/interfaces required
    if ((!tags || tags.length === 0) && (!interfaces || interfaces.length === 0)) {
      return {
        content: [{ type: 'text' as const, text: 'Error: 至少指定 tags 或 interfaces' }],
        isError: true,
      };
    }

    try {
      // 1. Fetch spec
      const spec = await fetchSpec(config);

      // 2. Filter interfaces
      const { paths, warnings } = filterInterfaces({ spec, tags, interfaces });

      if (paths.length === 0) {
        const msg = warnings.length > 0
          ? `No matching interfaces found.\n${warnings.join('\n')}`
          : 'No matching interfaces found.';
        return { content: [{ type: 'text' as const, text: msg }] };
      }

      // 3. First pass: generate code to detect naming conflicts
      const firstPass = genCode({ spec, paths, importCode: config.importCode, extendType: config.extendType });

      // 4. Resolve aliases if needed
      let aliases: Record<string, string> | undefined;
      if (firstPass.genMetadataList.length > 0) {
        aliases = await resolveAliases(
          firstPass.genMetadataList,
          config.deepseekApiKey,
          config.deepseekBaseUrl,
        );
      }

      // 5. If aliases were generated, re-run code generation with them
      let finalResult = firstPass;
      if (aliases && Object.keys(aliases).length > 0) {
        finalResult = genCode({ spec, paths, importCode: config.importCode, extendType: config.extendType, aliases });
      }

      // 6. Resolve filename: description > tags > 'api'
      const rawSource = description ?? tags?.[0] ?? 'api';
      const tagName = await resolveTagName(rawSource, paths, config.deepseekApiKey, config.deepseekBaseUrl);

      // 7. Generate file header comment
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const headerLines = ['/**', ' * openapi-to-ts 自动生成', ` * time: ${timestamp}`];
      if (description) {
        headerLines.push(` * source: ${description}`);
        if (tags?.length) headerLines.push(` * tags: ${JSON.stringify(tags)}`);
      } else if (tags?.length) {
        headerLines.push(` * tags: ${JSON.stringify(tags)}`);
      }
      if (interfaces?.length) {
        headerLines.push(` * interfaces: ${JSON.stringify(interfaces)}`);
      }
      headerLines.push(' */');
      const headerComment = headerLines.join('\n');

      const tsHeader = `${headerComment}\n\n${config.importCode}\nimport type * as Types from './${tagName}.types';\n\n`;
      const jsHeader = `${headerComment}\n\n${config.importCode}\n\n`;

      const result: GenerateResult = { tagNameMap: { [rawSource]: tagName } };
      if (language === 'ts' || language === 'all') {
        result.ts = tsHeader + finalResult.tsCode;
        result.dts = finalResult.typeCode;
      }
      if (language === 'js' || language === 'all') {
        result.js = jsHeader + finalResult.jsCode;
      }

      // Build response text
      let responseText = '';
      if (warnings.length > 0) {
        responseText += `Warnings:\n${warnings.join('\n')}\n\n`;
      }
      responseText += JSON.stringify(result, null, 2);

      return { content: [{ type: 'text' as const, text: responseText }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
