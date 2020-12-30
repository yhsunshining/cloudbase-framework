import fs from 'fs-extra'
import path from 'path'
import tpl from 'lodash.template'
import { IBuildContext } from '../mp/BuildContext'

export default async function generateFiles(
  appFileData,
  srcDir: string,
  dstDir: string,
  ctx: IBuildContext
) {
  // Generating file by template and data
  for (const file in appFileData) {
    const tplStr = await fs.readFile(path.join(srcDir, file), {
      encoding: 'utf8',
    })
    let generatedCode = tpl(tplStr, { interpolate: /<%=([\s\S]+?)%>/ })(appFileData[file])
    // 混合模式下，引用公共路径要多增加一层，并加多一层命名
    if (ctx?.isMixMode && ctx?.rootPath) {
      generatedCode = generatedCode.replace(
        /..\/..\/..\/common\//g,
        '../../../../common/'
      )
      generatedCode = generatedCode.replace(/..\/..\/..\/app\//g, '../../../../app/')
    }

    const outFile = path.resolve(dstDir, file.replace(/\.tpl$/, ''))
    await fs.ensureFile(outFile)
    console.log(outFile)
    await fs.writeFile(outFile, generatedCode)
  }
}
