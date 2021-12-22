/* eslint-disable @typescript-eslint/ban-ts-ignore */
import path from 'path';
import fs, { readJsonSync } from 'fs-extra';
import tpl from 'lodash.template';
import jsonSchemaDefaults from 'json-schema-defaults';
import _ from 'lodash';
import { getCurrentPackageJson, readComponentLibMata } from '../../util';
import {
  IMaterialItem,
  IWebRuntimeAppData,
  readCmpInstances,
  getCompositedComponentClass,
  ICompositedComponent,
  IComponentLibEntry,
} from '../../../weapps-core';
import { appTemplateDir } from '../../config';
import { IComponentInputProps, IComponentsInfoMap } from '../../types/common';
import {
  getComponentSchemaString,
  getListenersString,
  getOriginComponentAndActionList,
} from './generate';
import * as junk from '../../util/junk';

export async function copyEntryFile(
  appBuildDir: string,
  appContent: IWebRuntimeAppData,
  adminPortalKey
) {
  const entryFilePath = path.resolve(appTemplateDir, './src/index.jsx');
  const content = await fs.readFile(entryFilePath);
  await fs.writeFile(
    path.join(appBuildDir, 'src/index.jsx'),
    tpl(content + '')({
      adminPortalKey,
      yyptAppKey: '',
      reportUrl: '',
      stopReport: false,
      ...appContent,
    }),
    { flag: 'w' }
  );
}

export async function copyMaterialLibraries(
  dependencies: IMaterialItem[] = [],
  materialsDir: string,
  appBuildDir: string
) {
  const localPkg = getCurrentPackageJson();
  await Promise.all(
    dependencies.map(async (componentLib) => {
      const { name, version } = componentLib;
      const materialNameVersion = `${name}@${version}`;
      const materialDir = path.join(materialsDir, materialNameVersion);
      const srcDir = 'src';
      let targetDir = path.join(materialDir, srcDir);
      // 当前本地目录是素材库的时候，直接用本地的
      if (localPkg && localPkg.name === name && localPkg.version === version) {
        console.log(
          '当前本地目录是素材库的时候，直接用本地的',
          materialNameVersion
        );
        targetDir = path.join(process.cwd(), 'src');
      }
      const librariesDir = path.join(
        appBuildDir,
        'src/libraries',
        materialNameVersion
      );
      const metaJosnPath = path.join(materialDir, 'meta.json');
      if (fs.existsSync(metaJosnPath)) {
        await fs.copy(metaJosnPath, path.join(librariesDir, 'meta.json'));
      }
      await fs.copy(targetDir, librariesDir, {
        filter: (src, dest) => {
          let path = src.split('/');
          return !junk.is(path[path.length - 1]);
        },
      });
      // 副作用修改了dependence定义，trycatch 不阻塞主流程
      try {
        const meta = readComponentLibMata(librariesDir);
        if (meta?.schemaVersion) {
          componentLib['schemaVersion'] = meta?.schemaVersion;
        }
        let [major] = meta?.schemaVersion?.split('.') || [];
        if (Number(major) >= 3) {
          componentLib['isPlainProps'] = true;
        }
      } catch (e) {}

      try {
        const packageJson = readJsonSync(
          path.join(materialDir, 'package.json')
        );

        if (packageJson.weda?.platform?.web) {
          const entries = packageJson.weda?.platform?.web;
          componentLib['entries'] = {
            entry: path.posix.relative(srcDir, entries.entry),
            components: path.posix.relative(srcDir, entries.components),
            actions: path.posix.relative(srcDir, entries.actions),
          };
        } else if (packageJson.lowcode) {
          const entry = path.posix.relative(srcDir, packageJson.lowcode);
          componentLib['entries'] = {
            entry,
          };
        }
      } catch (e) {}
    })
  );
}

export async function genCompositeComponentLibraries(
  dependencies: IMaterialItem[] = [],
  appBuildDir: string,
  materialGroupInfoMap: {
    [name: string]: {
      isComposite: boolean;
      version?: string;
      entries?: IComponentLibEntry;
      schemaVersion?: string;
      isPlainProps?: boolean;
    };
  } = {},
  componentsInfoMap: IComponentsInfoMap
) {
  await Promise.all(
    dependencies.map(async ({ name, version, components }) => {
      const materialNameVersion = `${name}@${version}`;
      const librariesDir = path.join(
        appBuildDir,
        'src/libraries',
        materialNameVersion
      );
      await Promise.all(
        components.map(async (component) => {
          let compItem = component as ICompositedComponent;
          compItem.materialName = name;
          const wrapperClass = getCompositedComponentClass(
            compItem as ICompositedComponent
          );
          const componentSchemaJson = {
            type: 'object',
            // @ts-ignore
            properties: readCmpInstances(compItem.componentInstances),
          };
          const { widgets, dataBinds, componentSchema } =
            getComponentSchemaString(
              componentSchemaJson,
              true,
              componentsInfoMap,
              wrapperClass
            );
          const templateData = {
            // @ts-ignore
            id: compItem.id,
            name: compItem.name,
            defaultProps: jsonSchemaDefaults({
              type: 'object',
              properties: compItem.dataForm || {},
            }),
            compConfig: compItem.compConfig || {},
            emitEvents: JSON.stringify(
              compItem.emitEvents.map((evt) => evt.eventName)
            ),
            // @ts-ignore
            handlersImports: compItem.lowCodes.filter(
              (codeItem) =>
                codeItem.type === 'handler-fn' &&
                codeItem.name !== '____index____'
            ),
            // @ts-ignore
            useComponents: (function () {
              const list: {
                moduleName;
                name;
                key;
                var: string;
                moduleNameVar: string;
                version: string;
                entries?: IComponentLibEntry;
                isPlainProps?: boolean;
              }[] = [];
              // @ts-ignore
              JSON.stringify(compItem.componentInstances, (key, value) => {
                if (key === 'xComponent') {
                  const { moduleName, name } = value;

                  const compLib = materialGroupInfoMap[moduleName];
                  let isPlainProps = false;
                  if (compLib) {
                    const { schemaVersion = '' } = compLib;
                    try {
                      if (Number(schemaVersion.split('.')?.[0]) >= 3) {
                        isPlainProps = true;
                      }
                    } catch (e) {}
                  }

                  list.push({
                    moduleName,
                    name,
                    key: `${moduleName}:${name}`,
                    var: _.upperFirst(_.camelCase(`${moduleName}:${name}`)),
                    moduleNameVar: _.camelCase(moduleName),
                    version: compLib?.version || '',
                    entries: compLib?.entries,
                    isPlainProps: isPlainProps,
                  });
                }
                return value;
              });
              return _.uniqBy(list, 'key');
            })(),
            widgets,
            dataBinds,
            componentSchema,
            // @ts-ignore
            pageListenerInstances: getListenersString(compItem.listeners, true),
            materialName: name,
          };

          const dest = path.resolve(
            librariesDir,
            `./components/${compItem.name}/index.jsx`
          );
          const template = await fs.readFile(
            path.resolve(appTemplateDir, './src/pages/composite.tpl'),
            {
              encoding: 'utf8',
            }
          );
          const jsx = tpl(template)(templateData);
          await fs.ensureFile(dest);
          await fs.writeFile(dest, jsx);
        })
      );
    })
  );
}
