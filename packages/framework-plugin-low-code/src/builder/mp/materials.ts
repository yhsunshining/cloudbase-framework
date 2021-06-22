import * as path from 'path';
import { inspect } from 'util';
import * as fs from 'fs-extra';
import {
  IMaterialItem,
  ICompositedComponent,
  IWeAppComponentInstance,
  COMPONENT_API_PREFIX,
  getCompositedComponentClass,
  ICompLibCommonResource,
} from '../../weapps-core';
import {
  materialsDirName,
  sharedMaterialsDir,
  appTemplateDir,
} from '../config';
import {
  getWxmlDataPrefix,
  jsonSchemaType2jsClass,
  builtinMpEvents,
  getClassAttrName,
} from '../config/mp';
import { getCurrentPackageJson } from '../util';
import { IBuildContext } from './BuildContext';
import {
  createWidgetProps,
  createEventHanlders,
  createDataBinds,
} from './util';
import { generateWxml, getUsedComponents } from './wxml';
import generateFiles from '../util/generateFiles';
import { writeCode2file } from './lowcode';
import { downloadZip } from '../util/net';
import NameMangler from '../util/name-mangler';
import { IWeAppData } from '../../weapps-core';
import { IUsedComps } from '../types/common';
import { writeLibCommonRes2file, readComponentLibMata } from '../util';
import * as junk from '../util/junk';

const templateDir = appTemplateDir + '/mp/';

export async function installMaterials(
  projDir: string,
  usedComps: IUsedComps,
  weapps: IWeAppData[],
  ctx: IBuildContext
) {
  let { materialLibs } = ctx;
  const weappsList = ctx.isMixMode
    ? weapps
    : weapps.filter((item) => !item.rootPath);

  // #1 Download uploaded libs
  const localPkg = getCurrentPackageJson();
  await Promise.all(
    materialLibs
      .filter((lib) => !lib.isComposite && usedComps[lib.name])
      .map(async (lib) => {
        const { name, version, mpPkgUrl } = lib;
        let materialsSrcDir = '';
        const materialId = `${name}@${version}`;

        // #1 Download material
        if (localPkg && localPkg.name === name) {
          // If the target materials is current developing one skip download
          materialsSrcDir = path.join(process.cwd(), 'build', 'mp');
        } else {
          materialsSrcDir = path.join(
            sharedMaterialsDir,
            `${name}-mp@${version}`
          );
          await downloadMaterial(mpPkgUrl, materialsSrcDir);
        }

        function libUpdated(libDir: string, version: string) {
          const meta = readComponentLibMata(libDir);

          if (!meta) {
            return true;
          }

          if (meta.version !== lib.version) {
            return true;
          }
        }

        const usingMaterialMap = {};
        // 混合模式下，各个子包获取自己使用过的组件和复合组件（会出现冗余）
        // 统一都放在根目录下，可以减少冗余
        await Promise.all(
          weappsList.map(async (app) => {
            const targetDir = path.join(
              projDir,
              // 统一放在根目录下引用
              // app.rootPath || '',
              materialsDirName,
              name
            );
            if (usingMaterialMap[targetDir]) {
              return;
            } else {
              usingMaterialMap[targetDir] = true;
            }
            if (libUpdated(targetDir, version)) {
              const materialsSrcDirPath = path.join(materialsSrcDir, 'src');
              if (fs.existsSync(materialsSrcDirPath)) {
                console.log(
                  `Copying material ${materialId} from ${materialsSrcDir}/src to ${targetDir}`
                );

                // #2 从根目录 copy meta 文件
                const metaJosnPath = path.join(materialsSrcDir, 'meta.json');
                if (fs.existsSync(metaJosnPath)) {
                  await fs.copy(
                    metaJosnPath,
                    path.join(targetDir, 'meta.json')
                  );
                }

                // #3 copy 组件库代码文件到项目目录
                await fs.copy(materialsSrcDirPath, targetDir, {
                  filter: function (src, dest) {
                    const path = src.split('/');
                    return !junk.is(path[path.length - 1]);
                  },
                });
              } else {
                console.log(
                  `Copying material ${materialId} from ${materialsSrcDir} to ${targetDir}`
                );

                // #2 link material to current project
                await fs.copy(materialsSrcDir, targetDir, {
                  filter: function (src, dest) {
                    const path = src.split('/');
                    return !junk.is(path[path.length - 1]);
                  },
                });
              }
            }

            const libMeta = readComponentLibMata(targetDir);
            if (!lib.components) {
              lib.components = Object.keys(libMeta?.components || {}).map(
                (name) => ({
                  name,
                  meta: libMeta?.components[name]?.meta,
                })
              ) as any;
            }
            lib.styles = libMeta?.styles;
            lib.dependencies = libMeta?.dependencies;
          })
        );
      })
  );

  // clean unused comps
  materialLibs = ctx.materialLibs.filter((lib) => usedComps[lib.name]);
  ctx.materialLibs = materialLibs;
  materialLibs.map((lib) => {
    lib.components = lib.components.filter((comp) =>
      usedComps[lib.name].has(comp.name)
    );
  });

  // populate cmp.materialName
  materialLibs.map((lib) => {
    lib.components.map((comp) => {
      comp.materialName = lib.name;
    });
  });

  // Collection infomation from components to lib meta
  const compositedLibs = materialLibs.filter(
    (lib) => lib.isComposite && usedComps[lib.name]
  );
  compositedLibs.map((lib) => {
    lib.dependencies = lib.dependencies || {};
    lib.components.map((cmp: ICompositedComponent) => {
      cmp.meta.syncProps = {};
      const { dataForm = {} } = cmp;
      for (const prop in dataForm) {
        const { inputProp, syncProp } = dataForm[prop];
        if (syncProp || inputProp) {
          cmp.meta.syncProps[prop] = syncProp || inputProp;
        }
      }

      cmp.meta.platforms = {
        mp: {
          path: cmp.name + '/index',
        },
      };

      lib.dependencies = { ...lib.dependencies, ...cmp.npmDependencies };
    });
  });

  // #2 Generate composited libs
  compositedLibs.map(async (lib) => {
    console.log('Generate composited library ' + lib.name);
    await writeLibCommonRes2file(
      lib,
      path.join(ctx.projDir, materialsDirName, lib.name, 'libCommonRes')
    );
    return lib.components.map((cmp: ICompositedComponent) => {
      weappsList.forEach((app) => {
        generateCompositeComponent(
          cmp,
          {
            ...ctx,
            // 只生成在主目录中，减少冗余
            // rootPath: app.rootPath || '', // 主包是没有 rootPath 的
          },
          lib.compLibCommonResource
        );
      });
    });
  });
}

// 递归查询复合组件所使用的组件
export function extractUsedCompsRecursively(
  comps: IUsedComps,
  checkedComps: ICompositedComponent[],
  compositedLibs: IMaterialItem[],
  outputComps?: IUsedComps
) {
  let usedComps = (outputComps || comps) as IUsedComps;

  const libsUsedByApp = Object.keys(comps);
  libsUsedByApp.forEach((libName) => {
    const cmpNames = comps[libName];
    const lib = compositedLibs.find((lib) => lib.name == libName);
    if (!lib || !lib.isComposite) return;
    cmpNames.forEach((cmpName) => {
      const cmp = lib.components.find(
        (c) => c.name === cmpName
      ) as ICompositedComponent;
      if (!cmp) {
        console.warn('Component not found', libName + ':' + cmpName);
        return;
      }
      if (checkedComps.indexOf(cmp) > -1) return;
      checkedComps.push(cmp);
      const cmpsUsedByThisComp = getUsedComponents(cmp.componentInstances);
      const libs = Object.keys(cmpsUsedByThisComp);
      libs.forEach((libName) => {
        if (!usedComps[libName]) {
          usedComps[libName] = cmpsUsedByThisComp[libName];
        } else {
          cmpsUsedByThisComp[libName].forEach((n) => usedComps[libName].add(n));
        }
      });
      extractUsedCompsRecursively(
        cmpsUsedByThisComp,
        checkedComps,
        compositedLibs,
        usedComps
      );
    });
  });

  return usedComps;
}

async function downloadMaterial(zipUrl: string, dstFolder: string) {
  if (
    fs.existsSync(path.join(dstFolder, 'meta.json')) ||
    fs.existsSync(path.join(dstFolder, 'mergeMeta.json'))
  )
    return;
  await downloadZip(zipUrl, dstFolder);
}

async function generateCompositeComponent(
  compositedComp: ICompositedComponent,
  ctx: IBuildContext,
  compLibCommonResource?: ICompLibCommonResource
) {
  const { materialName } = compositedComp;
  const outDir = path.join(
    ctx.projDir,
    ctx.rootPath || '', // 混合模式下，可能会有 rootPath
    materialsDirName,
    materialName,
    compositedComp.name
  );
  console.log(
    `Generating composited component ${materialName}:${compositedComp.name} to ${outDir}`
  );

  const wxmlDataPrefix = getWxmlDataPrefix(!ctx.isProduction);
  // # Generating page
  const usingComponents = {};
  const cmpContainer = Object.values(compositedComp.componentInstances)[0];
  const wxml = generateWxml(
    compositedComp.componentInstances,
    'Component ' + materialName + ':' + compositedComp.name,
    wxmlDataPrefix,
    { ...ctx, isPage: false },
    usingComponents,
    (cmp, node) => {
      if (cmp === cmpContainer) {
        // Set className & style passed from parent for root component
        const { attributes } = node;
        const classAttrName = getClassAttrName(node.name);
        const oldClass = attributes[classAttrName];
        attributes[classAttrName] =
          getCompositedComponentClass(compositedComp) +
          ' ' +
          oldClass +
          ' {{className}}';
        attributes.style += ';{{style}}';
      }
    }
  );

  // prepare form field change events
  const { syncProps } = compositedComp.meta;
  const formEvents = {};
  Object.keys(syncProps).map((prop) => {
    const config = syncProps[prop];
    const configs = Array.isArray(config) ? config : [config];

    configs.forEach(({ changeEvent, valueFromEvent, isFormField }) => {
      if (isFormField) {
        formEvents[changeEvent] = valueFromEvent;
      }
    });
  });

  const pageFileData = {
    'index.js': {
      materialName: materialName,
      propDefs: compositedComp.dataForm,
      handlers: compositedComp.lowCodes
        .filter((m) => m.type === 'handler-fn' && m.name !== '____index____')
        .map((m) => m.name),
      eventHandlers: createEventHanlders(
        compositedComp.componentInstances,
        COMPONENT_API_PREFIX,
        ctx
      ),
      // protectEventKeys: builtinMpEvents,
      emitEvents: compositedComp.emitEvents.map((evt) => evt.eventName),
      widgetProps: createWidgetProps(compositedComp.componentInstances, ctx),
      compApi: COMPONENT_API_PREFIX,
      jsonSchemaType2jsClass,
      key: compositedComp.materialName + ':' + compositedComp.name,
      dataBinds: createDataBinds(compositedComp.componentInstances, ctx),
      debug: !ctx.isProduction,
      stringifyObj: inspect,
      // dataPropNames: wxmlDataPrefix,
      formEvents: Object.keys(formEvents).length > 0 ? formEvents : null,
      config: compositedComp.compConfig,
    },
    'index.json': { usingComponents },
    'index.wxml': {
      // raw: JSON.stringify(page.componentInstances),
      // wrapperClass: getCompositedComponentClass(compositedComp),
      content: wxml,
    },
    'index.wxss': {},
  };
  // Generating file by template and data
  await generateFiles(pageFileData, templateDir + '/component', outDir, ctx);

  // #3 writing lowcode files
  const codes = [...compositedComp.lowCodes];
  if (!codes.find((m) => m.name === 'index')) {
    // @ts-ignore
    codes.push({
      code: 'export default {}',
      name: 'index',
      path: 'index',
    });
  }

  codes
    .filter((mod) => mod.name !== '____index____')
    .map((mod) => {
      let themeCode;
      if (mod.type === 'style' && compLibCommonResource) {
        themeCode = `
         ${compLibCommonResource.theme.variable || ''}
         ${compLibCommonResource.class || ''}
         ${compLibCommonResource.theme.class || ''}
      `;
      }
      return writeCode2file(
        mod,
        path.join(outDir, 'lowcode'),
        { comp: compositedComp },
        themeCode,
        ctx
      );
    });
  // await writeLowCodeFiles(weapp, appRoot)
  // await generateFramework(weapp, appRoot)
}

/**
 * {
 * gsd: {
 * input: 'input'
 * }
 * }
 */
export function getWxmlTag(
  cmp: Required<IWeAppComponentInstance>['xComponent'],
  ctx: IBuildContext,
  nameMangler?: NameMangler
) {
  const { moduleName, name } = cmp;
  const cmpMeta = ctx.materialLibs
    .find((lib) => lib.name === moduleName)
    ?.components?.find((comp) => comp.name === name)?.meta || {
    platforms: undefined,
  };

  if (!cmpMeta?.platforms) {
    return { tagName: name.toLocaleLowerCase() };
  }
  let { tagName, path: compPath } = cmpMeta?.platforms?.mp || {};
  if (compPath) {
    // 小程序混合模式时，组件库会存在子包内
    // 组件库永远都在根目录下，这样才能减少冗余 - royhyang
    const rootPath = ctx.rootPath || '';
    compPath = compPath.startsWith('/')
      ? compPath
      : `${/*ctx.isMixMode ? '/' + rootPath : */ ''}/${materialsDirName}/${
          cmp.moduleName
        }/${compPath}`;
    tagName = moduleName + '-' + name;
    if (nameMangler) {
      tagName = nameMangler.mangle(tagName);
    }
  }
  if (!tagName) {
    // console.error('No wml tagName provided for ', cmp.moduleName, cmp.name)
    tagName = name.toLocaleUpperCase();
  }
  return {
    tagName,
    path: compPath,
  };
}
