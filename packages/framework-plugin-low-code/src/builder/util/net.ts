import axios from 'axios'
import fs from 'fs-extra'
import * as path from 'path'
import compressing from 'compressing'

export async function downloadFile(url: string, filePath: string) {
  await fs.ensureDir(path.dirname(filePath))
  const res = await axios.get(url, { responseType: 'stream' })
  res.data.pipe(fs.createWriteStream(filePath))
}

/**
 * Download zip file and extract to dstDir
 * @param url
 * @param dstDir folder to hold the extract zip content
 */
export async function downloadZip(url: string, dstDir: string) {
  await fs.ensureDir(dstDir)
  const res = await axios.get(url, { responseType: 'stream' })
  await compressing.zip.uncompress(res.data, dstDir)
}
