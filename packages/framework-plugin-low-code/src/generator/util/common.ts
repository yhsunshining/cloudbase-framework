import path from 'path';
import url from 'url';
import { ISchema, Schema } from '@formily/react-schema-renderer';
import {
  IFileCodeMap,
  IComponentsInfoMap,
  IComponentInputProps,
} from '../types/common';
import {
  ICompositedComponent,
  IMaterialItem,
  IWeAppComponentInstance,
} from '../../weapps-core';

export type PromiseResult<T> = Promise<[null, T] | [Error, null]>;
export function promiseWrapper<T>(p: Promise<T>): PromiseResult<T> {
  return new Promise((resolve) => {
    try {
      p.then((i) => resolve([null, i as T])).catch((e) => resolve([e, null]));
    } catch (e) {
      resolve([e, null]);
    }
  });
}

export function deepDealComponentSchemaJson(
  schema: IWeAppComponentInstance,
  dealFn: (currentSchema: IWeAppComponentInstance) => void
) {
  if (!schema) return;

  dealFn(schema);
  if (schema.properties) {
    Object.keys(schema.properties).forEach((key) => {
      const childSchema = schema?.properties?.[key];
      if (childSchema) {
        deepDealComponentSchemaJson(childSchema, dealFn);
      }
    });
  }
}

export function getMetaInfoBySourceKey(sourceKey: string) {
  if (!sourceKey) {
    return {};
  }
  const [materialName, name] = sourceKey.split(':');
  return {
    materialName,
    name,
    variableName: camelcase(materialName + '_' + name),
  };
}

export function isArray(src: any) {
  return Object.prototype.toString.call(src) === '[object Array]';
}

export function isPlainObject(src: any) {
  return Object.prototype.toString.call(src) === '[object Object]';
}

export function deepDeal(
  src: any,
  reviver: (key: any, value: any, parent: any) => void
) {
  // 对于 数组
  if (isArray(src)) {
    for (let i = 0, len = src.length; i < len; i++) {
      deepDeal(src[i], reviver);
      reviver?.(i, src[i], src);
    }
  }

  // 对于 Object
  if (isPlainObject(src)) {
    for (const key in src) {
      if (src.hasOwnProperty(key)) {
        // 忽略掉继承属性
        deepDeal(src[key], reviver);
        reviver?.(key, src[key], src);
      }
    }
  }
}

export function simpleDeepClone<T>(data: any): T {
  return JSON.parse(JSON.stringify(data));
}

export function JsonToStringWithVariableName(
  copyJson: any,
  options: { EOL: boolean }
): string {
  let variable = JSON.stringify(copyJson, null, 2)
    .replace(/("%%%|%%%")/g, '')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, "'");

  if (options.EOL) {
    variable = variable.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  }

  return variable;
}

export function deepDealSchema(
  sourceSchema: ISchema,
  deal: (schema: Schema, key: string) => void
): ISchema {
  const fieldSchema = new Schema(sourceSchema);
  if (fieldSchema?.isObject()) {
    Object.keys(fieldSchema.properties || {}).forEach((key) => {
      const schema = fieldSchema.properties?.[key];
      const { 'x-props': xProps } = schema || {};
      if (xProps?.['data']?._visible === false) {
        // 暂时不知道 fieldSchema.properties.key 如何删除，暂时使用空Schema替换
        fieldSchema.setProperty(key, new Schema({}));
      } else if (schema) {
        deepDealSchema(schema, deal);
        deal?.(schema, key);
      }
    });
  }
  return fieldSchema.toJSON();
}

export async function getComponentsInfo(
  appBuildDir: string,
  dependencies: IMaterialItem[],
  fileCodeMap: IFileCodeMap
): Promise<IComponentsInfoMap> {
  const outputObj = {};
  await Promise.all(
    dependencies.map(
      async ({ name: materialName, components, isComposite }) => {
        if (isComposite) {
          components.forEach((component) => {
            let compItem = component as ICompositedComponent;
            const sourceKey = `${materialName}:${compItem.name}`;
            outputObj[sourceKey] = {
              isComposite,
              ...compItem,
            };
          });
        } else {
          await Promise.all(
            components.map(
              async ({ name, meta, emitEvents, evnets = undefined }) => {
                outputObj[materialName + ':' + name] = {
                  isComposite,
                  ...meta,
                  events: evnets,
                  emitEvents: emitEvents,
                };
              }
            )
          );
        }
      }
    )
  );
  return outputObj;
}

export function getInputProps(
  componentsMetaMap: IComponentsInfoMap
): IComponentInputProps {
  const outputObj = {};
  for (let key in componentsMetaMap) {
    let component = componentsMetaMap[key];
    const sourceKey = key;
    if (component.isComposite) {
      let compItem = component as ICompositedComponent;
      Object.keys(compItem.dataForm || {}).forEach((key) => {
        const inputProps =
          compItem.dataForm[key]?.inputProp || compItem.dataForm[key]?.syncProp;
        if (inputProps) {
          outputObj[sourceKey] = {
            [key]: inputProps,
            ...(outputObj[sourceKey] || {}),
          };
        }
      });
    } else {
      const inputProps = component?.inputProps || component?.syncProps;
      if (inputProps) {
        outputObj[sourceKey] = inputProps;
      }
    }
  }
  return outputObj;
}

export async function getYyptConfigInfo(extraData: any) {
  const configJson = {
    yyptAppKey: '',
    reportUrl: '',
    stopReport: 'true',
  };
  if (!extraData || !extraData.operationService) {
    extraData = extraData || {};
    extraData.operationService = extraData.operationService || {
      yyptEnabled: true,
    };
  }

  const yyptAppKey =
    configJson.yyptAppKey || extraData.operationService.extAppId || '';
  const reportUrl =
    configJson.reportUrl || extraData.operationService.reportUrl || '';
  const stopReport =
    configJson.stopReport === 'true' || !extraData.operationService.yyptEnabled;

  return {
    yyptAppKey,
    reportUrl,
    stopReport,
  };
}

export async function writeLibCommonRes2file(gItem: any, codeDir: string) {
  const compLibCommonResource = gItem.compLibCommonResource;
  const libCommonResFiles: { path: string; code: string }[] = [];
  libCommonResFiles.push(
    {
      path: path.join(codeDir, `class.less`),
      code: `
        ${compLibCommonResource.theme.variable || ''}
        ${compLibCommonResource.class || ''}
        ${compLibCommonResource.theme.class || ''}
        `,
    },
    {
      path: path.join(codeDir, 'const.js'),
      code: compLibCommonResource ? compLibCommonResource.const.code : '',
    },
    {
      path: path.join(codeDir, 'tools.js'),
      code: compLibCommonResource ? compLibCommonResource.tools.code : '',
    }
  );
  return libCommonResFiles.reduce((ret, item) => {
    ret[item.path] = {
      code: item.code,
    };
    return ret;
  }, {});
}

/**
 *
 * @param fileUrl 带文件名的url请求地址
 */
export function getFileNameByUrl(fileUrl: string) {
  const parsedUrl = url.parse(fileUrl);
  const filename = path.basename(parsedUrl?.pathname || '');
  return filename;
}

export function upperFirst(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}

export function camelcase(str: string, firstUpperCase = false) {
  str = str.replace(/[\:_-]([a-zA-Z])/g, function (l) {
    return l[1].toUpperCase();
  });

  if (firstUpperCase) str = str.charAt(0).toUpperCase() + str.slice(1);

  return str;
}

export function cleanVarName(name: string) {
  return name.replace(/[@-]/g, '_');
}
