import path from 'path'
import fs from 'fs-extra'
import { merge, method } from 'lodash'
import { appTemplateDir } from '../builder/config'
import tpl from 'lodash.template'
import { getDatasourceResourceName, getDatasourceDatabaseName, mergeDependencies, CLOUD_FUNCTION_TYPE, DATABASE_TYPE } from "./dataSource"
import { IWeAppData } from '../weapps-core'
import { IFrameworkPluginFunctionInputs } from '@cloudbase/framework-plugin-function'
import { IFrameworkPluginDatabaseInputs } from '@cloudbase/framework-plugin-database'
import { DIST_PATH } from '../index'



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
export async function postProcessCloudFunction(cloudFunctionRoot, appData: IWeAppData): Promise<string[]> {
  let { datasources } = appData
  let functionNames: string[] = []
  let promises = datasources.reduce((arr, datasource) => {
    let subFunctions = datasource.methods.filter(mthd => mthd.type === CLOUD_FUNCTION_TYPE)
    if (subFunctions.length) {
      let cloudFucntionName = getDatasourceResourceName(datasource)
      functionNames.push(cloudFucntionName)
      let functionPath = path.join(cloudFunctionRoot, cloudFucntionName)
      fs.removeSync(functionPath)
      fs.ensureDirSync(functionPath)
      arr.push(fs.writeFile(
        path.join(cloudFunctionRoot, `${cloudFucntionName}/index.js`),
        tpl(
          fs.readFileSync(path.resolve(appTemplateDir, 'cloud-functions', 'index.js.tpl')).toString()
        )({
          collectionName: getDatasourceDatabaseName(datasource),
          cloudFunctions: subFunctions,
          datasource
        }),
        { flag: 'w' }
      ))
      arr.push(fs.writeFile(
        path.join(cloudFunctionRoot, `${cloudFucntionName}/package.json`),
        tpl(
          fs.readFileSync(path.resolve(appTemplateDir, 'cloud-functions', 'package.json.tpl')).toString()
        )({
          cloudFnName: cloudFucntionName,
          cloudFnDeps: mergeDependencies(...subFunctions.map(method => method.calleeBody?.config?.deps || {})),
          datasource
        }),
        { flag: 'w' }
      ))
    }

    return arr

  }, [])

  await Promise.all(promises)
  return functionNames
}

export function processCloudFunctionInputs(reletiveCloudFunctionRoot, appData): IFrameworkPluginFunctionInputs | undefined {
  let { datasources } = appData

  let functions = datasources.reduce((arr, datasource) => {
    let subFunctions = datasource.methods.filter(mthd => mthd.type === CLOUD_FUNCTION_TYPE)
    if (subFunctions.length) {
      let cloudFucntionName = getDatasourceResourceName(datasource)
      arr.push({
        name: cloudFucntionName,
        handler: 'index.main',
        installDependency: true,
        runtime: "Nodejs10.15",
        aclRule: { invoke: true }
      })

    }
    return arr
  }, [])
  if (functions.length) {
    return {
      functionRootPath: path.join(DIST_PATH, reletiveCloudFunctionRoot),
      functions,
      servicePaths: {}
    }
  }
  return;
}


export function processDatabaseInputs(appData): IFrameworkPluginDatabaseInputs | undefined {
  let { datasources } = appData
  let collections = datasources.filter(itme => itme.type == DATABASE_TYPE)
    .reduce((arr, datasource) => {
      arr.push({
        collectionName: getDatasourceResourceName(datasource),
        aclTag: 'CUSTOM',
        aclRule: JSON.stringify({
          read: true,
          write: true
        }, undefined, 2)
      })
      return arr
    }, [])


  if (collections.length) {
    return {
      collections
    }
  }

  return
}
