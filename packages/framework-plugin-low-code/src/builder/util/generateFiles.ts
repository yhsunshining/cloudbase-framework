import fs from 'fs-extra'
import path from 'path'
import tpl from 'lodash.template'

export default async function generateFiles(appFileData, srcDir: string, dstDir: string) {
  // Generating file by template and data
  for (const file in appFileData) {
    const tplStr = await fs.readFile(path.join(srcDir, file), {
      encoding: 'utf8',
    })
    const generatedCode = tpl(tplStr, { interpolate: /<%=([\s\S]+?)%>/ })(appFileData[file])
    const outFile = path.resolve(dstDir, file.replace(/\.tpl$/, ''))
    await fs.ensureFile(outFile)
    console.log(outFile)
    await fs.writeFile(outFile, generatedCode)
  }
}
