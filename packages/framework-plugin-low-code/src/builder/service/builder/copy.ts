/* eslint-disable @typescript-eslint/ban-ts-ignore */
import path from 'path'
import fs from 'fs-extra'
import tpl from 'lodash.template'
import _ from 'lodash'
import { getCurrentPackageJson } from '../../util'
import { IMaterialItem, IWebRuntimeAppData, readCmpInstances } from '../../../weapps-core'
import { appTemplateDir } from '../../config'
import { getComponentSchemaString, getListenersString } from './generate'

export async function copyEntryFile(appBuildDir: string, appContent: IWebRuntimeAppData) {
  const entryFilePath = path.resolve(appTemplateDir, './src/index.jsx')
  const content = await fs.readFile(entryFilePath)
  await fs.writeFile(
    path.join(appBuildDir, 'src/index.jsx'),
    tpl(content + '')({
      yyptAppKey: '',
      reportUrl: '',
      stopReport: false,
      ...appContent,
    }),
    { flag: 'w' }
  )
}

export async function copyMaterialLibraries(
  dependencies: IMaterialItem[] = [],
  materialsDir: string,
  appBuildDir: string
) {
  const localPkg = getCurrentPackageJson()
  await Promise.all(
    dependencies.map(async ({ name, version }) => {
      const materialNameVersion = `${name}@${version}`
      let targetDir = path.join(materialsDir, materialNameVersion, 'src')
      // 当前本地目录是素材库的时候，直接用本地的
      if (localPkg && localPkg.name === name && localPkg.version === version) {
        console.log('当前本地目录是素材库的时候，直接用本地的', materialNameVersion)
        targetDir = path.join(process.cwd(), 'src')
      }
      const librariesDir = path.join(appBuildDir, 'src/libraries', materialNameVersion)
      await fs.copy(targetDir, librariesDir)
    })
  )
}

export async function genCompositeComponentLibraries(
  dependencies: IMaterialItem[] = [],
  appBuildDir: string,
  materialGroupVersionMap: { [name: string]: string } = {}
) {
  await Promise.all(
    dependencies.map(async ({ name, version, components }) => {
      const materialNameVersion = `${name}@${version}`
      const librariesDir = path.join(appBuildDir, 'src/libraries', materialNameVersion)
      await Promise.all(
        components.map(async compItem => {
          const componentSchemaJson = {
            type: 'object',
            // @ts-ignore
            properties: readCmpInstances(compItem.componentInstances),
          }
          const templateData = {
            // @ts-ignore
            id: compItem.id,
            name: compItem.name,
            // @ts-ignore
            handlersImports: compItem.lowCodes.filter(
              codeItem => codeItem.type === 'handler-fn' && codeItem.name !== '____index____'
            ),
            // @ts-ignore
            useComponents: (function() {
              const list = []
              // @ts-ignore
              JSON.stringify(compItem.componentInstances, (key, value) => {
                if (key === 'xComponent') {
                  const { moduleName, name } = value
                  list.push({
                    moduleName,
                    name,
                    key: `${moduleName}:${name}`,
                    var: _.camelCase(`${moduleName}:${name}`),
                    version: materialGroupVersionMap[moduleName],
                  })
                }
                return value
              })
              return _.uniqBy(list, 'key')
            })(),
            componentSchema: getComponentSchemaString(componentSchemaJson, true),
            // @ts-ignore
            pageListenerInstances: getListenersString(compItem.listeners, true),
          }

          const dest = path.resolve(librariesDir, `./components/${compItem.name}/index.jsx`)
          const template = await fs.readFile(
            path.resolve(appTemplateDir, './src/pages/composite.tpl'),
            {
              encoding: 'utf8',
            }
          )
          const jsx = tpl(template)(templateData)
          await fs.ensureFile(dest)
          await fs.writeFile(dest, jsx)
        })
      )
    })
  )
}
