import path from 'path'
import chalk from 'chalk'
import {
  getCodeModuleFilePath,
  IWeAppCode,
  getCompositedComponentClass,
  ICompositedComponent,
  COMPONENT_API_PREFIX,
} from '../../weapps-core'
import { processLessToRpx } from '../util/style'
import { IBuildContext } from './BuildContext'
import { writeFile } from '../util/generateFiles'

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

      // 子包混合模式需要添加相对索引到根目录
      const relativeRoot =
        ctx?.isMixMode && ctx.rootPath
          ? path.relative(ctx.rootPath, '') + '/'
          : ''

      let weappsApiPrefix = `import { app, process } from '${relativeRoot}${baseDir}/app/weapps-api'` // windows compatibility
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
        COMPONENT_API_PREFIX
      )}`
    }
  } else {
    code = `${themeCode ? themeCode : ''}\n${code}`
    if (comp) {
      // Add wrapper class for composited component
      code = `.${getCompositedComponentClass(comp)} {\n${code}\n}`
    }
    try {
      code = await processLessToRpx(`${code}`)
    } catch (e) {
      console.error('processLess Error', e)
    }
  }

  await writeFile(file, code)
}
