import type { OpenAPIV3 } from 'openapi-types';
import type { AppConfig } from './types.js';

let cachedSpec: OpenAPIV3.Document | null = null;

export async function fetchSpec(config: AppConfig): Promise<OpenAPIV3.Document> {
  if (cachedSpec) return cachedSpec;

  let data: any;

  if (config.apifoxBody) {
    // Apifox mode: POST with body
    const res = await fetch(config.docsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.apifoxBody),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenAPI spec from ${config.docsUrl}: HTTP ${res.status}`);
    }
    const json = await res.json();
    // Apifox wraps data in a response envelope
    data = json.data ?? json;
  } else {
    // Standard mode: GET
    const res = await fetch(config.docsUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch OpenAPI spec from ${config.docsUrl}: HTTP ${res.status}`);
    }
    data = await res.json();
  }

  // Basic validation
  if (!data.openapi || !data.openapi.startsWith('3.0')) {
    throw new Error(`Unsupported OpenAPI version: ${data.openapi ?? 'unknown'}. Only OpenAPI 3.0 is supported.`);
  }
  if (!data.paths) {
    throw new Error('OpenAPI spec has no paths defined');
  }

  cachedSpec = data as OpenAPIV3.Document;
  return cachedSpec;
}
