// utils
import {
  createRefResolver,
  removeTrailingBrackets,
  toCamelCase,
} from './tools.js';
import { isEmpty, isNumber } from 'radash';
// types
import type { OpenAPIV3 } from 'openapi-types';
import type { GenMetadata } from '../types.js';

/** createSchemaToType 参数 */
type CreateSchemaToTypeOptions = {
  /** openapi spec */
  spec: OpenAPIV3.Document;
  /** 生成 api 上下文对象 */
  genContext: GenMetadata;
  /** ts 类型 Map */
  typeCode: Map<string, string>;
  /** 使用函数名作为类型时需要拼接后缀 */
  typeSuffix: string;
};

/** 递归处理类型 */
enum RecursiveType {
  ARR = 'ARR',
  OBJ = 'OBJ',
  REF = 'REF',
}

/** schemaToType 参数 */
type SchemaToOptions = {
  /** json schema */
  schema: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject | undefined;
  /** 数据模型名称 */
  modelName?: string;
  /** 父级模型名称 */
  parentModelName?: string;
  /** 递归类型 */
  handleType?: RecursiveType;
  /** 处理 object properties 递归时需要 传递字段名称 */
  objKey?: string;
  /** objKey 同时传递当前 处理时的 modelName */
  currentObjModelName?: string;
  /** 参数描述 */
  description?: string
  /**
   * 联合类型和交叉类型用于区分命名
   */
  ofIndex?: number
};

/** schemaToType 返回类型 */
type SchemaToReturn = {
  /** 模型名称或原始类型 */
  type: string;
  /** 独立声明的类型 true 。string string[] 为 false */
  independent?: boolean;
  /** 模型循环嵌套 */
  nested?: boolean;
  /** td 类型字符串 */
  tdCode?: string;
};

/** jsonSchema 原始类型映射 */
const baseTypes: Record<string, string> = {
  integer: 'number',
  number: 'number',
  string: 'string',
  boolean: 'boolean',
};

/**
 * 处理参数注释
 * @param obj
 * @returns
 */
function getExegesis<T extends OpenAPIV3.BaseSchemaObject>(obj: T): string {
  if (obj.title && !obj.description) {
    return `  /** ${obj.title} */\n`
  }

  if (!obj.title && obj.description) {
    return `  /** ${obj.description} */\n`
  }

  if (obj.title && obj.description) {
    return `  /**
   * 中文名：${obj.title},
   * 说明：${obj.description}
   */\n`
  }

  return ''
}

/**
 * 工厂函数创建一个 jsonSchema to type 方法
 * @param createOptions
 * @returns
 */
const createSchemaToType = (createOptions: CreateSchemaToTypeOptions) => {
  const { genContext, typeCode, typeSuffix } = createOptions;

  /** $ref 数据模型解析器 */
  const resolveRef = createRefResolver<
    OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject
  >(createOptions.spec);

  /** 缓存已处理过的 $ref 路径 */
  const seen$Ref = new Map<string, SchemaToReturn>();

  /**
   * jsonSchema to type
   * @param options
   * @returns
   */
  const schemaToType = (options: SchemaToOptions): SchemaToReturn => {
    const {
      schema,
      modelName,
      parentModelName,
      handleType,
      objKey,
      currentObjModelName,
      description,
      ofIndex
    } = options;

    /** 数据模型递归嵌套时直接返回数据模型名称 */
    if (parentModelName && modelName === parentModelName) {
      return {
        type: modelName,
        independent: true,
        nested: true,
      };
    }

    /** jsonSchema 为空时类型默认为 any */
    if (!schema) return { type: 'any' };

    /** 处理$ref引用类型 */
    if ('$ref' in schema) {
      if (seen$Ref.has(schema.$ref)) {
        // 处理的 $ref 直接返回结果，一个分组可能多个接口复用了这个 ref 不用多次处理
        return seen$Ref.get(schema.$ref)!;
      }

      // 解析ref引用
      const [resolved, $modelName] = resolveRef(schema.$ref);

      const {
        type: _modelName,
        independent: _independent,
        nested: _nested,
        tdCode: _tdCode,
      } = schemaToType({
        schema: resolved,
        description: (schema as OpenAPIV3.SchemaObject)?.description ? (schema as OpenAPIV3.SchemaObject)?.description : description,
        modelName: toCamelCase($modelName, true),
        parentModelName: modelName,
        handleType: RecursiveType.REF,
        ofIndex
      });

      // 独立声明的类型
      if (_independent && _tdCode) {
        // 处理是否是数组类型，如果是应先把 ModuleName[]  `[]` <-- 删除
        const [newModuleName, isArr] = removeTrailingBrackets(_modelName);


        // 添加类型到 Map 中
        let code = `export type ${newModuleName} = {\n${_tdCode}\n}`;

        /** 注释 */
        if (description) {
          code = newModuleName !== 'AnyObject' ? `/** ${description} */\n${code}` : code
        }

        typeCode.set(newModuleName, code);

        const resObj = {
          type: isArr ? `${newModuleName}[]` : newModuleName,
          independent: _independent,
          nested: _nested,
        };
        // 处理过的 $ref路径，缓存起来
        seen$Ref.set(schema.$ref, resObj);
        return resObj;
      } else {
        // 原始类型直接返回其类型即可
        const resObj = {
          type: _modelName,
        };
        // 处理过的 $ref路径，缓存起来
        seen$Ref.set(schema.$ref, resObj);
        return resObj;
      }
    }


    /** 处理枚举类型 */
    if (schema.enum) {
      /** 枚举名称 */
      let _moduleName = ''
      /** 基础键 */
      let _key = ''


      if (modelName) {
        _key = modelName
        _moduleName = modelName
      } else if (currentObjModelName) {
        _moduleName = currentObjModelName
      }

      if (objKey) {
        _key = objKey
        _moduleName = toCamelCase(`${_moduleName}-${objKey}-enum`, true)
      } else {
        _moduleName = toCamelCase(`${_moduleName}-enum`, true)
      }

      const enumType = schema.type === 'string'
        ? schema.enum.map(item => `  ${_key.toUpperCase()}${item} = '${item}',`).join('\n')
        : schema.enum.map(item => `  ${_key.toUpperCase()}${item} = ${item},`).join('\n')
      const desc = description ?? schema.description
      const type = `${desc ? `/** ${desc} */\n` : ''}export enum ${_moduleName} {\n${enumType}\n}`

      typeCode.set(_moduleName, type)

      return {
        type: _moduleName,
        independent: true
      };
    }

    const handleComposition = (schemas: (OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject)[], separator: ' & ' | ' | ') => {
      const types = schemas.map((subSchema, index) =>
        schemaToType({
          ...options, // 传递所有选项
          schema: subSchema,
          ofIndex: index
        }).type
      );

      // 过滤掉'any'以避免无用的交叉类型，例如'MyType & any'。还有注意使用 Set处理去重，重复的交叉和联合没有意义
      const filteredTypes = [...new Set(types)].filter(t => t !== 'any');
      if (filteredTypes.length === 0) return 'any';
      return filteredTypes.join(separator);
    };

    /** 处理 allOf(多合一对应ts类型就是交叉类型) */
    if (schema.allOf?.length) {
      return { type: handleComposition(schema.allOf, ' & ') };
    }

    /** 处理 anyOf(或-联合类型) */
    if (schema.anyOf?.length) {
      return { type: handleComposition(schema.anyOf, ' | ') };
    }

    /** 处理 oneOf(异或-联合类型，异或在ts中无法表达同样是联合类型) */
    if (schema.oneOf?.length) {
      return { type: handleComposition(schema.oneOf, ' | ') };
    }

    /** 处理数组类型 */
    if (schema.type === 'array') {
      if (!schema.items) {
        // items 缺失，默认为 any[]
        return { type: 'any[]' };
      }
      // schema.items 递归处理
      const { type: _modelName, tdCode: _tdCode } = schemaToType({
        schema: schema.items,
        description: schema?.description ? schema?.description : description,
        modelName,
        parentModelName,
        handleType: RecursiveType.ARR,
        objKey,
        currentObjModelName,
        ofIndex,
      });

      // 原始类型直接返回 string[] ...
      if (baseTypes[_modelName]) {
        return {
          type: `${_modelName}[]`,
        };
      } else if (handleType === RecursiveType.REF) {
        // 这里是 $ref 引用过来的，需要返回 tdCode 给他处理添加到 Map 中
        return {
          type: `${modelName}[]`,
          independent: true,
          tdCode: _tdCode,
        };
      }

      // OBj 递归进来的和默认的处理法式一致
      return {
        type: `${_modelName}[]`,
        independent: true,
      };
    }

    /** 处理基本类型 */
    if (schema.type && baseTypes[schema.type]) {
      return {
        type: schema.nullable
          ? `${baseTypes[schema.type]} | null`
          : baseTypes[schema.type],
      };
    }

    /** 处理对象类型 */
    if (schema.type === 'object') {
      if (isEmpty(schema.properties) || !schema.properties) {
        // properties 不存在，type 又等于 object

        const code = `export type AnyObject = Record<string, any>`;
        typeCode.set(`AnyObject`, code);

        // 如果是ref引用过来的，并且是obj,刚好这个ref引用 obj 是空的
        if (handleType === RecursiveType.REF) {
          return {
            type: 'AnyObject',
            independent: true,
            tdCode: '  [key: string]: any',
          };
        }

        return {
          type: 'AnyObject',
          independent: true,
        };
      }

      let props = '';
      let _modelName = '';
      let indexStr = ''
      if (isNumber(ofIndex)) {
        indexStr = `${ofIndex}`
      }

      // 首次进来 modelName 存在或 ref modelName
      if (modelName) {
        _modelName = modelName;
      } else {



        // 否则使用函数名作为默认 type 类型名称
        const name = toCamelCase(`${genContext.fnName}-${typeSuffix}`, true);

        _modelName = name;
      }

      props = Object.entries(schema.properties)
        .map(([key, value]) => {
          // 必填字段
          const isRequired = schema.required?.includes(key);

          const { type: propType } = schemaToType({
            schema: value,
            description: (value as OpenAPIV3.SchemaObject)?.description ? (value as OpenAPIV3.SchemaObject)?.description : description,
            modelName,
            parentModelName,
            handleType: RecursiveType.OBJ,
            objKey: objKey ? toCamelCase(`${objKey}_${key}`, true) : key,
            currentObjModelName: _modelName,
            ofIndex
          });

          const exegesis = getExegesis(value as OpenAPIV3.BaseSchemaObject)
          return `${exegesis}  ${key}${isRequired ? '' : '?'}: ${propType};`;
        })
        .join('\n');

      if (modelName) {
        // objKey 存在？ 说明是处理obj中出现了嵌套obj类型,生成类型返回，类型名称
        if (objKey) {
          const _name = toCamelCase(`${_modelName}${indexStr}_${objKey}`, true);
          let _code = `export type ${_name} = {\n${props}\n}`;


          /** 注释 */
          if (description) {
            _code = _name !== 'AnyObject' ? `/** ${description} */\n${_code}` : _code
          }

          typeCode.set(_name, _code);

          return {
            type: _name,
            independent: true,
          };
        }
        return {
          type: _modelName,
          independent: true,
          tdCode: props,
        };
      } else if (
        handleType === RecursiveType.OBJ ||
        handleType === RecursiveType.ARR
      ) {
        /**
         * modelName 不存在说明首次，也非ref
         * 也只有一种情况
         * 首次处理时就是 object 类型，处理过程出现 object 到这里, 或者是嵌套 arr ， obj -> arr -> obj（这里）
         * 这里判断 currentObjModelName 是否存在，也有可能是多次嵌套-层级命名
         * 否则使用  _modelName 作为命名
         */
        const _name = currentObjModelName
          ? toCamelCase(`${currentObjModelName}${indexStr}_${objKey}`, true)
          : _modelName;
        let _code = `export type ${_name} = {\n${props}\n}`;


        /** 注释 */
        if (description) {
          _code = _name !== 'AnyObject' ? `/** ${description} */\n${_code}` : _code
        }

        typeCode.set(_name, _code);

        return {
          type: _name,
          independent: true,
        };
      }

      // 默认处理方式，首次就是 object 类型
      let code = `export type ${_modelName} = {\n${props}\n}`;


      /** 注释 */
      if (description) {
        code = _modelName !== 'AnyObject' ? `/** ${description} */\n${code}` : code
      }

      typeCode.set(_modelName, code);

      return {
        type: _modelName,
        independent: true,
      };
    }

    // 兜底类型 any
    return {
      type: 'any',
    };
  };

  return schemaToType;
};

export { createSchemaToType };
