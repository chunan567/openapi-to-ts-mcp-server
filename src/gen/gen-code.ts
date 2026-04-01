import type { OpenAPIV3 } from 'openapi-types';
import type { GenCodeOptions, GenMetadata, FilteredPath } from '../types.js';
import { convertPathTemplate, createRefResolver, getFnName, getUrlKey, removeTrailingBrackets, toCamelCase } from './tools.js';
import {
  getParametersPathType,
  getParametersQueryType,
  getRequestBodyType,
  getResponsesType,
} from './request-type-tools.js';

/**
 * Generate API client code from filtered OpenAPI paths
 */
export function genCode(options: GenCodeOptions): {
  tsCode: string;
  typeCode: string;
  jsCode: string;
  genMetadataList: GenMetadata[];
} {
  const { spec, paths, importCode, extendType, aliases } = options;

  if (paths.length === 0) {
    return { tsCode: '', typeCode: '', jsCode: '', genMetadataList: [] };
  }

  const genMetadataList: GenMetadata[] = [];
  const typeCodeMap = new Map<string, string>();

  // Build metadata for each interface
  paths.forEach((item) => {
    const fnName = getFnName(item.url);
    const urlKey = getUrlKey(item.method, item.url);

    // Use alias if provided, otherwise use extracted fnName
    const resolvedFnName = aliases?.[urlKey] ?? fnName;

    const obj: GenMetadata = {
      fnName: resolvedFnName,
      url: item.url,
      method: item.method,
      summary: item.summary,
      fnArgs: [],
    };

    // Create type handlers
    const handlers = createTypesHandlers({ spec, pathObj: item, genContext: obj, typeCode: typeCodeMap });
    handlers.forEach((fn) => fn());

    genMetadataList.push(obj);
  });

  // Prefix independent types with Types. namespace
  genMetadataList.forEach((genItem) => {
    genItem.fnArgs.forEach((item) => {
      if (item.independent) {
        item.type = `Types.${item.type}`;
      }
    });
  });

  // Build options arg (shared by TS and JS)
  const optionsArg = {
    name: 'options',
    required: false,
    type: extendType ?? 'Record<string, any>',
    insertStatement: '...(options ?? {}),',
  };

  // Generate TS code
  const tsCode = genMetadataList
    .map((item) => {
      const allArgs = [...item.fnArgs, optionsArg];

      let code = `/** ${item.summary} */`;
      code += `\nexport const ${toCamelCase(item.fnName)}Api = (${allArgs.map((f) => `${f.name}${f.required ? '' : '?'}: ${f.type}`).join(', ')}) => {`;
      code += `\n  return request<${item.responsesType ?? 'any'}>({`;
      code += `\n    url: \`${convertPathTemplate(item.url)}\`,`;
      code += `\n    method: '${item.method}',`;
      code += allArgs
        .filter((f) => f.insertStatement)
        .map((f, index) => `${index === 0 ? '\n' : ''}    ${f.insertStatement}`)
        .join('\n');
      code += `\n  });\n};`;
      return code;
    })
    .join('\n\n');

  // Generate JS code
  const jsCode = genMetadataList
    .map((item) => {
      const allArgs = [...item.fnArgs, optionsArg];

      let code = `/** ${item.summary} */`;
      code += `\nexport const ${toCamelCase(item.fnName)}Api = (${allArgs.map((f) => f.name).join(', ')}) => {`;
      code += `\n  return request({`;
      code += `\n    url: \`${convertPathTemplate(item.url)}\`,`;
      code += `\n    method: '${item.method}',`;
      code += allArgs
        .filter((f) => f.insertStatement)
        .map((f, index) => `${index === 0 ? '\n' : ''}    ${f.insertStatement}`)
        .join('\n');
      code += `\n  });\n};`;
      return code;
    })
    .join('\n\n');

  return {
    tsCode,
    typeCode: [...typeCodeMap.values()].join('\n\n'),
    jsCode,
    genMetadataList,
  };
}

// --- Internal helpers ---

type CreateTypesHandlersOptions = {
  spec: OpenAPIV3.Document;
  pathObj: FilteredPath;
  genContext: GenMetadata;
  typeCode: Map<string, string>;
};

function createTypesHandlers(options: CreateTypesHandlersOptions) {
  const { spec, pathObj, genContext, typeCode } = options;

  // 每个 endpoint 共享一个 $ref 解析器，避免重复创建
  const resolveRef = createRefResolver(spec);

  function typeAnnotations(moduleName: string, text: string) {
    if (!typeCode.has(moduleName) || moduleName === 'AnyObject') return;
    const code = typeCode.get(moduleName)!;
    typeCode.set(moduleName, `/** ${text} */\n${code}`);
  }

  return [
    // Path params
    () => {
      const isParams = pathObj.parameters?.some(
        (item) => (item as OpenAPIV3.ParameterObject).in === 'path',
      );
      if (!isParams) return;
      const [type] = getParametersPathType({ spec, genContext, parameters: pathObj.parameters, typeCode, resolveRef });
      const [name] = removeTrailingBrackets(type);
      typeAnnotations(name, `${genContext.summary} - path 参数`);
      genContext.fnArgs.push({ name: 'path', type, independent: true, required: true });
    },

    // Query params
    () => {
      const isParams = pathObj.parameters?.some(
        (item) => (item as OpenAPIV3.ParameterObject).in === 'query',
      );
      if (!isParams) return;
      const [type, independent, hasRequired] = getParametersQueryType({ spec, genContext, parameters: pathObj.parameters, typeCode, resolveRef });
      if (independent) {
        const [name] = removeTrailingBrackets(type);
        typeAnnotations(name, `${genContext.summary} - params 参数`);
      }
      genContext.fnArgs.push({ name: 'params', type, independent: !!independent, insertStatement: 'params,', required: !!hasRequired });
    },

    // Body params
    () => {
      if (!pathObj.requestBody) return;
      const [type, independent] = getRequestBodyType({ spec, genContext, requestBody: pathObj.requestBody, typeCode, resolveRef });
      if (independent) {
        const [name] = removeTrailingBrackets(type);
        typeAnnotations(name, `${genContext.summary} - body 参数`);
      }
      // 根据 OpenAPI requestBody.required 字段决定是否必填（默认 true）
      const isRequired = !('$ref' in pathObj.requestBody) && pathObj.requestBody.required !== false;
      genContext.fnArgs.push({ name: 'data', type, independent: !!independent, insertStatement: 'data,', required: isRequired });
    },

    // Response type
    () => {
      const [type, independent] = getResponsesType({ spec, genContext, responses: pathObj.responses, typeCode, resolveRef });
      if (independent) {
        const [name] = removeTrailingBrackets(type);
        typeAnnotations(name, `${genContext.summary} - 响应参数`);
      }
      genContext.responsesType = independent ? `Types.${type}` : type;
    },
  ];
}
