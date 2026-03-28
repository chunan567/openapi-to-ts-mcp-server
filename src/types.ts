import type { OpenAPIV3 } from 'openapi-types';

/** Application configuration parsed from environment variables */
export type AppConfig = {
  docsUrl: string;
  importCode: string;
  extendType?: string;
  apifoxBody?: Record<string, any>;
  deepseekApiKey?: string;
  deepseekBaseUrl: string;
  serviceName?: string;
};

/** A flattened OpenAPI operation with url and method attached */
export type FilteredPath = OpenAPIV3.OperationObject & {
  url: string;
  method: string;
};

/** Options for the main code generation function */
export type GenCodeOptions = {
  spec: OpenAPIV3.Document;
  paths: FilteredPath[];
  importCode: string;
  extendType?: string;
  aliases?: Record<string, string>;
};

/** Code generation metadata for a single API endpoint */
export type FnArgs = {
  name: string;
  type: string;
  required: boolean;
  insertStatement?: string;
  independent?: boolean;
};

export type GenMetadata = {
  fnName: string;
  url: string;
  method: string;
  summary?: string;
  requestDt?: string;
  responsesType?: string;
  fnArgs: FnArgs[];
};

/** Output of the generate_api_code tool */
export type GenerateResult = {
  ts?: string;
  dts?: string;
  js?: string;
  tagNameMap?: Record<string, string>;
};
