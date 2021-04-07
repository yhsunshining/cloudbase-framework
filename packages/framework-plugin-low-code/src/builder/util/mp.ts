/**
 * Tencent is pleased to support the open source community by making CloudBaseFramework - 云原生一体化部署工具 available.
 *
 * Copyright (C) 2020 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * Please refer to license text included with this package for license details.
 */
import * as fs from 'fs-extra'
import _ from 'lodash'

// 将后面的子包配置合并到前面
// 暂时不考虑 root 会重名的情况
export async function mergeSubPackages(
  baseAppJsonPath: string,
  mergeAppJsonPath: string
) {
  const baseJson = fs.readJSONSync(baseAppJsonPath)
  const mergeJson = fs.readJSONSync(mergeAppJsonPath)
  if (!getSubPackages(mergeJson)) return

  const newJson = { ...baseJson }

  if (!baseJson.subpackages) {
    newJson.subpackages = getSubPackages(mergeJson)
  } else {
    getSubPackages(mergeJson).forEach((mergeItem) => {
      // 找到重复的进行合并再去重
      const targetItemIdx = newJson.subpackages.findIndex((item) => {
        return item.root === mergeItem.root
      })
      if (newJson.subpackages[targetItemIdx]) {
        const pages = _.uniq(
          [].concat(newJson.subpackages[targetItemIdx].pages, mergeItem.pages)
        )
        newJson.subpackages[targetItemIdx].pages = pages
      } else {
        newJson.subpackages.push(mergeItem)
      }
    })
  }

  fs.writeJSONSync(baseAppJsonPath, newJson, { spaces: 2 })

  // 处理兼容
  function getSubPackages(json) {
    return json.subpackages || json.subPackages
  }
}

export async function mergePackageJson(
  basePkgJsonPath: string,
  mergePkgJsonPath: string
) {
  // 可能不存在 package.json 文件，需要初始化一个
  if (!(await fs.pathExists(basePkgJsonPath))) {
    await fs.copy(mergePkgJsonPath, basePkgJsonPath)
  } else {
    let baseJson = fs.readJSONSync(basePkgJsonPath)
    const mergeJson = fs.readJSONSync(mergePkgJsonPath)
    baseJson = {
      ...baseJson,
      ...mergePackageDependiences(baseJson, mergeJson),
    }
    await fs.writeJSON(basePkgJsonPath, baseJson, { spaces: 2 })
  }
}

export function mergePackageDependiences(baseJson, mergeJson) {
  baseJson.dependencies = {
    ...(baseJson.dependencies || {}),
    ...(mergeJson.dependencies || {}),
  }
  baseJson.devDependencies = {
    ...(baseJson.devDependencies || {}),
    ...(mergeJson.devDependencies || {}),
  }
  return baseJson
}

export async function mergePages(
  baseAppJsonPath: string,
  mergeAppJsonPath: string
) {
  const baseJson = fs.readJSONSync(baseAppJsonPath)
  const mergeJson = fs.readJSONSync(mergeAppJsonPath)

  baseJson.pages = _.uniq([
    ...(baseJson.pages || []),
    ...(mergeJson.pages || []),
  ])
  await fs.writeJSON(baseAppJsonPath, baseJson, { spaces: 2 })
}
