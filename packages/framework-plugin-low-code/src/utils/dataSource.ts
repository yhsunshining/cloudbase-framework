// https://www.npmjs.com/package/merge-package-json
//  处理依赖合并问题
import mergePackageJson from 'merge-package-json';
import { IWebRuntimeAppData, IPageInstance } from 'src/weapps-core';
import { DEPLOY_MODE } from '../types';
import { PropBindType } from '@cloudbase/cals/lib/parser/expression';
import { generateDataBind } from '../builder/mp/util';
import { REPLACE_SIGN } from '../builder/config';

export const CLOUD_FUNCTION_TYPE = 'cloud-function';
export const EXTERNAL_FUNCTION_TYPE = 'http';
export const DATABASE_TYPE = 'database';

/**
 * 获取数据源云函数文件名称及数据源本地云函数文件名称
 * @param dsConfig 数据源配置
 */
export function getDatasourceResourceName(datasrouce, mode) {
  let suffix = mode === DEPLOY_MODE.PREVIEW ? `-preview` : '';
  return `lcap-${datasrouce.id}-${datasrouce.name}${suffix}`;
}

export function getAppDatasourceResourceName(appId, datasrouce, mode) {
  let suffix = mode === DEPLOY_MODE.PREVIEW ? `-preview` : '';
  return `lcap-${datasrouce.id}-${datasrouce.name}-${appId}${suffix}`;
}

/**
 * 获取数据库 集合名称
 * @param dsConfig 数据源配置
 */
export function getDatasourceDatabaseName(dsConfig, mode) {
  return dsConfig.type === DATABASE_TYPE
    ? getDatasourceResourceName(dsConfig, mode)
    : null;
}

/**
 * 合并 dependencies 依赖
 * @param  {...any} pkgs package.json 内容, 也可以是 dependencies 对象
 */
export function mergeDependencies(...pkgs) {
  let result = { dependencies: {} };
  result = pkgs.reduce((acc, pkg) => {
    const formated = getDependencies(pkg);
    // mergePackageJson 不支持多个 * 的版本merge，临时复写方式，应当替换新包
    for (let key in formated.dependencies) {
      formated.dependencies[key] =
        formated.dependencies[key] === '*' && acc?.dependencies?.[key] === '*'
          ? 'latest'
          : formated.dependencies[key];
    }
    const merged = mergePackageJson(formated, acc);
    return JSON.parse(merged);
  }, result);
  return result.dependencies;
}

// 处理 package.json 内容, 只返回包含 dependencies 的对象
function getDependencies(pkg) {
  if (pkg.dependencies && typeof pkg.dependencies === 'object') {
    return {
      dependencies: pkg.dependencies,
    };
  }
  return {
    dependencies: pkg,
  };
}

/**
 * 将对象的key的首字母转换为小写
 * { UserName: 'xxx', Id: 'xxxx'} => { userName: 'xxx', id: 'xxx' }
 * 默认只处理最外层, 若 deep 为 true, 则递归处理
 */
export function lowercaseKey(obj: any, deep?: boolean): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => lowercaseKey(item, deep));
  const result: Record<string, any> = {};
  return Object.keys(obj).reduce((acc, key) => {
    const smallCase = key.charAt(0).toLowerCase() + key.slice(1);
    const val = obj[key];
    acc[smallCase] = deep ? lowercaseKey(val, deep) : val;
    return acc;
  }, result);
}

/**
 * 标准化从云API获取的数据源结构
 *  1. 将大写转换为小写
 *  2. 将 methods 和 methods 从字符串转换为对象
 */
export function standardizeDataSource(ds: any) {
  const transformed = lowercaseKey(ds, true);
  try {
    const { schema } = ds;
    if (typeof transformed.schema === 'string') {
      transformed.schema = JSON.parse(transformed.schema);
    }
    if (!transformed.schema || typeof transformed.schema !== 'object') {
      // console.warn(
      //   '[standardizeDataSource]invalid schema',
      //   schema,
      //   'in datasource',
      //   transformed
      // );
      transformed.schema = {};
    }
  } catch (error) {
    // console.warn(
    //   '[standardizeDataSource] unable to transform schema',
    //   transformed.schema
    // );
    transformed.schema = {};
  }
  try {
    const { methods } = ds;
    if (typeof transformed.methods === 'string') {
      transformed.methods = JSON.parse(transformed.methods);
    }
    if (!Array.isArray(transformed.methods)) {
      // console.warn(
      //   '[standardizeDataSource]invalid methods',
      //   methods,
      //   'in datasource',
      //   transformed
      // );
      transformed.methods = [];
    }
  } catch (error) {
    // console.warn(
    //   '[standardizeDataSource]unable to transform methods',
    //   transformed.methods
    // );
    transformed.methods = [];
  }
  return transformed;
}

/**
 * 简化数据源描述信息数组, 以供低码运行时使用
 *  该数组内容应当输出到 template/src/datasources/datasource-profiles.js.tpl 中
 * @param datasources 完整的数据源描述信息数组
 */
export function getDatasourceProfiles(datasources) {
  return (
    datasources?.map((item) => {
      const ds = standardizeDataSource(item);
      return {
        id: ds.id,
        title: ds.title,
        name: ds.name,
        type: ds.type,
        childDataSourceNames: ds.childDataSourceNames,
        schema: ds.schema,
        methods:
          ds.methods &&
          ds.methods.map((method) => {
            return {
              name: method.name,
              type: method.type,
            };
          }),
      };
    }) || []
  );
}

/**
 * 获取数据源变量描述信息对象
 *  该对象内容应当输出到 template/src/datasources/datavar-profiles.js.tpl 中
 * @param app 应用描述 JSON 内容
 */
export function getDataVarProfiles(appData: IWebRuntimeAppData) {
  const result = {
    // 应用数据源变量
    $global: (appData.vars && appData.vars.data) || [],
  };
  appData.pageInstanceList.forEach((pageInstance) => {
    let p = pageInstance as IPageInstance;
    result[p.id] = (p.vars && p.vars.data) || [];
  });
  return result;
}

function _generateDynamicDataset(dataset) {
  let { state } = dataset;
  if (state) {
    for (let key in state) {
      let config = state[key];
      if (config.varType === 'datasource' && config.initMethod?.params) {
        let params = config.initMethod.params;
        if (params) {
          let processed = {};
          for (let paramKey in params) {
            let bind = params[paramKey];
            if (!bind.type || bind.type === PropBindType.static) {
              let value = bind.value;
              processed[paramKey] = `${REPLACE_SIGN}(app, $page) => (${
                typeof value === 'string' ? `'${value}'` : JSON.stringify(value)
              })${REPLACE_SIGN}`;
            } else {
              let jsExp = generateDataBind(bind);
              processed[
                paramKey
              ] = `${REPLACE_SIGN}(app, $page) =>  (\n${jsExp}\n)${REPLACE_SIGN}`;
            }
          }
          config.initMethod.params = processed;
        }
      }
    }
  }
  return dataset;
}

export function getDatasetProfiles(
  mainAppData: {
    dataset?: any;
    rootPath?: string;
    pageInstanceList?: { dataset?: any }[];
  },
  apps?: {
    dataset?: any;
    rootPath?: string;
    pageInstanceList?: { dataset?: any }[];
  }[]
) {
  const result = {};
  if (mainAppData.dataset) {
    result['$global'] = _generateDynamicDataset(mainAppData.dataset);
  }
  (apps || []).forEach((app) => {
    app.pageInstanceList?.forEach((pageInstance) => {
      let p = pageInstance as IPageInstance;
      if (p.dataset) {
        result[app.rootPath ? `${app.rootPath}/${p.id}` : p.id] =
          _generateDynamicDataset(p.dataset);
      }
    });
  });
  return result;
}
