import fs from 'fs-extra'
import path from 'path'
import tpl from 'lodash.template'
import { IBuildContext } from '../mp/BuildContext'
import * as junk from '../util/junk'

const generatedFileContents = {} // generated files for incrmental build

export default async function generateFiles(
  appFileData,
  srcDir: string,
  dstDir: string,
  ctx: IBuildContext
) {
  const filesGenerated: string[] = []
  // Generating file by template and data
  for (const file in appFileData) {
    const fileNameList = file.split('|')
    const srcFileName = fileNameList[0]
    const outFileName = fileNameList[1] || fileNameList[0]
    const tplStr = await fs.readFile(path.join(srcDir, srcFileName), {
      encoding: 'utf8',
    })
    let generatedCode = tpl(tplStr, { interpolate: /<%=([\s\S]+?)%>/ })(
      appFileData[file]
    )

    // 混合模式下，引用公共路径要多增加一层，并加多一层命名
    if (ctx?.isMixMode && ctx?.rootPath) {
      generatedCode = generatedCode.replace(
        /..\/..\/..\/common\//g,
        '../../../../common/'
      )
      generatedCode = generatedCode.replace(
        /..\/..\/..\/app\//g,
        '../../../../app/'
      )
    }

    const outFile = path.resolve(dstDir, outFileName.replace(/\.tpl$/, ''))
    if (await writeFile(outFile, generatedCode)) {
      filesGenerated.push(outFileName)
    }
  }
  return filesGenerated
}

export async function writeFile(outFile: string, content: string) {
  const generated = generatedFileContents[outFile]
  if (generated === content) {
    return false
  }
  console.log(outFile)
  await fs.ensureFile(outFile)
  await fs.writeFile(outFile, content)
  generatedFileContents[outFile] = content
  return true
}

export function removeFile(file: string) {
  console.log('Removing ' + file)
  Object.keys(generatedFileContents).map((cachedFile) => {
    if (cachedFile.indexOf(file) === 0) {
      delete generatedFileContents[cachedFile]
    }
  })
  return fs.remove(file)
}

/**
 * Remove file in the dir but not in the allowedFiles
 */
export function cleanDir(dir: string, allowedFiles: string[]) {
  if (!fs.existsSync(dir)) return
  const allFiles = fs.readdirSync(dir).filter(junk.not)
  allFiles.map((file) => {
    if (allowedFiles.indexOf(file) < 0) {
      removeFile(path.join(dir, file))
    }
  })
}
