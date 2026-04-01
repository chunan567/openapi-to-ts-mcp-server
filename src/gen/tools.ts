import type { OpenAPIV3 } from 'openapi-types';
import { get } from 'radash';
import type { FilteredPath } from '../types.js';

/**
 * Extract function name from URL path (last non-parameter segment)
 */
export const getFnName = (url: string): string => {
  const trimmedUrl = url.replace(/^\/+|\/+$/g, '');
  const segments = trimmedUrl.split('/');
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    if (!(segment.startsWith('{') && segment.endsWith('}'))) {
      return segment;
    }
  }
  return '';
};

/**
 * Filter special characters from model names
 */
function filterCharacters(charsToFilter: string[], inputString?: string): string {
  const filterSet = new Set(charsToFilter);
  let result = '';
  for (const char of (inputString ?? '')) {
    if (!filterSet.has(char)) {
      result += char;
    }
  }
  return result;
}

/**
 * Create a $ref resolver bound to a specific OpenAPI document
 */
export const createRefResolver = <T>(spec: OpenAPIV3.Document) => {
  const resolver = (ref?: string, _visited?: Set<string>): [schemaObject?: T, modelName?: string] => {
    if (!ref) return [];
    // 每次顶层调用创建新的 visited Set，递归链内共享
    const visited = _visited ?? new Set<string>();
    if (visited.has(ref)) return []; // 循环引用检测
    visited.add(ref);
    const path = ref.replace(/^#\//, '').replace(/\//g, '.');
    const result = get<Record<string, any>>(spec as any, path);
    if (!result) return [];
    if ('$ref' in result) {
      return resolver(result.$ref, visited);
    }
    const modelName = path.split('.').pop();
    const newModelName = filterCharacters(['«', '»'], modelName);
    return [result as T, newModelName];
  };
  return resolver;
};

/**
 * Remove trailing [] from type string
 */
export function removeTrailingBrackets(str: string): [string, is: boolean] {
  if (str.endsWith('[]')) {
    return [str.slice(0, -2), true];
  }
  return [str, false];
}

/**
 * Convert string to camelCase or PascalCase
 */
export function toCamelCase(str?: any, capitalizeFirst = false): string {
  if (!str) return '';
  const words = str.split(/[\s\-_]+/).filter((word: any) => word.length > 0);
  if (words.length === 0) return '';
  return words
    .map((word: any, index: number) => {
      if (index === 0 && !capitalizeFirst) {
        return word.charAt(0).replace(/[a-zA-Z]/, (c: string) => c.toLowerCase()) + word.slice(1);
      }
      return word.charAt(0).replace(/[a-zA-Z]/, (c: string) => c.toUpperCase()) + word.slice(1);
    })
    .join('');
}

/**
 * Convert OpenAPI parameters array to a Schema object
 */
export function convertParametersToSchema(parameters: OpenAPIV3.ParameterObject[]) {
  type SchemaObject = OpenAPIV3.ArraySchemaObject | OpenAPIV3.NonArraySchemaObject;
  const schema = {
    type: 'object',
    properties: {},
    required: [],
  } as SchemaObject;

  parameters.forEach((param) => {
    const property = { ...param.schema } as OpenAPIV3.SchemaObject;
    if (param.description) property.description = param.description;
    if (param.example !== undefined) property.example = param.example;
    schema.properties![param.name] = property;
    if (param.required) {
      schema.required!.push(param.name);
    }
  });

  if (schema.required!.length === 0) {
    delete schema.required;
  }
  return schema;
}

/**
 * Convert URL path template: {id} -> ${path.id}
 */
export function convertPathTemplate(template: string) {
  return template.replace(/\{([\w-]+)\}/g, (_, param) => `\${path.${param}}`);
}

/**
 * Generate unique key for an interface: method_url
 */
export const getUrlKey = (method: string, url: string): string => {
  return `${method}_${url}`;
};

/**
 * Flatten OpenAPI paths into individual operations
 */
export function pathsMap(
  paths: OpenAPIV3.PathsObject,
  callback: (pathObj: FilteredPath) => void,
): void {
  const httpMethods: string[] = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
  for (const url in paths) {
    if (!Object.prototype.hasOwnProperty.call(paths, url)) continue;
    const pathItem = paths[url];
    if (!pathItem) continue;
    for (const method of httpMethods) {
      if (Object.prototype.hasOwnProperty.call(pathItem, method)) {
        const operationObject = pathItem[method as keyof OpenAPIV3.PathItemObject] as OpenAPIV3.OperationObject;
        if (operationObject) {
          callback({ ...operationObject, url, method });
        }
      }
    }
  }
}
