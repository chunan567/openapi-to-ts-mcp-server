import type { AppConfig } from './types.js';

export function loadConfig(): AppConfig {
  const docsUrl = process.env.OPENAPI_DOCS_URL;
  if (!docsUrl) {
    throw new Error('OPENAPI_DOCS_URL environment variable is required');
  }

  const importCode = process.env.OPENAPI_IMPORT_CODE;
  if (!importCode) {
    throw new Error('OPENAPI_IMPORT_CODE environment variable is required');
  }

  let apifoxBody: Record<string, any> | undefined;
  if (process.env.OPENAPI_APIFOX_BODY) {
    try {
      apifoxBody = JSON.parse(process.env.OPENAPI_APIFOX_BODY);
    } catch {
      throw new Error('OPENAPI_APIFOX_BODY is not valid JSON');
    }
  }

  return {
    docsUrl,
    importCode,
    extendType: process.env.OPENAPI_EXTEND_TYPE,
    apifoxBody,
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    serviceName: process.env.OPENAPI_SERVICE_NAME,
  };
}
