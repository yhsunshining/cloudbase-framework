// import * as R from 'ramda'
import path from 'path';
import fs from 'fs-extra';
import {
  IComponentInputProps,
  IComponentsInfoMap,
  IPackageJson,
} from '../types/common';
import {
  ICompositedComponent,
  IMaterialItem,
} from '../../weapps-core/types/material';
import { processLess } from './style';
import { writeFile } from './generateFiles';
import { deserializeComponentLibraryMeta } from '@cloudbase/cals';
export {
  getMetaInfoBySourceKey,
  isArray,
  isPlainObject,
  deepDeal,
  simpleDeepClone,
  deepDealSchema,
  getFileNameByUrl,
} from '../../generator/util/common';

import os from 'os';
const homeDir = os.homedir();
const commandConfigPath = path.join(homeDir, '.warc');

export type PromiseResult<T> = Promise<[null, T] | [Error, null]>;
export function promiseWrapper<T>(p: Promise<T>): PromiseResult<T> {
  return new Promise((resolve) => {
    try {
      p.then((i) => resolve([null, i as T])).catch((e) => resolve([e, null]));
    } catch (e) {
      resolve([e, null]);
    }
  });
}

// export function isEmpty(i: any): boolean {
//   if (typeof i === 'string') return !i.trim()
//   return R.isEmpty(i) || R.isNil(i) || Number.isNaN(i)
// }

export function getCurrentPackageJson() {
  try {
    const { name, version } = fs.readJSONSync(
      path.resolve(process.cwd(), 'package.json')
    );
    return {
      name,
      version,
    };
  } catch (e) {}
}

export function getSelfPackageJson(): IPackageJson | undefined {
  try {
    return fs.readJSONSync(path.resolve(__dirname, '../../package.json'));
  } catch (e) {}
}

export function JsonToStringWithVariableName(copyJson: any): string {
  return JSON.stringify(copyJson, null, 2).replace(
    /"%%%(.*?)%%%"/g,
    function (match, expression) {
      return expression
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\r/g, '\r')
        .replace(/\\n/g, '\n');
    }
  );
}

export function requireUncached(module) {
  delete require.cache[require.resolve(module)];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require as any)(module);
}

export function removeRequireUncached(path = '') {
  if (fs.existsSync(path)) {
    delete require.cache[require.resolve(path)];
  }
}

export function getInputProps(
  componentsMetaMap: IComponentsInfoMap
): IComponentInputProps {
  const outputObj = {};
  for (let key in componentsMetaMap) {
    let component = componentsMetaMap[key];
    const sourceKey = key;
    if (component.isComposite) {
      let compItem = component as ICompositedComponent;
      Object.keys(compItem.dataForm || {}).forEach((key) => {
        const inputProps =
          compItem.dataForm[key]?.inputProp ||
          compItem.dataForm[key]?.syncProps;
        if (inputProps) {
          outputObj[sourceKey] = {
            [key]: inputProps,
            ...(outputObj[sourceKey] || {}),
          };
        }
      });
    } else {
      const inputProps =
        component?.meta?.inputProps || component?.meta?.syncProps;
      if (inputProps) {
        outputObj[sourceKey] = inputProps;
      }
    }
  }
  return outputObj;
}

export async function getComponentsInfo(
  appBuildDir: string,
  dependencies: IMaterialItem[]
): Promise<IComponentsInfoMap> {
  const outputObj = {};
  await Promise.all(
    dependencies.map(
      async ({ name: materialName, version, components, isComposite }) => {
        if (isComposite) {
          components.forEach((component) => {
            let compItem = component as ICompositedComponent;
            const sourceKey = `${materialName}:${compItem.name}`;
            outputObj[sourceKey] = {
              isComposite,
              ...compItem,
            };
          });
        } else {
          const materialComponentsPath = path
            .resolve(
              appBuildDir,
              `libraries/${materialName}@${version}/components`
            )
            .replace(/packages\/\w+\//, ''); // HACK：去除子包的目录，找根目录的素材地址。后续提供一个方法获取这些关键路径。

          const componentLibPath = path
            .resolve(appBuildDir, `libraries/${materialName}@${version}`)
            .replace(/packages\/\w+\//, ''); // HACK：去除子包的目录，找根目录的素材地址。后续提供一个方法获取这些关键路径。

          const meta = readComponentLibMata(componentLibPath);

          if (meta) {
            const { components: componentsMap } = meta;
            for (let name in componentsMap) {
              const sourceKey = `${materialName}:${name}`;
              let metaJson = componentsMap[name];
              outputObj[sourceKey] = { isComposite, ...metaJson };
            }
          } else {
            // 老格式，需要从子目录下读取
            const components = await fs.readdir(materialComponentsPath);
            await Promise.all(
              components.map(async (name) => {
                const sourceKey = `${materialName}:${name}`;
                const componentMetaPath = `${materialComponentsPath}/${name}/meta.json`;
                let metaJson = {
                  name,
                  meta: await fs.readJson(componentMetaPath),
                };
                outputObj[sourceKey] = { isComposite, ...metaJson };
              })
            );
          }
        }
      }
    )
  );
  return outputObj;
}

export async function getYyptConfigInfo(extraData: any) {
  let configJson;
  try {
    configJson = await fs.readJSON(commandConfigPath);
  } catch (e) {}
  configJson = configJson || {
    yyptAppKey: '',
    reportUrl: '',
    stopReport: false,
  };
  if (!extraData || !extraData.operationService) {
    extraData = extraData || {};
    extraData.operationService = extraData.operationService || {};
  }

  const yyptAppKey =
    configJson.yyptAppKey || extraData.operationService.extAppId || '';
  const reportUrl =
    configJson.reportUrl || extraData.operationService.reportUrl || '';
  const stopReport =
    configJson.stopReport === 'true' || !extraData.operationService.yyptEnabled;

  return {
    yyptAppKey,
    reportUrl,
    stopReport,
  };
}

export async function writeLibCommonRes2file(
  gItem: IMaterialItem,
  codeDir: string
) {
  const compLibCommonResource = gItem.compLibCommonResource;
  const libCommonResFiles: any[] = [];
  libCommonResFiles.push(
    {
      path: path.join(
        codeDir,
        `class.${codeDir.includes('/mp/') ? 'wxss' : 'less'}`
      ),
      code: compLibCommonResource
        ? await processLess(
            `
        ${compLibCommonResource.theme.variable || ''}
        ${compLibCommonResource.class || ''}
        ${compLibCommonResource.theme.class || ''}
        `
          )
        : '',
    },
    {
      path: path.join(codeDir, 'const.js'),
      code: compLibCommonResource ? compLibCommonResource.const.code : '',
    },
    {
      path: path.join(codeDir, 'tools.js'),
      code: compLibCommonResource ? compLibCommonResource.tools.code : '',
    }
  );
  await Promise.all(
    libCommonResFiles.map((item) => writeFile(item.path, item.code))
  );
}

export function readComponentLibMata(libDir): {
  version?: string;
  schemaVersion?: string;
  styles?: IMaterialItem['styles'];
  dependencies?: IMaterialItem['dependencies'];
  components: {
    [componentName: string]: {
      name: string;
      meta: Object;
    };
  };
} | null {
  let metaPath = path.join(libDir, 'meta.json');
  let isExistsMeta = fs.existsSync(metaPath);

  if (!isExistsMeta) {
    return null;
  }

  let meta = fs.readJSONSync(metaPath);

  let [major] = meta?.schemaVersion?.split('.') || [];
  const originComponentMetaMap = meta.components;

  if (Number(major) >= 2) {
    meta = deserializeComponentLibraryMeta(meta);
  }

  for (let key in meta.components) {
    meta.components[key] = {
      ...originComponentMetaMap[key],
      name: key,
      meta: meta.components[key],
    };
  }

  return meta;
}

const _OFFICIAL_COMPONENT_LIB = {
  'gsd-h5-react': ['0.0.61', '0.0.70'],
  CLOUDBASE_BUSSINESS: ['1627377179261'],
};

export function isOfficialComponentLib(name, version): boolean {
  return (
    !!_OFFICIAL_COMPONENT_LIB[name]?.includes(version) ||
    _OFFICIAL_COMPONENT_LIB[name]?.includes('*')
  );
}
