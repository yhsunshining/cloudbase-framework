// https://www.npmjs.com/package/merge-package-json
//  处理依赖合并问题
import mergePackageJson from 'merge-package-json'
import { IWebRuntimeAppData, IPageInstance } from 'src/weapps-core'

export const CLOUD_FUNCTION_TYPE = 'cloud-function'
export const DATABASE_TYPE = 'database'

/**
 * 获取数据源云函数文件名称及数据源本地云函数文件名称
 * @param dsConfig 数据源配置
 */
export function getDatasourceResourceName(dsConfig) {
  return `lcap-${dsConfig.id}-${dsConfig.name}`
}

/**
 * 获取数据库 集合名称
 * @param dsConfig 数据源配置
 */
export function getDatasourceDatabaseName(dsConfig) {
  return dsConfig.type === DATABASE_TYPE ? getDatasourceResourceName(dsConfig) : null
}

/**
 * 合并 dependencies 依赖
 * @param  {...any} pkgs package.json 内容, 也可以是 dependencies 对象
 */
export function mergeDependencies(...pkgs) {
  let result = { dependencies: {} }
  result = pkgs.reduce((acc, pkg) => {
    const formated = getDependencies(pkg)
    const merged = mergePackageJson(formated, acc)
    return JSON.parse(merged)
  }, result)
  return result.dependencies
}

// 处理 package.json 内容, 只返回包含 dependencies 的对象
function getDependencies(pkg) {
  if (pkg.dependencies && typeof pkg.dependencies === 'object') {
    return {
      dependencies: pkg.dependencies
    }
  }
  return {
    dependencies: pkg
  }
}

/**
 * 简化数据源描述信息数组, 以供低码运行时使用
 *  该数组内容应当输出到 template/src/datasources/datasource-profiles.js.tpl 中
 * @param datasources 完整的数据源描述信息数组
 */
export function getDatasourceProfiles(datasources) {
  return datasources.map(ds => {
    const formated: {
      id: string
      name: string
      type: string
      config?: any
      methods?: any
    } = {
      id: ds.id,
      name: ds.name,
      type: ds.type
    }

    if (ds.config) {
      formated.config = {
        kind: ds.config.kind,
        methods: ds.config.methods
      }
    }

    if (ds.methods) {
      formated.methods = ds.methods.map(method => {
        return {
          name: method.name,
          type: method.type
        }
      })
    }

    return formated
  })
}

/**
 * 获取数据源变量描述信息对象
 *  该对象内容应当输出到 template/src/datasources/datavar-profiles.js.tpl 中
 * @param app 应用描述 JSON 内容
 */
export function getDataVarProfiles(appData: IWebRuntimeAppData) {
  const result = {
    // 应用数据源变量
    $global: appData.vars && appData.vars.data || []
  }
  appData.pageInstanceList.forEach((pageInstance) => {
    let p = pageInstance as IPageInstance
    result[p.id] = p.vars && p.vars.data || []
  })
  return result
}
