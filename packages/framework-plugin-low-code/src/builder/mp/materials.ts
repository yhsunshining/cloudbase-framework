import * as path from 'path'
import { inspect } from 'util'
import symlinkDir from 'symlink-dir'
import * as fs from 'fs-extra'
import {
  IMaterialItem,
  IMaterialLibMeta,
  ICompositedComponent,
  IWeAppComponentInstance,
  compositedComponentApi,
  getCompositedComponentClass,
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

const templateDir = appTemplateDir + '/mp/'

export interface IMaterialLibs {
  [libName: string]: IMaterialLibMeta
}
export async function installMaterials(
  dependencies: IMaterialItem[] = [],
  projDir: string,
  usedComps: { [libName: string]: Set<string> },
  ctx: IBuildContext
) {
  const localPkg = getCurrentPackageJson()
  const materialsInfo: IMaterialLibs = {} // {[pkgName]: {name, title, components: {[name]: {title, platforms: {}}}}}
  ctx.materialLibs = materialsInfo

  const compositedLibs = dependencies.filter(lib => lib.isComposite && usedComps[lib.name])
  extractUsedCompsRecursively(usedComps, [])

  // #1 Download uploaded libs
  await Promise.all(
    dependencies
      .filter(lib => !lib.isComposite && usedComps[lib.name])
      .map(async ({ name, version, mpPkgUrl }) => {
        let materialsSrcDir = ''
        const materialId = `${name}@${version}`

        // #1 Download material
        if (localPkg && localPkg.name === name) {
          // If the target materials is current developing one skip download
          materialsSrcDir = path.join(process.cwd(), 'build', 'mp')
        } else {
          materialsSrcDir = path.join(sharedMaterialsDir, `${name}-mp@${version}`)
          await downloadMaterial(mpPkgUrl, materialsSrcDir)
        }
        const targetDir = path.join(projDir, materialsDirName, name)
        console.log(`Copying material ${materialId} from ${materialsSrcDir} to ${targetDir}`)
        // #2 link material to current project
        await fs.copy(materialsSrcDir, targetDir)
        materialsInfo[name] = fs.readJSONSync(path.join(targetDir, 'meta.json'))
      })
  )

  // #2 Generate composited libs
  compositedLibs.map(m => {
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

      cmp.meta.inputProps = {}
      const { dataForm = {} } = cmp
      for (const prop in dataForm) {
        const { inputProp } = dataForm[prop]
        if (inputProp) {
          cmp.meta.inputProps[prop] = inputProp
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

  compositedLibs.map(lib => {
    console.log('Generate composited library ' + lib.name)
    return lib.components.map((component) => {
      let cmp = component as ICompositedComponent
      if (!usedComps[lib.name] || !usedComps[lib.name].has(cmp.name)) {
        return
      }
      generateCompositeComponent(cmp, lib.name, ctx)
    })
  })

  return materialsInfo

  function extractUsedCompsRecursively(
    comps: { [libName: string]: Set<string> },
    checkedComps: ICompositedComponent[]
  ) {
    const libsUsedByApp = Object.keys(comps)
    libsUsedByApp.forEach(libName => {
      const cmpNames = comps[libName]
      const lib = compositedLibs.find(lib => lib.name == libName)
      if (!lib || !lib.isComposite) return
      cmpNames.forEach(cmpName => {
        const cmp = lib.components.find(c => c.name === cmpName) as ICompositedComponent
        if (!cmp) {
          console.warn('Component not found', libName + ':' + cmpName)
          return
        }
        if (checkedComps.indexOf(cmp) > -1) return
        checkedComps.push(cmp)
        const cmpsUsedByThisComp = getUsedComponents(cmp.componentInstances)
        const libs = Object.keys(cmpsUsedByThisComp)
        libs.forEach(libName => {
          if (!usedComps[libName]) {
            usedComps[libName] = cmpsUsedByThisComp[libName]
          } else {
            cmpsUsedByThisComp[libName].forEach(n => usedComps[libName].add(n))
          }
        })
        extractUsedCompsRecursively(cmpsUsedByThisComp, checkedComps)
      })
    })
  }
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
  const outDir = path.join(ctx.projDir, materialsDirName, materialName, compositedComp.name)
  console.log(`Generating composited component ${materialName}:${compositedComp.name} to ${outDir}`)

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
  const { inputProps } = compositedComp.meta
  const formEvents = {}
  Object.keys(inputProps).map(prop => {
    const { changeEvent = 'change', valueFromEvent = 'event.detail.value' } = inputProps[prop]
    formEvents[changeEvent] = valueFromEvent
  })

  const pageFileData = {
    'index.js': {
      propDefs: compositedComp.dataForm,
      handlers: compositedComp.lowCodes
        .filter(m => m.type === 'handler-fn' && m.name !== '____index____')
        .map(m => m.name),
      eventHandlers: createEventHanlders(
        compositedComp.componentInstances,
        compositedComponentApi,
        ctx
      ),
      protectEventKeys: builtinMpEvents,
      emitEvents: compositedComp.emitEvents.map(evt => evt.eventName),
      widgetProps: createWidgetProps(compositedComp.componentInstances, ctx),
      compApi: compositedComponentApi,
      jsonSchemaType2jsClass,
      pageName: compositedComp.id,
      dataBinds: createDataBinds(compositedComp.componentInstances, ctx),
      debug: !ctx.isProduction,
      stringifyObj: inspect,
      dataPropNames: wxmlDataPrefix,
      formEvents: Object.keys(formEvents).length > 0 ? formEvents : null,
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
  await generateFiles(pageFileData, templateDir + '/component', outDir)

  // #3 writing lowcode files
  compositedComp.lowCodes
    .filter(mod => mod.name !== '____index____')
    .map(mod => {
      return writeCode2file(mod, path.join(outDir, 'lowcode'), { comp: compositedComp })
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
  cmp: IWeAppComponentInstance['xComponent'],
  materialLibs: IMaterialLibs
) {
  if (cmp) {

    const { moduleName, name } = cmp
    const cmpMeta = materialLibs[moduleName].components[name]
    try {
      // eslint-disable-next-line prefer-const
      let { tagName, path } = cmpMeta.platforms.mp
      if (!tagName) {
        tagName = (path ? moduleName + '-' + name : name).toLocaleLowerCase()
      }
      return {
        tagName,
        path: path && !path.startsWith('/') ? `/materials/${moduleName}/${path}` : path,
      }
    } catch (e) {
      return { tagName: name.toLowerCase(), path: null }
    }
  } else {
    throw new Error('invalid component')
  }
}
