/**
 * ./profiles 文件描述数据源摘要结构, 应当在低码应用构建时自动生成
 */
import { getBuilderByMethodType } from './operators'
import { buildDefaultMethods } from './database'
import datasourceProfiles from './datasources-profiles'
import { app } from '../app/global-api'

/**
 * 暴露全局对象 dataSource 用于在应用中访问
 */

export const dataSources = {}

dataSources.$call = callDataSource

async function callDataSource (params) {
  let { options = {} } = params
  try {
    if(options && options.showToast){
      try {
        app.showLoading()
      } catch (e) {}
    }
    let res = await dataSources[params.dataSourceName][params.methodName](params.params)
    if (options && options.showToast) {
      try {
        app.showToast({
          title: '成功',
          icon: 'success',
        })
      } catch (e) {}
    }
    return res
  } catch(e) {
    if (options && options.showToast) {
      try {
        app.showToast({
          title: '失败',
          icon: 'error',
        })
      } catch (e) {}
    }
    throw e
  } finally {
    if (options && options.showToast) {
      try {
        app.hideLoading()
      } catch (e) {}
    }
  }
}

// window.dataSource = dataSource;
datasourceProfiles.forEach((ds) => createDataSource(ds))
export function createDataSource(ds) {
  const methods = {}

  if (ds.type === 'database') {
    const mt = buildDefaultMethods(ds)
    Object.assign(methods, mt)
  }

  if (ds.methods) {
    ds.methods.forEach((methodCfg) => {
      // 获取 本地函数/云函数的数据源方法构造器
      const builder = getBuilderByMethodType(methodCfg.type)
      methods[methodCfg.name] = builder(ds, methodCfg.name, {
        isDatabase: ds.type === 'database',
      })
    })
  }

  dataSources[ds.name] = methods
}
