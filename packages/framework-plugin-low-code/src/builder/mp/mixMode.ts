import { IWeAppData, IPlugin, IMaterialItem } from '../../weapps-core';
import path from 'path';
import fs, { lstatSync, write, writeFile } from 'fs-extra';
import {
  mergeSubPackages,
  mergePackageJson,
  mergePages,
  mergePackageDependiences,
} from '../util/mp';
import { getPluginType } from '../service/builder/plugin';
import { IAppUsedComp } from '../types/common';
import _ from 'lodash';
import chalk from 'chalk';
import { cleanDir, removeFile } from '../util/generateFiles';
import { installDependencies } from '../service/builder/webpack';

// 将 BUILD 目录往混合模式移动
export async function handleMixMode({
  apps = [],
  generateMpPath,
  miniprogramRoot,
  plugins = [],
}: {
  apps: IWeAppData[];
  generateMpPath: string;
  miniprogramRoot: string;
  plugins: IPlugin[];
}) {
  // await handleMainApp()
  // await handleAppPages()
  await handleSubApps();

  // await handleAppJson()
  // await handlePkgJson()
  await installDependencies(miniprogramRoot);
  await handlePlugins();

  // 复制框架公用内容
  async function handleMainApp() {
    // 可以独立删除的
    const aloneDirs = ['common', 'app', 'lowcode', 'materials'];
    // 与主程序混合不能主动删除的
    const dirs = aloneDirs;
    await Promise.all(
      dirs.map(async (dirname) => {
        const srcDir = path.join(miniprogramRoot, dirname);
        if (await fs.pathExists(srcDir)) {
          const distDir = path.join(generateMpPath, dirname);
          if (aloneDirs.includes(dirname)) {
            await fs.remove(distDir);
          }
          await fs.copy(srcDir, distDir);
        }
      })
    );
  }

  // 复制主包的页面，需要判断是否有冲突
  async function handleAppPages() {
    // 需要特殊处理的
    const srcDir = path.join(miniprogramRoot, 'pages');
    const distDir = path.join(generateMpPath, 'pages');
    const pageList = await fs.readdir(srcDir);

    await Promise.all(
      pageList.map(async (page) => {
        const srcPageDir = path.join(srcDir, page);
        const srcDistDir = path.join(distDir, page);
        if (await fs.pathExists(srcDistDir)) {
          console.log(
            chalk.yellow(
              `【混合模式】 WeApps 中的 pages/${page} 与小程序 pages/${page} 重复，会以 WeApps 的为主`
            )
          );
        }

        await fs.copy(srcPageDir, srcDistDir);
      })
    );
  }

  async function handleSubApps() {
    let modifiedAppJson = false;
    const rootAppJosnPath = path.join(miniprogramRoot, 'app.json');
    let rootAppJosn = await fs.readJSON(rootAppJosnPath);

    let modifiedPackageJosn = false;
    const rootPackageJosnPath = path.join(miniprogramRoot, 'package.json');
    let rootPackageJson = fs.existsSync(rootPackageJosnPath)
      ? await fs.readJson(rootPackageJosnPath)
      : {
          name: 'WeDa-app',
          version: '1.0.0',
        };
    let mergeDependencies = {};

    await Promise.all(
      apps
        .filter((app) => app.rootPath)
        .map(async (app) => {
          const subAppPath = path.join(miniprogramRoot, app.rootPath || '');
          // 复制整个子包
          // 新模式下已经生成，感觉无需进行复制 @royhyang
          // const distDir = path.join(generateMpPath, app.rootPath || '')
          // await fs.copy(subAppPath, distDir, { overwrite: true })

          const appJsonPath = path.join(subAppPath, 'app.json');
          if (fs.existsSync(appJsonPath)) {
            let appJson = await fs.readJson(appJsonPath);
            if (appJson) {
              let { subpackages = [] } = rootAppJosn;
              const find = subpackages.find(
                (item) => item.root == app.rootPath
              );
              if (find) {
                find.pages = appJson.pages;
              } else {
                if (!rootAppJosn.subpackages) {
                  rootAppJosn.subpackages = [];
                }
                rootAppJosn.subpackages.push({
                  root: app.rootPath,
                  pages: appJson.pages,
                });
              }
              modifiedAppJson = true;
            }
          }

          const packageJosnPath = path.join(subAppPath, 'package.json');
          if (fs.existsSync(packageJosnPath)) {
            mergeDependencies = {
              ...mergeDependencies,
              ...(await mergePackageDependiences(
                mergeDependencies,
                await fs.readJson(packageJosnPath)
              )),
            };
            modifiedPackageJosn = true;
          }

          await Promise.all(
            [
              'app.json',
              'app.js',
              'app.wxss',
              'project.config.json',
              'package.json',
              'node_modules',
              'miniprograme_npm',
            ].map((name) => {
              let clearPath = path.join(subAppPath, name);
              return name.includes('.')
                ? removeFile(clearPath)
                : cleanDir(clearPath, []);
            })
          );
        })
    );
    if (modifiedAppJson) {
      await writeFile(
        rootAppJosnPath,
        JSON.stringify(rootAppJosn, undefined, 2)
      );
    }
    if (modifiedPackageJosn) {
      await writeFile(
        rootPackageJosnPath,
        JSON.stringify(
          {
            ...rootPackageJson,
            ...mergePackageDependiences(mergeDependencies, rootPackageJson), // 主包优先
          },
          undefined,
          2
        )
      );
    }
  }

  // 复制插件
  async function handlePlugins() {
    const mpPlugins = (await getPluginType(generateMpPath, plugins)).filter(
      (item) => item.type === 'mp'
    );
    return Promise.all(
      mpPlugins.map(async (plugin) => {
        const pluginModule = plugin.module;
        const pluginNodeModuleDir = path.resolve(
          generateMpPath,
          'node_modules',
          pluginModule
        );
        const pluginPkgJson = await fs.readJson(
          path.join(pluginNodeModuleDir, 'package.json')
        );
        const { pluginName } = pluginPkgJson;
        const pluginDir = path.join(miniprogramRoot, pluginName);
        const distDir = path.join(generateMpPath, pluginName);
        await fs.copy(pluginDir, distDir, { overwrite: true });
      })
    );
  }

  async function handleAppJson() {
    const baseAppJsonPath = path.join(generateMpPath, 'app.json');
    const mergeAppJsonPath = path.join(miniprogramRoot, 'app.json');
    await mergePages(baseAppJsonPath, mergeAppJsonPath);
    await mergeSubPackages(baseAppJsonPath, mergeAppJsonPath);
  }

  async function handlePkgJson() {
    const basePkgJsonPath = path.join(generateMpPath, 'package.json');
    const mergePkgJsonPath = path.join(miniprogramRoot, 'package.json');
    await mergePackageJson(basePkgJsonPath, mergePkgJsonPath);
  }
}

// 子模式则清理未使用的组件库
export async function handleMixMaterials(
  projDir: string,
  apps: IWeAppData[],
  appUsedComps: IAppUsedComp[],
  compositedLibs: IMaterialItem[]
) {
  return Promise.all(
    apps.map(async (app) => {
      const rootPath = app.rootPath || '';
      const materialsDirPath = path.join(projDir, rootPath, 'materials');
      const usedComps =
        appUsedComps.find((item) => item.rootPath === rootPath)?.usedComps ||
        {};
      const materialsLib = await readDirs(materialsDirPath);

      // 清理未使用的组件库
      const cleanLibs = _.difference(materialsLib, Object.keys(usedComps));
      await removeDirs(
        cleanLibs.map((libName) => path.join(materialsDirPath, libName))
      );

      // 清理未使用的组件
      await Promise.all(
        Object.keys(usedComps).map(async (libName) => {
          // 只去处理复合组件
          if (!compositedLibs.find((item) => item.name === libName)) {
            return;
          }

          const libComponents = usedComps[libName];
          const materialsLibComps = await readDirs(
            path.join(materialsDirPath, libName)
          );
          const cleanComps = _.difference(
            materialsLibComps,
            Array.from(libComponents)
          );
          await removeDirs(
            cleanComps.map((compName) =>
              path.join(materialsDirPath, libName, compName)
            )
          );
        })
      );
    })
  );
}

async function removeDirs(dirs: string[]) {
  return Promise.all(
    dirs.map((dir) => {
      console.log('【MIX MODE 清理】', dir);
      return fs.remove(dir);
    })
  );
}

// 只返回文件夹
async function readDirs(dirPath: string) {
  const isDirectory = (source: string) => lstatSync(source).isDirectory();
  return ((await fs.readdir(dirPath)) || []).filter((name) =>
    isDirectory(path.join(dirPath, name))
  );
}
