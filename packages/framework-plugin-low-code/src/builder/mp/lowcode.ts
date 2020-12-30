import path from 'path'
import fs from 'fs-extra'
import chalk from 'chalk'
import {
  getCodeModuleFilePath,
  IWeAppCode,
  getCompositedComponentClass,
  ICompositedComponent,
  compositedComponentApi,
} from '../../weapps-core'
import { processLessToRpx } from '../util/style'
import { IBuildContext } from './BuildContext'

export async function writeCode2file(
  mod: IWeAppCode,
  lowcodeRootDir: string,
  opts: { pageId?: string; appDir?: string; comp?: ICompositedComponent } = {},
  themeCode?: '',
  ctx?: IBuildContext
) {
  const { pageId = 'global', appDir, comp } = opts
  const file = path.join(
    lowcodeRootDir,
    getCodeModuleFilePath(pageId, mod, { style: '.wxss' })
  )
  let code = mod.code
  if (mod.type !== 'style' && mod.type !== 'theme') {
    if (appDir) {
      // Generate app lowcode
      const baseDir = path
        .relative(path.dirname(file), appDir)
        .replace(/\\/g, '/')
      let weappsApiPrefix = `import { app, process } from '${baseDir}/app/weapps-api'` // windows compatibility
      if (pageId !== 'global') {
        weappsApiPrefix += `\nimport { $page } from '${baseDir}/pages/${pageId}/api'`
      }
      code = weappsApiPrefix + '\n' + code
    } else {
      // Generate component lowcode
      code = `import process from '${
        mod.type === 'handler-fn' ? '../' : ''
      }../../../../common/process'\nimport app from '${
        mod.type === 'handler-fn' ? '../' : ''
      }../../../../common/weapp-sdk'\n${code.replace(
        /\$comp/g,
        compositedComponentApi
      )}`
    }
  } else {
    if (comp) {
      // Add wrapper class for composited component
      code = `.${getCompositedComponentClass(comp)} {\n${code}\n}`
    }
    try {
      code = await processLessToRpx(`${themeCode ? themeCode : ''}\n${code}`)
    } catch (e) {
      console.error('processLess Error', e)
    }
    console.log(chalk.green(file))
  }

  // 混合模式下，引用公共路径要多增加一层，并加多一层命名
  if (ctx?.isMixMode && ctx?.rootPath) {
    code = code.replace(/..\/..\/..\/common\//g, '../../../../common/')
    code = code.replace(/..\/..\/..\/app\//g, '../../../../app/')
  }

  await fs.ensureFile(file)
  await fs.writeFile(file, code)
}
