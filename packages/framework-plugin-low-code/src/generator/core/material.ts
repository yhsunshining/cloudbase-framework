import * as path from 'path';
import {
  getCodeModuleFilePath,
  getCompositedComponentClass,
  IComponentLibEntry,
  ICompositedComponent,
  IMaterialItem,
  IWeAppCode,
  readCmpInstances,
} from '../../weapps-core';
import { camelcase, getComponentsInfo, writeLibCommonRes2file } from '../util';
import { IComponentsInfoMap, IFileCodeMap } from '../types/common';
import { getComponentSchemaString, getListenersString } from './generate';
import templateFileMap from '../template';
import jsonSchemaDefaults from 'json-schema-defaults';
import tpl from 'lodash.template';
import uniqBy from 'lodash.uniqby';
import { processLess } from '../util/style';
import { upperFirst } from 'lodash';

export async function runHandleMaterial(
  appBuildDir: string,
  dependencies: IMaterialItem[] = [],
  i18nConfig: any,
  fileCodeMap: IFileCodeMap,
  isSandbox: boolean
) {
  await handleCompositeComponent({
    dependencies,
    appBuildDir,
    i18nConfig,
    fileCodeMap,
    isSandbox,
  });
}

async function handleCompositeComponent({
  dependencies,
  appBuildDir,
  i18nConfig,
  fileCodeMap,
  isSandbox,
}) {
  const compositeDependencies: IMaterialItem[] = dependencies.filter(
    (item) => item.isComposite
  );
  const materialGroupInfoMap = {};
  dependencies.forEach(
    (item) =>
      (materialGroupInfoMap[item.name] = {
        isComposite: item.isComposite,
        version: item.version,
        entries: item.entries,
        schemaVersion: item.schemaVersion,
      })
  );
  console.log(
    '=====================================*****',
    materialGroupInfoMap
  );
  const componentsInfoMap = await getComponentsInfo(
    path.join(appBuildDir, 'src'),
    dependencies,
    fileCodeMap
  );

  await writeLowCodeFilesForCompositeComp(
    compositeDependencies,
    appBuildDir,
    fileCodeMap,
    isSandbox
  );
  await genCompositeComponentLibraries(
    compositeDependencies,
    appBuildDir,
    materialGroupInfoMap,
    componentsInfoMap,
    i18nConfig,
    fileCodeMap,
    isSandbox
  );
}

export async function writeLowCodeFilesForCompositeComp(
  compositeGroups: IMaterialItem[],
  appBuildDir: string,
  fileMap: any,
  isSandbox: boolean
) {
  await Promise.all(
    compositeGroups.map(async (gItem) => {
      const common = await writeLibCommonRes2file(
        gItem,
        path.join(
          appBuildDir,
          'src',
          'libraries',
          `${gItem.name}@${gItem.version}`,
          'libCommonRes'
        )
      );
      Object.assign(fileMap, common);

      const compLibCommonResource = gItem.compLibCommonResource;
      let themeCode = '';
      if (compLibCommonResource) {
        themeCode = `
          ${compLibCommonResource.theme.variable || ''}
          ${compLibCommonResource.class || ''}
          ${compLibCommonResource.theme.class || ''}
        `;
      }
      await Promise.all(
        gItem.components.map(async (cItem: ICompositedComponent) => {
          generateDefaultLowcodeIndex(cItem);
          return cItem.lowCodes.map(async (m) => {
            const filePath = path.join(
              appBuildDir,
              'src',
              'libraries',
              `${gItem.name}@${gItem.version}`,
              'components',
              cItem.name,
              'lowcode'
            );
            cItem.materialName = gItem.name;
            const fileItem = await writeCode2file(
              m,
              filePath,
              cItem,
              themeCode,
              isSandbox
            );
            Object.assign(fileMap, fileItem);
            return fileMap;
          }, {});
        })
      );

      return fileMap;
    })
  );
  return fileMap;

  async function writeCode2file(
    mod: IWeAppCode,
    lowcodeDir: string,
    comp: ICompositedComponent,
    themeCode?: string,
    isSandbox?: boolean
  ) {
    const pageId = comp.name + '_' + comp.id;
    const file = path.join(
      lowcodeDir,
      getCodeModuleFilePath(pageId, mod, {
        style: '.css',
      })
    );

    let codeContent = '';

    if (mod.type === 'style') {
      codeContent = await processLess(
        // pageId 作为组件样式的 scope
        `.${getCompositedComponentClass(comp)} { \n${
          themeCode ? themeCode : ''
        }\n${mod.code}\n }`
      );
    } else {
      const importApp = !isSandbox
        ? `import { app } from '/src/app/global-api'`
        : `const app = new Proxy({}, {
          get: function(obj, prop){ return window.app ? window.app[prop] : undefined},
          set: function(obj, prop, value){ if(window.app) {return  window.app[prop] = value} else {return undefined } }
        })`;
      codeContent = `${importApp}
      ${mod.code.replace(/\$comp/g, 'this.$WEAPPS_COMP')};`;
    }

    return {
      [file]: {
        code: codeContent,
      },
    };
  }
}

export function generateDefaultLowcodeIndex(data) {
  const lowCodes = data.lowCodes || data.codeModules || [];
  const fileTypes = ['index', 'style', 'state', 'lifecycle', 'computed'];
  fileTypes.map((type) => {
    const isHasLowcodeIndex = lowCodes.find((item) => item.type === type);
    if (!isHasLowcodeIndex) {
      const code = {
        type: type,
        name: type,
        code: type === 'style' ? '' : `export default {}`,
        path: `$comp_1/${type}`,
      };
      lowCodes.unshift(code);
      return code;
    }
  });
}

export async function genCompositeComponentLibraries(
  dependencies: IMaterialItem[] = [],
  appBuildDir: string,
  materialGroupInfoMap: {
    [name: string]: {
      isComposite?: boolean;
      version?: string;
      entries?: IComponentLibEntry;
      schemaVersion?: string;
    };
  } = {},
  componentsInfoMap: IComponentsInfoMap,
  i18nConfig: any,
  fileMap: any,
  isSandbox: boolean
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
        components.map(async (compItem: ICompositedComponent) => {
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
              const list: any[] = [];
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
                    var: upperFirst(camelcase(`${moduleName}:${name}`)),
                    moduleNameVar: camelcase(moduleName),
                    version: compLib?.version,
                    isComposite: compLib?.isComposite,
                    isPlainProps,
                    entries: compLib?.entries,
                  });
                }
                return value;
              });
              return uniqBy(list, 'key');
            })(),
            widgets,
            dataBinds,
            componentSchema,
            // @ts-ignore
            pageListenerInstances: getListenersString(compItem.listeners, true),
            materialName: name,
            hasComponentAPI: compItem.lowCodes.some(
              // @ts-ignore
              (item) => item.type === 'index'
            ),
            isSandbox,
          };

          const dest = path.resolve(
            librariesDir,
            `./components/${compItem.name}/index.jsx`
          );
          const template = templateFileMap['/src/pages/composite.tpl'].code;
          try {
            const jsx = tpl(template, { interpolate: /<%=([\s\S]+?)%>/g })(
              templateData
            );
            fileMap[dest] = {
              code: jsx,
            };
          } catch (e) {
            console.error('>>> template', template, e);
          }
        })
      );
    })
  );
  return fileMap;
}
