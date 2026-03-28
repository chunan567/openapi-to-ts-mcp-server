// core
import { createSchemaToType } from './core.js';
// utils
import { convertParametersToSchema, createRefResolver } from './tools.js';
// types
import type { OpenAPIV3 } from 'openapi-types';
import type { GenMetadata, FilteredPath } from '../types.js';

type GetRequestBodyTypeArgs = {
  /** openapi spec */
  spec: OpenAPIV3.Document;
  /** body 请求参数 */
  requestBody: FilteredPath['requestBody'];
  /** 生成 api 上下文对象 */
  genContext: GenMetadata;
  /** ts 类型 Map */
  typeCode: Map<string, string>;
  /** 数据模型名称 */
  modelName?: string;
};

/**
 * 处理 body 类型
 * @param options
 * @returns
 */
const getRequestBodyType = (
  options: GetRequestBodyTypeArgs,
): [string, independent: boolean] => {
  const { requestBody, genContext, typeCode, modelName } = options;

  if (!requestBody) return ['any', false];

  // 处理外部定义的 requestBody components.requestBodies.xxx
  if ('$ref' in requestBody) {
    const resolveRef =
      createRefResolver<OpenAPIV3.OperationObject['requestBody']>(options.spec);
    const [schemaObject, $_modelName] = resolveRef(requestBody.$ref);
    return getRequestBodyType({
      ...options,
      requestBody: schemaObject,
      modelName: $_modelName,
    });
  }

  // 获取content中的schema, body 默认取  application/json 没有则取  */*
  const content = requestBody.content;
  const jsonSchema =
    content?.['application/json']?.schema || content?.['*/*']?.schema;

  // 空的，直接返回 any 类型
  if (!jsonSchema) return ['any', false];

  // 转换schema为类型声明
  const schemaToType = createSchemaToType({
    spec: options.spec,
    genContext,
    typeCode,
    typeSuffix: 'body-form',
  });

  const { type, independent } = schemaToType({
    schema: jsonSchema,
    modelName,
  });

  return [type, independent!];
};

type GetParametersTypeArgs = {
  /** openapi spec */
  spec: OpenAPIV3.Document;
  /** params 请求参数 */
  parameters: FilteredPath['parameters'];
  /** 生成 api 上下文对象 */
  genContext: GenMetadata;
  /** ts 类型 Map */
  typeCode: Map<string, string>;
};

/**
 * 处理 params 类型
 */
const getParametersQueryType = (
  options: GetParametersTypeArgs,
): [type: string, independent?: boolean] => {
  const { genContext, parameters, typeCode } = options;

  const resolveRef = createRefResolver<OpenAPIV3.ParameterObject>(options.spec);

  const newParameters: OpenAPIV3.ParameterObject[] = parameters!
    .map((item) => {
      if ('$ref' in item) {
        const [parameterObj] = resolveRef(item.$ref);
        return parameterObj!;
      } else {
        return item;
      }
    })
    .filter((item) => item.in === 'query');

  const schemaObj = convertParametersToSchema(newParameters);

  // 转换schema为类型声明
  const schemaToType = createSchemaToType({
    spec: options.spec,
    genContext,
    typeCode,
    typeSuffix: 'query-form',
  });

  const { type, independent } = schemaToType({
    schema: schemaObj,
  });

  return [type, independent];
};

type GetResponsesTypeArgs = {
  /** openapi spec */
  spec: OpenAPIV3.Document;
  /** responses 响应参数 */
  responses: FilteredPath['responses'];
  /** 生成 api 上下文对象 */
  genContext: GenMetadata;
  /** ts 类型 Map */
  typeCode: Map<string, string>;
  /** 数据模型名称 */
  modelName?: string;
};

/**
 * 处理 responses 类型
 */
const getResponsesType = (
  options: GetResponsesTypeArgs,
): [type: string, independent?: boolean] => {
  const {
    responses = {},
    genContext,
    typeCode,
    modelName,
  } = options;
  const resolveRef = createRefResolver<OpenAPIV3.ResponsesObject>(options.spec);

  if (responses['200'] && '$ref' in responses['200']) {
    const [responsesObj, _modelName] = resolveRef(responses['200'].$ref);

    return getResponsesType({
      ...options,
      responses: responsesObj!,
      modelName: _modelName,
    });
  }

  const jsonSchema =
    responses['200']?.content?.['application/json']?.schema ??
    responses['200']?.content?.['*/*']?.schema;

  if (!jsonSchema) return ['any', false];

  // 转换schema为类型声明
  const schemaToType = createSchemaToType({
    spec: options.spec,
    genContext,
    typeCode,
    typeSuffix: '-response-vo',
  });

  const { type, independent } = schemaToType({
    schema: jsonSchema,
    modelName,
  });

  return [type, independent!];
};

/**
 * 处理path路径参数
 */
const getParametersPathType = (
  options: GetParametersTypeArgs,
): [type: string, independent?: boolean] => {
  const { genContext, parameters, typeCode } = options;

  const resolveRef = createRefResolver<OpenAPIV3.ParameterObject>(options.spec);

  const newParameters: OpenAPIV3.ParameterObject[] = parameters!
    .map((item) => {
      if ('$ref' in item) {
        const [parameterObj] = resolveRef(item.$ref);
        return parameterObj!;
      } else {
        return item;
      }
    })
    .filter((item) => item.in === 'path');

  const schemaObj = convertParametersToSchema(newParameters);

  // 转换schema为类型声明
  const schemaToType = createSchemaToType({
    spec: options.spec,
    genContext,
    typeCode,
    typeSuffix: 'path-form',
  });

  const { type, independent } = schemaToType({
    schema: schemaObj,
  });

  return [type, independent];
};

export {
  getRequestBodyType,
  getParametersQueryType,
  getResponsesType,
  getParametersPathType,
};
