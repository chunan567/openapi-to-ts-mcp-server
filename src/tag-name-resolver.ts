import OpenAI from 'openai';
import type { FilteredPath } from './types.js';
import { toCamelCase } from './gen/tools.js';

/**
 * Check if a string contains non-ASCII characters (Chinese, Japanese, etc.)
 */
function containsNonEnglish(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
}

/**
 * Translate a tag name or description to English camelCase for use as a filename.
 * - Already English: normalize to camelCase
 * - Non-English: translate via DeepSeek, fallback to URL-based derivation
 */
export async function resolveTagName(
  source: string,
  paths: FilteredPath[],
  deepseekApiKey?: string,
  deepseekBaseUrl?: string,
): Promise<string> {
  if (!containsNonEnglish(source)) {
    return toCamelCase(source);
  }

  // Try DeepSeek translation
  if (deepseekApiKey) {
    try {
      const urls = paths.map(p => p.url).slice(0, 5);
      return await resolveWithDeepSeek(source, urls, deepseekApiKey, deepseekBaseUrl);
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: derive from URL paths
  return fallbackResolve(source, paths);
}

async function resolveWithDeepSeek(
  tag: string,
  urls: string[],
  apiKey: string,
  baseUrl?: string,
): Promise<string> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl || 'https://api.deepseek.com',
  });

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `你是一个 API 命名专家。以下 OpenAPI tag 名称需要翻译为英文驼峰命名（camelCase），用于文件名。
请根据 tag 的含义和关联的 URL 路径，给出语义化的英文驼峰名称。

要求：
1. 名称应简短且语义化（1-3个英文单词）
2. 使用 camelCase（首字母小写）
3. 不要添加 Api、Service 等后缀

tag: "${tag}", 关联URL: ${urls.join(', ')}

请返回 JSON，key 为原始 tag 名称，value 为英文驼峰名称。
示例：{"个人中心": "userCenter", "订单管理": "orderManagement"}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty DeepSeek response');

  const parsed = JSON.parse(content) as Record<string, string>;
  const resolved = parsed[tag];
  if (!resolved) throw new Error('Tag not found in DeepSeek response');

  return resolved;
}

function fallbackResolve(source: string, paths: FilteredPath[]): string {
  // Try matching by tag first, fall back to all paths
  let tagPaths = paths.filter(p => p.tags?.[0] === source);
  if (tagPaths.length === 0) tagPaths = paths;

  if (tagPaths.length === 0) return 'api';

  // Extract meaningful URL segments, skip common prefixes and path params
  const segments = tagPaths.map(p => {
    const parts = p.url.replace(/^\/+/, '').split('/');
    const meaningful = parts.filter(
      s => !['api', 'v1', 'v2', 'v3'].includes(s.toLowerCase()) && !s.startsWith('{'),
    );
    return meaningful[0] ?? parts[0] ?? 'api';
  });

  // Pick the most frequent segment
  const freq = new Map<string, number>();
  for (const seg of segments) {
    freq.set(seg, (freq.get(seg) ?? 0) + 1);
  }

  let bestSegment = 'api';
  let bestCount = 0;
  for (const [seg, count] of freq) {
    if (count > bestCount) {
      bestSegment = seg;
      bestCount = count;
    }
  }

  return toCamelCase(bestSegment);
}
