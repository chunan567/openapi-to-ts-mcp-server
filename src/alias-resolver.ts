import OpenAI from 'openai';
import type { GenMetadata } from './types.js';
import { getUrlKey, toCamelCase } from './gen/tools.js';

/**
 * Detect duplicate fnNames and resolve them via DeepSeek or fallback
 */
export async function resolveAliases(
  metadataList: GenMetadata[],
  deepseekApiKey?: string,
  deepseekBaseUrl?: string,
): Promise<Record<string, string>> {
  // Count fnName occurrences
  const countMap: Record<string, GenMetadata[]> = {};
  for (const item of metadataList) {
    const key = item.fnName;
    if (!countMap[key]) countMap[key] = [];
    countMap[key].push(item);
  }

  // Filter to only duplicates
  const duplicates: GenMetadata[] = [];
  for (const [, items] of Object.entries(countMap)) {
    if (items.length > 1) {
      duplicates.push(...items);
    }
  }

  if (duplicates.length === 0) return {};

  // Try DeepSeek first
  if (deepseekApiKey) {
    try {
      return await resolveWithDeepSeek(duplicates, deepseekApiKey, deepseekBaseUrl);
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: method prefix
  return fallbackResolve(duplicates);
}

async function resolveWithDeepSeek(
  duplicates: GenMetadata[],
  apiKey: string,
  baseUrl?: string,
): Promise<Record<string, string>> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl || 'https://api.deepseek.com',
  });

  const conflictList = duplicates
    .map((item, i) => `${i + 1}. fnName: "${item.fnName}", method: "${item.method}", url: "${item.url}", summary: "${item.summary ?? ''}"`)
    .join('\n');

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `你是一个 API 函数命名专家。以下接口的函数名存在冲突，请根据每个接口的 URL、请求方式和描述，为冲突的函数生成唯一且语义化的驼峰命名。

冲突列表：
${conflictList}

请返回 JSON，key 为 "method_url" 格式（如 "get_/api/user"），value 为新的函数名（驼峰，不带 Api 后缀）：`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty DeepSeek response');

  return JSON.parse(content) as Record<string, string>;
}

function fallbackResolve(duplicates: GenMetadata[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of duplicates) {
    const key = getUrlKey(item.method, item.url);
    const capitalized = toCamelCase(item.fnName, true);
    result[key] = `${item.method}${capitalized}`;
  }
  return result;
}
