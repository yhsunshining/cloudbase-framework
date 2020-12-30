import * as path from 'path'
import { inspect } from 'util'
import * as fs from 'fs-extra'
import {
  IMaterialItem,
  IMaterialLibMeta,
  ICompositedComponent,
  IWeAppComponentInstance,
  compositedComponentApi,
  getCompositedComponentClass,
  IWeAppData,
} from '../../weapps-core'
import { materialsDirName, sharedMaterialsDir, appTemplateDir } from '../config'
import {
  getWxmlDataPrefix,
  jsonSchemaType2jsClass,
  builtinMpEvents,
  getClassAttrName,
} from '../config/mp'
import { getCurrentPackageJson } from '../util'
import { IBuildContext } from './BuildContext'
import { createWidgetProps, createEventHanlders, createDataBinds } from './util'
import { generateWxml, getUsedComponents } from './wxml'
import generateFiles from '../util/generateFiles'
import { writeCode2file } from './lowcode'
import { downloadZip } from '../util/net'
import NameMangler from '../util/name-mangler'
import { IUsedComps, IAppUsedComp } from '../types/common'

const templateDir = appTemplateDir + '/mp/'

export interface IMaterialLibs {
  [libName: string]: IMaterialLibMeta
}
export async function installMaterials(
  dependencies: IMaterialItem[] = [],
  projDir: string,
  usedComps: IUsedComps,
  weapps: IWeAppData[],
  ctx: IBuildContext
) {
  const localPkg = getCurrentPackageJson()
  const materialsInfo: IMaterialLibs = {} // {[pkgName]: {name, title, components: {[name]: {title, platforms: {}}}}}
  ctx.materialLibs = materialsInfo

  const compositedLibs = dependencies.filter(
    (lib) => lib.isComposite && usedComps[lib.name]
  )

  const weappsList = ctx.isMixMode
    ? weapps
    : weapps.filter((item) => !item.rootPath)

  // #1 Download uploaded libs
  await Promise.all(
    dependencies
      .filter((lib) => !lib.isComposite && usedComps[lib.name])
      .map(async ({ name, version, mpPkgUrl }) => {
        let materialsSrcDir = ''
        const materialId = `${name}@${version}`

        // #1 Download material
        if (localPkg && localPkg.name === name) {
          // If the target materials is current developing one skip download
          materialsSrcDir = path.join(process.cwd(), 'build', 'mp')
        } else {
          materialsSrcDir = path.join(
            sharedMaterialsDir,
            `${name}-mp@${version}`
          )
          await downloadMaterial(mpPkgUrl, materialsSrcDir)
        }

        // 混合模式下，各个子包获取自己使用过的组件和复合组件（会出现冗余）
        return Promise.all(
          weappsList.map(async (app) => {
            const targetDir = path.join(
              projDir,
              app.rootPath || '',
              materialsDirName,
              name
            )
            console.log(
              `Copying material ${materialId} from ${materialsSrcDir} to ${targetDir}`
            )
            // #2 link material to current project
            await fs.copy(materialsSrcDir, targetDir)
            materialsInfo[name] = fs.readJSONSync(
              path.join(targetDir, 'meta.json')
            )
          })
        )
      })
  )

  // #2 Generate composited libs
  compositedLibs.map((m) => {
    const lib: IMaterialLibMeta = {
      name: m.name,
      isComposite: !!m.isComposite,
      title: m.name,
      version: m.version,
      desc: 'Composisted components',
      styles: [],
      dependencies: {},
      components: {},
    }

    m.components.map((component) => {
      let cmp = component as ICompositedComponent
      lib.components[cmp.name] = cmp.meta

      if (usedComps[lib.name] && usedComps[lib.name].has(cmp.name)) {
        Object.entries(cmp.npmDependencies).map(([name, version]) => {
          lib.dependencies[name] = version
        })
      }

      cmp.meta.syncProps = {}
      const { dataForm = {} } = cmp
      for (const prop in dataForm) {
        const { inputProp, syncProp } = dataForm[prop]
        if (syncProp || inputProp) {
          cmp.meta.syncProps[prop] = syncProp || inputProp
        }
      }

      cmp.meta.platforms = {
        mp: {
          path: cmp.name + '/index',
        },
      }
    })

    materialsInfo[lib.name] = lib
  })

  compositedLibs.map((lib) => {
    console.log('Generate composited library ' + lib.name)
    return lib.components.map((component) => {
      let cmp = component as ICompositedComponent
      if (!usedComps[lib.name] || !usedComps[lib.name].has(cmp.name)) {
        return
      }
      weappsList.forEach((app) => {
        generateCompositeComponent(cmp, lib.name, {
          ...ctx,
          rootPath: app.rootPath || '', // 主包是没有 rootPath 的
        })
      })
    })
  })

  return materialsInfo
}

// 递归查询复合组件所使用的组件
export function extractUsedCompsRecursively(
  comps: IUsedComps,
  checkedComps: ICompositedComponent[],
  compositedLibs: IMaterialItem[],
  outputComps?: IUsedComps
) {
  let usedComps = (outputComps || comps) as IUsedComps

  const libsUsedByApp = Object.keys(comps)
  libsUsedByApp.forEach((libName) => {
    const cmpNames = comps[libName]
    const lib = compositedLibs.find((lib) => lib.name == libName)
    if (!lib || !lib.isComposite) return
    cmpNames.forEach((cmpName) => {
      const cmp = lib.components.find(
        (c) => c.name === cmpName
      ) as ICompositedComponent
      if (!cmp) {
        console.warn('Component not found', libName + ':' + cmpName)
        return
      }
      if (checkedComps.indexOf(cmp) > -1) return
      checkedComps.push(cmp)
      const cmpsUsedByThisComp = getUsedComponents(cmp.componentInstances)
      const libs = Object.keys(cmpsUsedByThisComp)
      libs.forEach((libName) => {
        if (!usedComps[libName]) {
          usedComps[libName] = cmpsUsedByThisComp[libName]
        } else {
          cmpsUsedByThisComp[libName].forEach((n) => usedComps[libName].add(n))
        }
      })
      extractUsedCompsRecursively(
        cmpsUsedByThisComp,
        checkedComps,
        compositedLibs,
        usedComps
      )
    })
  })

  return usedComps
}

async function downloadMaterial(zipUrl: string, dstFolder: string) {
  if (fs.existsSync(path.join(dstFolder, 'meta.json'))) return
  await downloadZip(zipUrl, dstFolder)
}

async function generateCompositeComponent(
  compositedComp: ICompositedComponent,
  materialName: string,
  ctx: IBuildContext
) {
  const outDir = path.join(
    ctx.projDir,
    ctx.rootPath || '', // 混合模式下，可能会有 rootPath
    materialsDirName,
    materialName,
    compositedComp.name
  )
  console.log(
    `Generating composited component ${materialName}:${compositedComp.name} to ${outDir}`
  )

  const wxmlDataPrefix = getWxmlDataPrefix(!ctx.isProduction)
  // # Generating page
  const usingComponents = {}
  const cmpContainer = Object.values(compositedComp.componentInstances)[0]
  const wxml = generateWxml(
    compositedComp.componentInstances,
    wxmlDataPrefix,
    ctx,
    usingComponents,
    (cmp, node) => {
      if (cmp === cmpContainer) {
        // Set className & style passed from parent for root component
        const { attributes } = node
        attributes[getClassAttrName(node.name)] +=
          ' ' + getCompositedComponentClass(compositedComp) + ' {{className}}'
        attributes.style += ';{{style}}'
      }
    }
  )

  // prepare form field change events
  const { syncProps } = compositedComp.meta
  const formEvents = {}
  Object.keys(syncProps).map((prop) => {
    const config = syncProps[prop]
    const configs = Array.isArray(config) ? config : [config]

    configs.forEach(({ changeEvent, valueFromEvent, isFormField }) => {
      if (isFormField) {
        formEvents[changeEvent] = valueFromEvent
      }
    })
  })

  const pageFileData = {
    'index.js': {
      propDefs: compositedComp.dataForm,
      handlers: compositedComp.lowCodes
        .filter((m) => m.type === 'handler-fn' && m.name !== '____index____')
        .map((m) => m.name),
      eventHandlers: createEventHanlders(
        compositedComp.componentInstances,
        compositedComponentApi,
        ctx
      ),
      protectEventKeys: builtinMpEvents,
      emitEvents: compositedComp.emitEvents.map((evt) => evt.eventName),
      widgetProps: createWidgetProps(compositedComp.componentInstances, ctx),
      compApi: compositedComponentApi,
      jsonSchemaType2jsClass,
      pageName: compositedComp.id,
      dataBinds: createDataBinds(compositedComp.componentInstances, ctx),
      debug: !ctx.isProduction,
      stringifyObj: inspect,
      dataPropNames: wxmlDataPrefix,
      formEvents: Object.keys(formEvents).length > 0 ? formEvents : null,
      config: compositedComp.compConfig,
    },
    'index.json': { usingComponents },
    'index.wxml': {
      // raw: JSON.stringify(page.componentInstances),
      wrapperClass: getCompositedComponentClass(compositedComp),
      content: wxml,
    },
    'index.wxss': {},
  }
  // Generating file by template and data
  await generateFiles(pageFileData, templateDir + '/component', outDir, ctx)

  // #3 writing lowcode files
  compositedComp.lowCodes
    .filter((mod) => mod.name !== '____index____')
    .map((mod) => {
      return writeCode2file(
        mod,
        path.join(outDir, 'lowcode'),
        { comp: compositedComp },
        '',
        ctx
      )
    })
  // await writeLowCodeFiles(weapp, appRoot)
  // await generateFramework(weapp, appRoot)
}

/**
 * {
 * gsd: {
 * input: 'input'
 * }
 * }
 */
export function getWxmlTag(
  cmp: Required<IWeAppComponentInstance>['xComponent'],
  ctx: IBuildContext,
  nameMangler?: NameMangler
) {
  const { moduleName, name } = cmp
  const cmpMeta = ctx.materialLibs[moduleName].components[name]
  if (!cmpMeta.platforms) {
    return { tagName: name.toLocaleLowerCase() }
  }
  let { tagName, path: compPath } = cmpMeta.platforms.mp || {}
  if (compPath) {
    // 小程序混合模式时，组件库会存在子包内
    const rootPath = ctx.rootPath || ''
    compPath = compPath.startsWith('/')
      ? compPath
      : `${ctx.isMixMode ? '/' + rootPath : ''}/materials/${
          cmp.moduleName
        }/${compPath}`
    tagName = moduleName + '-' + name
    if (nameMangler) {
      tagName = nameMangler.mangle(tagName)
    }
  }
  if (!tagName) {
    // console.error('No wml tagName provided for ', cmp.moduleName, cmp.name)
    tagName = name.toLocaleUpperCase()
  }
  return {
    tagName,
    path: compPath,
  }
}
