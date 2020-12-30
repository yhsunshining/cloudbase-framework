import * as fs from 'fs-extra'
import _ from 'lodash'

// 将后面的子包配置合并到前面
// 暂时不考虑 root 会重名的情况
export async function mergeSubPackages(baseAppJsonPath: string, mergeAppJsonPath: string) {
  const baseJson = fs.readJSONSync(baseAppJsonPath)
  const mergeJson = fs.readJSONSync(mergeAppJsonPath)
  if (!getSubPackages(mergeJson)) return

  const newJson = { ...baseJson }

  if (!baseJson.subPackages) {
    newJson.subPackages = getSubPackages(mergeJson)
  } else {
    getSubPackages(mergeJson).forEach(mergeItem => {
      // 找到重复的进行合并再去重
      const targetItemIdx = newJson.subPackages.findIndex(item => {
        return item.root === mergeItem.root
      })
      if (newJson.subPackages[targetItemIdx]) {
        const pages = _.uniq([].concat(newJson.subPackages[targetItemIdx].pages, mergeItem.pages))
        newJson.subPackages[targetItemIdx].pages = pages
      } else {
        newJson.subPackages.push(mergeItem)
      }
    })
  }

  fs.writeJSONSync(baseAppJsonPath, newJson, { spaces: 2 })

  // 处理兼容
  function getSubPackages(json) {
    return json.subpackages || json.subPackages
  }
}

export async function mergePackageJson(basePkgJsonPath: string, mergePkgJsonPath: string) {
  // 可能不存在 package.json 文件，需要初始化一个
  if (!(await fs.pathExists(basePkgJsonPath))) {
    await fs.copy(mergePkgJsonPath, basePkgJsonPath)
  } else {
    const baseJson = fs.readJSONSync(basePkgJsonPath)
    const mergeJson = fs.readJSONSync(mergePkgJsonPath)
    baseJson.dependencies = {
      ...(baseJson.dependencies || {}),
      ...(mergeJson.dependencies || {}),
    }
    baseJson.devDependencies = {
      ...(baseJson.devDependencies || {}),
      ...(mergeJson.devDependencies || {}),
    }
    await fs.writeJSON(basePkgJsonPath, baseJson, { spaces: 2 })
  }
}

export async function mergePages(baseAppJsonPath: string, mergeAppJsonPath: string) {
  const baseJson = fs.readJSONSync(baseAppJsonPath)
  const mergeJson = fs.readJSONSync(mergeAppJsonPath)

  baseJson.pages = _.uniq([...(baseJson.pages || []), ...(mergeJson.pages || [])])
  await fs.writeJSON(baseAppJsonPath, baseJson, { spaces: 2 })
}
