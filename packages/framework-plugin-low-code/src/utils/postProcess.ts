import path from 'path'
import fs from 'fs-extra'
import { merge, method } from 'lodash'
import { appTemplateDir } from '../builder/config'
import tpl from 'lodash.template'
import {
  getDatasourceResourceName,
  getAppDatasourceResourceName,
  getDatasourceDatabaseName,
  mergeDependencies,
  CLOUD_FUNCTION_TYPE,
  DATABASE_TYPE,
} from './dataSource'
import { IWeAppData } from '../weapps-core'
import { IFrameworkPluginFunctionInputs } from '@cloudbase/framework-plugin-function'
import { IFrameworkPluginDatabaseInputs } from '@cloudbase/framework-plugin-database'
import { DIST_PATH, DEPLOY_MODE } from '../index'

export function postprocessProjectConfig(projectJsonPath, data) {
  let projectJson = fs.readJsonSync(projectJsonPath)

  fs.writeJsonSync(projectJsonPath, merge(projectJson, data), { spaces: 2 })
}

/**
 * 处理生成云函数
 * @param cloudFunctionRoot
 * @param appData
 * @returns boolean // 是否需要生成云函数
 */
export async function postProcessCloudFunction(
  cloudFunctionRoot,
  appData: IWeAppData & { appId: string },
  options: {
    mode: DEPLOY_MODE
  }
): Promise<string[]> {
  let { datasources = [] } = appData
  let functionNames: string[] = []
  const { mode = DEPLOY_MODE.PREVIEW } = options || {}
  let promises = datasources.reduce((arr, datasource) => {
    const [cloudFunctionName, tasks] = generateCloudFunction(
      cloudFunctionRoot,
      path.join(appTemplateDir, 'cloud-functions'),
      datasource,
      appData.appId,
      mode
      )
    if (!cloudFunctionName) return arr
    arr.push(...tasks)
    return arr
  }, []) || []

  await Promise.all(promises)
  return functionNames
}

function generateCloudFunction (targetDir: string, templateDir: string, datasource: any, appId: string, mode: string) {
  let methods = datasource.methods.filter(
    (method) => method.type === CLOUD_FUNCTION_TYPE
  )
  if (!methods.length) return []
  let cloudFunctionName = getAppDatasourceResourceName(appId, datasource, mode)

  let functionPath = path.join(targetDir, cloudFunctionName)
  fs.removeSync(functionPath)
  fs.ensureDirSync(functionPath)

  const methodFileNameTup: [string, string][] = []
  const tasks: Promise<any>[] = methods.map(method => {
    const methodName = method.name
    let fileName = methodName
    // 方法名若为 index, 则改名为 _index
    if (fileName === 'index') fileName = `_${fileName}`
    methodFileNameTup.push([methodName, fileName])

    return fs.writeFile(
      path.join(functionPath, `${methodName}.js`),
      tpl(fs.readFileSync(path.join(templateDir, 'method.js.tpl'), 'utf8'),
      )({
        method,
      }),
      { flag: 'w' }
    )
  })
  tasks.push(fs.copy(path.join(templateDir, '_utils.js'), path.join(functionPath, '_utils.js')))
  tasks.push(
    fs.writeFile(
      path.join(functionPath, 'index.js'),
      tpl(
        fs
          .readFileSync(
            path.join(templateDir, 'index.js.tpl'), 'utf8'
          )
      )({
        collectionName: getDatasourceDatabaseName(datasource, mode),
        methodFileNameTup: methodFileNameTup,
        datasource,
      }),
      { flag: 'w' }
    )
  )
  tasks.push(
    fs.writeFile(
      path.join(functionPath, `package.json`),
      tpl(
        fs
          .readFileSync(
            path.join(
              templateDir,
              'package.json.tpl'
            ), 'utf8'
          )
      )({
        cloudFnName: cloudFunctionName,
        cloudFnDeps: mergeDependencies(
          ...methods.map(
            (method) => method.calleeBody?.config?.deps || {}
          )
        ),
        datasource,
      }),
      { flag: 'w' }
    )
  )
  return [cloudFunctionName, tasks]
}

export function processCloudFunctionInputs(
  reletiveCloudFunctionRoot,
  appData: IWeAppData & { appId: string },
  options: {
    mode: DEPLOY_MODE
  }
): IFrameworkPluginFunctionInputs | undefined {
  let { datasources = [] } = appData
  const { mode = DEPLOY_MODE.PREVIEW } = options || {}

  let functions = datasources?.reduce((arr, datasource) => {
    let subFunctions = datasource.methods.filter(
      (mthd) => mthd.type === CLOUD_FUNCTION_TYPE
    )
    if (subFunctions.length) {
      let cloudFucntionName = getAppDatasourceResourceName(
        appData.appId,
        datasource,
        mode
      )
      arr.push({
        name: cloudFucntionName,
        handler: 'index.main',
        installDependency: true,
        runtime: 'Nodejs10.15',
        aclRule: { invoke: true },
      })
    }
    return arr
  }, []) || []
  if (functions.length) {
    return {
      functionRootPath: path.join(DIST_PATH, reletiveCloudFunctionRoot),
      functions,
      servicePaths: {},
    }
  }
  return
}

export function processDatabaseInputs(
  appData,
  options: {
    mode: DEPLOY_MODE
  }
): IFrameworkPluginDatabaseInputs | undefined {
  let { datasources = [] } = appData
  const { mode = DEPLOY_MODE.PREVIEW } = options || {}

  let collections = datasources
    .filter((itme) => itme.type == DATABASE_TYPE)
    .reduce((arr, datasource) => {
      arr.push({
        collectionName: getDatasourceResourceName(datasource, mode),
        description: datasource.description || datasource.label || '数据源',
        aclTag: 'CUSTOM',
        aclRule: {
          read: true,
          write: true,
        },
      })
      return arr
    }, [])

  if (collections.length) {
    return {
      collections,
    }
  }

  return
}