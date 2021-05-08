import path from 'path';
import fs from 'fs-extra';
import { IPlugin } from './weapps-core';
import { installDep } from './builder/core';
import { uniq } from 'lodash';

export async function handleMpPlugins(
  plugins: IPlugin[] = [],
  appBuildDir: string
) {
  const appBuildMpDir = path.resolve(appBuildDir, 'dist/mp');
  const appBuildNodeModulesDir = path.resolve(appBuildDir, 'node_modules');
  const mpBuildPkgJsonPath = path.resolve(appBuildMpDir, 'package.json');
  const buildPkgJson = fs.readJsonSync(mpBuildPkgJsonPath);
  const sourcePkgJson = fs.readJsonSync(path.join(appBuildDir, 'package.json'));
  // 合并插件内容
  plugins
    .filter((plugin) => plugin.type === 'mp')
    .forEach((plugin) => {
      const mpBuildAppJsonPath = path.resolve(appBuildMpDir, 'app.json');
      const pluginAppJsonPath = path.resolve(
        appBuildNodeModulesDir,
        plugin.module,
        'app.json'
      );
      // 合并 app.json
      mergeSubPackages(mpBuildAppJsonPath, pluginAppJsonPath);
      // 加入到包依赖中

      buildPkgJson.dependencies[plugin.module] =
        sourcePkgJson.dependencies[plugin.module];
    });
  // 安装
  fs.writeJsonSync(mpBuildPkgJsonPath, buildPkgJson, { spaces: 2 });

  console.log('小程序安装依赖', appBuildMpDir);
  await installDep(appBuildMpDir);
}

function mergeSubPackages(baseAppJsonPath: string, mergeAppJsonPath: string) {
  const baseJson = fs.readJSONSync(baseAppJsonPath);
  const mergeJson = fs.readJSONSync(mergeAppJsonPath);
  if (!mergeJson.subpackages) return;

  const newJson = { ...baseJson };

  if (!baseJson.subpackages) {
    newJson.subpackages = mergeJson.subpackages;
  } else {
    mergeJson.subpackages.forEach((mergeItem: { root: string; pages: [] }) => {
      // 找到重复的进行合并再去重
      const targetItemIdx = newJson.subpackages.findIndex(
        (item: { root: string }) => {
          return item.root === mergeItem.root;
        }
      );
      if (newJson.subpackages[targetItemIdx]) {
        const pages = uniq(
          [].concat(newJson.subpackages[targetItemIdx].pages, mergeItem.pages)
        );
        newJson.subpackages[targetItemIdx].pages = pages;
      } else {
        newJson.subpackages.push(mergeItem);
      }
    });
  }

  fs.writeJSONSync(baseAppJsonPath, newJson, { spaces: 2 });
}
