import pump from 'pump'
import fs from 'fs-extra'
import compressing from 'compressing'
import path from 'path'
import os from 'os'
import crossSpawn from 'cross-spawn'
import * as childProcess from 'child_process'
import crypto from 'crypto'

class ReadOnlyArray<T> extends Array<T> {
  constructor(mutable: T[]) {
    super()
    return Object.freeze(mutable.slice()) as ReadOnlyArray<T>
  }
}

export function setReadOnly(target: object, key: string, v: any, deep = true) {
  let value = v

  if (deep && typeof value === 'object') {
    if (Array.isArray(value)) {
      value = new ReadOnlyArray(value)
    } else {
      Object.entries(value).forEach(([k, v]) => setReadOnly(value, k, v))
    }
  }

  return Object.defineProperty(target, key, {
    writable: false,
    get() {
      return value
    },
    set(): void {
      console.error(`Can not modify readonly value "${key}"`)
    },
  })
}

export type PromiseResult<T> = Promise<[null, T] | [Error, null]>
export function promiseWrapper<T>(p: Promise<T>): PromiseResult<T> {
  return new Promise(resolve => {
    try {
      p.then(i => resolve([null, i as T])).catch(e => resolve([e, null]))
    } catch (e) {
      resolve([e, null])
    }
  })
}

export const isWindows = process.platform === 'win32'
export const isMac = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'

export function compressingZip(entryList: string[], distPath: string, opts = {}) {
  return new Promise((resolve, reject) => {
    const zipStream = new compressing.zip.Stream()
    entryList.map(entry => {
      zipStream.addEntry(entry, opts)
    })
    const destStream = fs.createWriteStream(distPath)
    pump(zipStream, destStream, err => {
      if (err) {
        console.error(err)
        reject(err)
      }
      resolve(distPath)
    })
  })
}

export interface IPackageJson {
  name: string
  version: string
  title?: string
  desc?: string
  dependencies: {
    [name: string]: string
  }
  repository: {
    type: string
    url: string
  }
}
export async function getPackageJson(cwd: string): Promise<IPackageJson> {
  return await fs.readJson(path.join(cwd, 'package.json'))
}

export async function remove(dir: string) {
  await fs.remove(dir)
}

export function handlePathEscape(path: string): string {
  if (os.platform() !== 'win32') {
    return path
  }
  return path.replace(/\\/g, '\\\\')
}

/**
 * 是否为 win 平台
 */
export function isWinPlatform() {
  return os.platform() === 'win32'
}

export function spawnPro(
  command: string,
  args?: ReadonlyArray<string>,
  options?: childProcess.SpawnOptions
) {
  return new Promise((resolve, reject) => {
    const process = crossSpawn(command, args, options)
    let strOut = ''
    let strErr = ''
    process.stdout &&
      process.stdout.on('data', data => {
        strOut += data
      })

    process.stderr &&
      process.stderr.on('data', data => {
        strErr += data
      })

    function handleFinish(code: number) {
      if (code === 0) {
        resolve(strOut + strErr)
      } else {
        reject(strOut + strErr)
      }
    }
    process.on('error', err => {
      console.error('error', err)
    })
    process.on('close', handleFinish)
    process.on('exit', handleFinish)
  })
}

export function getValidNodeModulesPath() {
  const nodeModulesPath = path.resolve(__dirname, '../../node_modules')
  const cwdWaPath = path.resolve(process.cwd(), 'node_modules/.bin/wa')
  if (fs.pathExistsSync(cwdWaPath)) {
    return path.resolve(process.cwd(), 'node_modules')
  }
  return nodeModulesPath
}

export function getMd5(string: string, len = 8) {
  return crypto
    .createHash('md5')
    .update(string)
    .digest('hex')
    .slice(0, len)
}

export function getIPAdress() {
  const interfaces = os.networkInterfaces()
  for (const devName in interfaces) {
    const iface = interfaces[devName] || []
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i]
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address
      }
    }
  }
}
