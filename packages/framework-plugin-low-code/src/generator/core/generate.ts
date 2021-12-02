import {
  ActionType,
  getCodeModuleFilePath,
  IComponentInstanceProps,
  IComponentSchemaJson,
  IDataBind,
  IListenerInstance,
  IMaterialItem,
  IPageInstance,
  isEmptyObj,
  IWeAppCode,
  IWebRuntimeAppData,
  PropBindType,
  toCssStyle,
  toCssText,
  IExtraData,
  IBuildType,
  IWeAppComponentInstance,
  IComponentLibEntry,
} from '../../weapps-core';
import {
  buildAsAdminPortalByBuildType,
  IComponentsInfoMap,
  IFileCodeMap,
  ISyncProp,
} from '../types/common';
import path from 'path';
import templateFileMap from '../template';
import {
  cleanVarName,
  deepDealComponentSchemaJson,
  deepDealSchema,
  getInputProps,
  getComponentsInfo,
  getMetaInfoBySourceKey,
  getYyptConfigInfo,
  JsonToStringWithVariableName,
  simpleDeepClone,
  upperFirst,
} from '../util';
import { REPLACE_SIGN } from '../config';
import os from 'os';
import { Schema } from '@formily/react-schema-renderer';
import {
  defaultThemeCode,
  generateDefaultStyle,
  generateDefaultTheme,
  processLess,
} from '../util/style';
import tpl from 'lodash.template';
import chalk from 'chalk';
import { DEPLOY_MODE, RUNTIME } from '../../types';
import {
  getDatasetProfiles,
  getDatasourceProfiles,
} from '../../utils/dataSource';

export async function runGenerateCore(props: {
  appBuildDir: string;
  appData: IWebRuntimeAppData;
  subAppDataList: IWebRuntimeAppData[];
  dependencies: IMaterialItem[];
  appKey: string;
  buildTypeList: IBuildType[];
  basename: string; // browser Router 里指定的basename
  deployMode: DEPLOY_MODE;
  runtime: RUNTIME;
  ignoreInstall: boolean;
  extraData: {
    isComposite: boolean;
    compProps: any;
  };
  i18nConfig: any;
  fileCodeMap: IFileCodeMap;
  isSandbox: boolean;
}) {
  const {
    appBuildDir,
    appData,
    subAppDataList = [],
    dependencies = [],
    buildTypeList,
    appKey,
    basename,
    extraData = {
      isComposite: false,
      compProps: {},
    },
    i18nConfig,
    fileCodeMap,
    isSandbox = false,
    deployMode,
    runtime = RUNTIME.NONE,
    ignoreInstall = false,
  } = props;
  const { domain } = appData.extra;

  const allAppDataList = [appData].concat(subAppDataList);

  // 安装插件依赖
  const deps = {};
  allAppDataList.map((app) => {
    Object.entries(app.npmDependencies).forEach(([name, version]) => {
      deps[name] = version;
    });
  });

  // 合并组件库的公共npm
  dependencies.map((compLb) => {
    if (compLb.isComposite && compLb.compLibCommonResource) {
      Object.assign(deps, compLb.compLibCommonResource.npm);
    }
  });

  await Promise.all(
    allAppDataList.map(async (data) => {
      const { pageInstanceList, rootPath = '' } = data;
      console.log(
        chalk.blue.bold(
          `Generating files for ${
            rootPath ? 'Sub app ' + rootPath : 'Main app'
          }`
        )
      );
      const dstDir = path.join(
        appBuildDir,
        'src',
        rootPath ? `packages/${rootPath}` : ''
      );
      await Promise.all(
        pageInstanceList.map((pageInstance) =>
          generateSinglePageJsxFile(
            pageInstance,
            appBuildDir,
            rootPath,
            dependencies,
            extraData,
            fileCodeMap,
            isSandbox
          )
        )
      );
      await generateCodeFromTpl(
        appKey,
        data,
        dstDir,
        rootPath,
        extraData,
        i18nConfig,
        fileCodeMap,
        isSandbox,
        subAppDataList,
        buildTypeList,
        deployMode,
        domain
      );
      await writeLowCodeFiles(data, dstDir, fileCodeMap, rootPath);
    })
  );
  await generateRouterFile(
    allAppDataList,
    appBuildDir,
    basename,
    fileCodeMap,
    isSandbox
  );
}

/**
 * 根据复合组件库获取到所有包含抽象节点的数据
 * @param dependencies
 * @returns
 */
function getGenericCompFromDep(dependencies: IMaterialItem[] = []) {
  const genericCompMap: Record<string, IWeAppComponentInstance['genericComp']> =
    {};
  dependencies.forEach((compLib) => {
    if (compLib.isComposite) {
      compLib.components.forEach((component) => {
        deepDealComponentSchemaJson(
          Object.values(component.componentInstances)[0],
          (componentSchema) => {
            if (componentSchema?.genericComp) {
              genericCompMap[`${component.materialName}:${component.name}`] =
                componentSchema.genericComp;
            }
          }
        );
      });
    }
  });
  return genericCompMap;
}

export interface IOriginKeyInfo {
  sourceKey: string;
  name: string;
  materialName: string;
  materialVersion: string;
  key: string;
  variableName: string;
  type?: ActionType;
  isComposite?: boolean;
  isPlainProps?: boolean;
  entries?: IComponentLibEntry;
}

export async function generateSinglePageJsxFile(
  pageInstance: IPageInstance,
  appBuildDir: string,
  rootPath: string,
  dependencies: IMaterialItem[] = [],
  extraData: {
    isComposite: boolean;
    compProps: any;
  } = {
    isComposite: false,
    compProps: {},
  },
  fileCodeMap: IFileCodeMap,
  isSandbox: boolean
) {
  const dstDir = path.join(
    appBuildDir,
    'src',
    rootPath ? `packages/${rootPath}` : ''
  );
  const { componentSchemaJson, data, style } = pageInstance;

  const genericCompMap = getGenericCompFromDep(dependencies);

  // originComponentList 包含了引入的组件与抽象节点绑定的组件
  const { originComponentList, originActionList } =
    getOriginComponentAndActionList(
      componentSchemaJson as IComponentSchemaJson,
      dependencies,
      [],
      [],
      genericCompMap
    );

  // @ts-ignore
  const componentInfo = await getComponentsInfo(
    appBuildDir,
    dependencies,
    fileCodeMap
  );
  const { widgets, dataBinds, componentSchema } = getComponentSchemaString(
    componentSchemaJson as IComponentSchemaJson,
    false,
    componentInfo
  );

  const pageClass = [rootPath, pageInstance.id].filter(Boolean).join('-');
  const templateData = {
    upperFirst,
    cleanVarName,
    isSandbox,
    pageName: pageInstance.id,
    pageStyleText: toCssText(toCssStyle(style), `body`),
    useComponents: originComponentList,
    useActions: originActionList.filter(
      (action) => action.type === ActionType.Material
    ),
    componentSchema,
    widgets,
    dataBinds,
    pageClass,
    // 复合组件预览需要
    isComposite: extraData.isComposite,
    compProps: extraData.compProps,
    title: data.navigationBarTitleText || data.title || '',
  };

  const dest = path.join(dstDir, `/pages/${pageInstance.id}/index.jsx`);
  const template = templateFileMap[`/src/pages/app.tpl`];
  const jsx = tpl(template.code, { interpolate: /<%=([\s\S]+?)%>/g })(
    templateData
  );
  fileCodeMap[dest] = {
    code: jsx,
  };
}

export function getOriginComponentAndActionList(
  componentSchema: IComponentSchemaJson,
  dependencies: IMaterialItem[],
  originComponentList: IOriginKeyInfo[] = [],
  originActionList: IOriginKeyInfo[] = [],
  genericCompMap: Record<string, IWeAppComponentInstance['genericComp']> = {}
) {
  const fieldSchema = new Schema(componentSchema);
  if (fieldSchema.isObject()) {
    const { 'x-props': xProps } = fieldSchema;
    if (xProps) {
      const { listenerInstances, sourceKey } =
        xProps as IComponentInstanceProps;

      // 属于抽象节点属性
      if (genericCompMap[sourceKey]) {
        const genericProps = genericCompMap[sourceKey];
        // @ts-ignore
        const genericComp = xProps.data[genericProps.propName];
        pullComponentToListByInstance(
          genericComp,
          originComponentList,
          dependencies
        );
      }
      pullComponentToListByInstance(
        sourceKey,
        originComponentList,
        dependencies
      );
      pullActionToListByInstances(
        listenerInstances,
        originActionList,
        dependencies
      );
    }

    const filedSchemaProperties = fieldSchema.properties || {};
    Object.keys(filedSchemaProperties).forEach((key) => {
      const schema = filedSchemaProperties[key];
      const schemaJson = schema as unknown as IComponentSchemaJson;
      getOriginComponentAndActionList(
        schemaJson,
        dependencies,
        originComponentList,
        originActionList,
        genericCompMap
      );
    });
  }

  return {
    originComponentList,
    originActionList,
  };
}

export function pullActionToListByInstances(
  listenerInstances,
  originActionList,
  fixedDependencies: (IMaterialItem & {
    isPlainProps?: boolean;
    entries?: IComponentLibEntry;
  })[]
) {
  if (!listenerInstances || !listenerInstances.length) {
    return;
  }
  listenerInstances.map((pageListenerInstance: IListenerInstance) => {
    const { sourceKey, type } = pageListenerInstance;
    const { materialName, name, variableName } =
      getMetaInfoBySourceKey(sourceKey);
    const material = fixedDependencies.find((m) => m.name === materialName);
    const actionKey = `${materialName}_${name}`;
    const isExistAction = originActionList.find(
      (item: IOriginKeyInfo) => item.key === actionKey
    );
    if (!isExistAction) {
      originActionList.push({
        name,
        materialName,
        materialVersion: material?.version,
        key: actionKey,
        type,
        variableName,
        entries: material?.entries,
      });
    }
  });
}

export function pullComponentToListByInstance(
  sourceKey: string,
  originComponentList: IOriginKeyInfo[],
  fixedDependencies: IMaterialItem[]
) {
  const { materialName, name, variableName } =
    getMetaInfoBySourceKey(sourceKey);
  const componentKey = `${materialName}_${name}`;
  const isExistComponent = originComponentList.find(
    (item: IOriginKeyInfo) => item.key === componentKey
  );
  if (!isExistComponent) {
    const foundOne = fixedDependencies.find((m) => m.name === materialName);
    if (!foundOne) return;

    const { schemaVersion = '' } = foundOne;
    let isPlainProps = false;
    try {
      if (Number(schemaVersion.split('.')?.[0]) >= 3) {
        isPlainProps = true;
      }
    } catch (e) {}

    originComponentList.push({
      sourceKey,
      name: name || '',
      materialName: materialName || '',
      materialVersion: foundOne.version,
      isComposite: foundOne.isComposite,
      key: componentKey,
      variableName: variableName || '',
      isPlainProps,
      entries: (foundOne as IMaterialItem & { entries?: IComponentLibEntry })
        ?.entries,
    });
  }
}

export function isSlot(comp: Schema) {
  return comp.path && !comp['x-props'];
}

export function getComponentSchemaString(
  componentSchema: IComponentSchemaJson,
  isComposite = false,
  componentsInfoMap: IComponentsInfoMap = {},
  wrapperClass?: string
) {
  const componentInputProps = getInputProps(componentsInfoMap) || {};
  const copyJson = simpleDeepClone<IComponentSchemaJson>(componentSchema);
  const compWidgets = {};
  const compDataBinds = {};
  const componentSchemaJson = deepDealSchema(copyJson, (schema) => {
    const { 'x-props': xProps = {}, properties } = schema;
    const {
      dataBinds = [],
      commonStyle = {},
      data = {},
      classNameList = [],
      sourceKey,
      styleBind,
      classNameListBind,
    } = xProps;

    const componentInfo = componentsInfoMap[sourceKey];
    if ((componentInfo as any)?.events) {
      schema['emitEvents'] = (componentInfo as any)?.events.map(
        (item) => item.name
      );
    } else if ((componentInfo as any)?.emitEvents) {
      schema['emitEvents'] = (componentInfo as any).emitEvents.map(
        (item) => item.eventName
      );
    }

    // 生成 widgets/dataBinds
    if (!isSlot(schema) && schema.key) {
      const parentSchema: Schema = schema.parent as Schema;
      compWidgets[schema.key] = {
        ...data,
        style: toCssStyle(commonStyle),
        classList: classNameList,
        widgetType: sourceKey,
        _parentId: isSlot(parentSchema)
          ? parentSchema.parent?.key
          : parentSchema.key,
      };
      if (dataBinds.length > 0) {
        compDataBinds[schema.key] = generateDataBinds(dataBinds, isComposite);
      }
      if (styleBind) {
        if (!styleBind.bindDataPath) {
          console.warn('无 bindDataPath', xProps);
        } else {
          styleBind.propertyPath = 'style';
          compDataBinds[schema.key] = {
            ...(compDataBinds[schema.key] || {}),
            ...generateDataBinds([styleBind], isComposite),
          };
        }
      }
      if (classNameListBind) {
        classNameListBind.propertyPath = 'classList';
        compDataBinds[schema.key] = {
          ...(compDataBinds[schema.key] || {}),
          ...generateDataBinds([classNameListBind], isComposite),
        };
      }
    }

    // 抽离 widgets/dataBinds 后不再需要存储
    delete xProps.data;
    delete xProps.dataTypes;
    delete xProps.dataBinds;
    delete xProps.styleBind;
    delete xProps.classNameListBind;

    // 针对 JSON 体积做优化
    if (properties && isEmptyObj(properties)) {
      delete schema.properties;
    }
    delete schema.type;

    if (xProps) {
      // 如果是复合组件的根节点，则补充 wrapperClass
      if (isComposite) {
        if (!schema.parent?.parent) {
          if (!xProps['classNameList']) xProps['classNameList'] = [];
          xProps['classNameList'].push(wrapperClass);
        }
      }

      xProps['commonStyle'] = toCssStyle(xProps['commonStyle']);

      if (isEmptyObj(xProps['commonStyle'])) {
        delete xProps['commonStyle'];
      }
      if (isEmptyObj(xProps['style'])) {
        delete xProps['style'];
      }
      if (xProps['dataBinds'] && xProps['dataBinds'].length === 0) {
        delete xProps['dataBinds'];
      }
      if (
        xProps['listenerInstances'] &&
        xProps['listenerInstances'].length === 0
      ) {
        delete xProps['listenerInstances'];
      }
      if (xProps['data']) {
        const xPropsData = xProps['data'];
        if (xPropsData._waFor && xPropsData._waFor.length === 0) {
          delete xPropsData._waFor;
        }
        if (xPropsData.title === '') {
          delete xPropsData.title;
        }
        if (isEmptyObj(xPropsData)) {
          delete xProps['data'];
        }
      }

      if (xProps.listenerInstances) {
        xProps.listenerInstances = generateListnerInstances(
          xProps.listenerInstances,
          isComposite
        );
      }

      // 组件双向绑定
      const syncProps = componentInputProps[xProps.sourceKey];
      if (syncProps) {
        if (!xProps.listenerInstances) xProps.listenerInstances = [];
        Object.keys(syncProps).forEach((key) => {
          let syncPropArr: ISyncProp[] = [];
          const syncProp = syncProps[key];

          // 统一转成数组处理
          if (!Array.isArray(syncProp)) {
            syncPropArr = [syncProp];
          }

          syncPropArr.forEach(({ changeEvent, valueFromEvent }) => {
            // 双向绑定需要优先第一个执行，否则会出现输入框的拼音被打断的问题
            xProps.listenerInstances.unshift({
              trigger: changeEvent,
              instanceFunction: `${REPLACE_SIGN}function({ event, forItems }) {
    const $for = forItems;
    const wid = ${isComposite ? 'this.widgets' : '$page.widgets'}.${schema.key};
    const widgetData = (forItems.forIndexes && forItems.forIndexes.length > 0) ? get(wid, forItems.forIndexes) : wid;
    widgetData.${key} = ${valueFromEvent};
  }.bind(this)${REPLACE_SIGN}`,
            });
          });
        });
      }

      if (xProps.dataBinds) {
        xProps.dataBinds = generateDataBinds(xProps.dataBinds, isComposite);
      }

      if (xProps.styleBind) {
        xProps.styleBind = generateDataBinds([xProps.styleBind], isComposite);
      }

      if (xProps.classNameListBind) {
        xProps.classNameListBind = generateDataBinds(
          [xProps.classNameListBind],
          isComposite
        );
      }
    }
  });

  return {
    widgets: JsonToStringWithVariableName(compWidgets, { EOL: false }),
    dataBinds: JsonToStringWithVariableName(compDataBinds, { EOL: true }),
    componentSchema: JsonToStringWithVariableName(componentSchemaJson, {
      EOL: true,
    }),
  };
}

// convert data binds to functions for performance & simplicity
function generateDataBinds(dataBinds, isComposite: boolean) {
  const dataBindFuncs = {};
  dataBinds.forEach((bind: IDataBind) => {
    if (!bind.bindDataPath) {
      return console.warn('无 bindDataPath', bind.propertyPath);
    }
    let funcCode = '()=>{}';
    if (bind.type === PropBindType.forItem) {
      funcCode = `(forItems) => forItems.${bind.bindDataPath}`;
    } else if (bind.type === PropBindType.scope) {
      funcCode = `() => ({__type: "scopedValue", getValue: ($scope)=>$scope.${bind.bindDataPath}})}`;
    } else if (bind.type === PropBindType.expression) {
      if (isComposite) {
        funcCode = `(forItems) => {const $for = forItems; return (${bind.bindDataPath
          .replace(/\$comp/g, 'this.$WEAPPS_COMP')
          .replace(/;$/, '')})}`;
      } else {
        const code = bind.bindDataPath.replace(/;$/, '');
        funcCode = /\$scope\./.test(code)
          ? `(forItems, event) => ({__type: "scopedValue", getValue: ($scope) => { const $for = forItems;return (${code})}})`
          : `(forItems, event) => { const $for = forItems;return (${code})}`;
      }
    } else if (bind.type === PropBindType.prop) {
      let bindDataPath = bind.bindDataPath;
      const isNegated = bindDataPath.startsWith('!');
      if (isNegated) bindDataPath = bindDataPath.replace(/^!/, '');
      if (isComposite) {
        // 复合组件在预览时其实就是page，所以沿用page的变量即可
        funcCode = `() => ${
          isNegated ? '!' : ''
        }${'this.$WEAPPS_COMP'}.props.data.${bindDataPath}`;
      } else {
        // 复合组件在预览时其实就是page，所以沿用page的变量即可
        funcCode = `() => ${
          isNegated ? '!' : ''
        }$page.props.data.${bindDataPath}`;
      }
    } else {
      const PREFIX_MAP = {
        [PropBindType.state]: 'state',
        [PropBindType.computed]: 'computed',
        [PropBindType.dataVar]: 'dataVar',
        [PropBindType.stateData]: 'dataset.state',
        [PropBindType.paramData]: 'dataset.params',
      };
      switch (bind.type) {
        case PropBindType.state:
        case PropBindType.computed:
        case PropBindType.dataVar:
        case PropBindType.stateData:
        case PropBindType.paramData: {
          if (bind.bindDataPath.startsWith('global.')) {
            funcCode = bind.bindDataPath.replace(
              /^global./,
              `app.${PREFIX_MAP[bind.type]}.`
            );
          } else {
            if (isComposite) {
              funcCode = bind.bindDataPath
                .replace(
                  /^comp-\w+./,
                  `this.$WEAPPS_COMP.${PREFIX_MAP[bind.type]}.`
                )
                .replace(
                  /^\$\w+_\d+./,
                  `this.$WEAPPS_COMP.${PREFIX_MAP[bind.type]}.`
                );
            } else {
              funcCode = bind.bindDataPath.replace(
                /^\w+./,
                `$page.${PREFIX_MAP[bind.type]}.`
              );
            }
          }
          funcCode = `() => ${funcCode}`;

          break;
        }
      }
    }
    dataBindFuncs[
      bind.propertyPath
    ] = `${REPLACE_SIGN}${funcCode}${REPLACE_SIGN}`;
  });
  return dataBindFuncs;
}

function generateListnerInstances(
  listenerInstances: IListenerInstance[],
  isComposite = false
) {
  return listenerInstances.map((listener: IListenerInstance) => {
    const generatedListener: any = {
      key: listener.key,
      trigger: listener.trigger,
      isCapturePhase: listener.isCapturePhase,
      noPropagation: listener.noPropagation,
    };
    if (listener.type === ActionType.Material) {
      const { sourceKey } = listener;
      const { variableName } = getMetaInfoBySourceKey(sourceKey);
      generatedListener.instanceFunction = `${REPLACE_SIGN}${variableName}${REPLACE_SIGN}`;
    } else if (listener.type === ActionType.PropEvent) {
      if (isComposite) {
        generatedListener.instanceFunction = `${REPLACE_SIGN}function({ data, event, forItems }) {
          event.detail.data = data;
          this.props.emit('${
            listener.handler?.name || listener.jsCode
          }', event.detail);
        }.bind(this)${REPLACE_SIGN}`;
      } else {
        generatedListener.instanceFunction = `${REPLACE_SIGN}function(...args) { $page.props.events.${
          listener.handler?.name || listener.jsCode
        }.apply(null, args) }${REPLACE_SIGN}`;
      }
    } else if (listener.type === ActionType.Inline) {
      // 内联 handler
      if (isComposite) {
        generatedListener.instanceFunction = `${REPLACE_SIGN}function({event, domEvent, customEventData, data, forItems}) {
          return ${listener.jsCode}
        }.bind(this)${REPLACE_SIGN}`;
      } else {
        generatedListener.instanceFunction = `${REPLACE_SIGN}function({event, domEvent, customEventData, data, forItems}) {
          return ${listener.jsCode}
        }.bind(pageCodeContext)${REPLACE_SIGN}`;
      }
    } else if (listener.type === ActionType.Platform) {
      let name = listener.handler?.name || listener.jsCode;
      generatedListener.instanceFunction = `${REPLACE_SIGN}function({data}) { return app.${name}(data) }${REPLACE_SIGN}`;
    } else if (listener.type === ActionType.DataSource) {
      generatedListener.instanceFunction = `${REPLACE_SIGN}function({data}) { return app.cloud.callDataSource(data) }${REPLACE_SIGN}`;
    } else {
      // Lowcode action(handler)
      if (isComposite) {
        generatedListener.instanceFunction = `${REPLACE_SIGN}this.handler.${
          listener.handler?.name || listener.jsCode
        }.bind(this)${REPLACE_SIGN}`;
      } else {
        let name = listener.handler?.name || listener.jsCode;
        generatedListener.instanceFunction = `${REPLACE_SIGN}handler.${name}.bind(pageCodeContext)${REPLACE_SIGN}`;
      }
    }
    if (!isEmptyObj(listener.data)) {
      generatedListener.data = listener.data;
    }
    if (listener.dataBinds && listener.dataBinds.length > 0) {
      generatedListener.dataBinds = generateDataBinds(
        listener.dataBinds,
        isComposite
      );
    }

    return generatedListener;
  });
}

export function getListenersString(
  listeners: IListenerInstance[] = [],
  isComposite = false
) {
  return JsonToStringWithVariableName(
    generateListnerInstances(listeners, isComposite),
    {
      EOL: true,
    }
  );
}

export async function generateRouterFile(
  allAppDataList: IWebRuntimeAppData[],
  appBuildDir: string,
  basename = '',
  fileCodeMap: IFileCodeMap,
  isSandbox
) {
  const routerImports: string[] = [];
  const routerRenders: string[] = [];
  const mountApis: string[] = [];
  let homePageId = '';
  await Promise.all(
    allAppDataList.map(async (data) => {
      const { pageInstanceList, rootPath = '' } = data;
      const pageFilePath = rootPath ? `/src/packages/${rootPath}/` : '/src/';
      // 判断app环境才进行加载引入
      pageInstanceList.map((pageInstance: any) => {
        const pageId = [rootPath, pageInstance.id].filter((i) => !!i).join('_');
        const pagePath = rootPath
          ? `${rootPath}/${pageInstance.id}`
          : `${pageInstance.id}`;

        if (pageInstance.isHome && !rootPath) {
          homePageId = pageId;
          routerRenders.push(`<Redirect from="/" exact to="/${pageId}"/>`);
        }
        if (pageInstance.isHome && rootPath) {
          routerRenders.push(
            `<Redirect from="/${rootPath}" exact to="/${pagePath}"/>`
          );
        }
        if (isSandbox) {
          routerImports.push(
            `import Page${pageId} from '${pageFilePath}pages/${pageInstance.id}/index';`
          );
        } else {
          routerImports.push(
            `const Page${pageId} = React.lazy(() => import('${pageFilePath}pages/${pageInstance.id}/index'));`
          );
        }

        // Route 这里需要加 () => <Pageexample /> 才能触发热更新，具体原因还没查
        routerRenders.push(
          `<Route path="/${pagePath}" component={() => <Page${pageId} />}/>`
        );
      });
    })
  );
  const routerTemplate = templateFileMap['/src/router/index.tpl'].code;
  const routerIndexStr = tpl(routerTemplate, {
    interpolate: /<%=([\s\S]+?)%>/g,
  })({
    routerImports: routerImports.join('\n'),
    routerRenders: routerRenders.join('\n'),
    mountApis: mountApis.join('\n'),
    basename: basename,
    homePageId,
    isHash: isSandbox,
  });
  const dest = path.resolve(appBuildDir, `src/router/index.jsx`);
  fileCodeMap[dest] = {
    code: routerIndexStr,
  };
}

export async function writeLowCodeFiles(
  appData: IWebRuntimeAppData,
  appBuildDir: string,
  fileCodeMap: IFileCodeMap,
  rootPath: string
) {
  const lowcodeRootDir = path.join(appBuildDir, 'lowcode');
  generateDefaultTheme(appData);
  generateDefaultLifecycle(appData);
  const themeCode = appData.codeModules.find((mod) => mod.type === 'theme');
  await Promise.all(
    appData.codeModules.map((m) => writeCode2file(m, 'global'))
  );
  await Promise.all(
    appData.pageInstanceList.map(async (page) => {
      generateDefaultStyle(page);
      await page.codeModules
        .filter((m) => m.name !== '____index____')
        .forEach((m) => writeCode2file(m, page.id, page));
    })
  );

  async function writeCode2file(mod: IWeAppCode, pageId: string, page?) {
    const file = path.join(
      lowcodeRootDir,
      getCodeModuleFilePath(pageId, mod, {
        style: '.css',
      })
    );
    let code = mod.code || '';
    let weappsApiPrefix = '';

    if (mod.type !== 'theme' && mod.type !== 'style') {
      const isIncludeAppDot = !!code
        // 先去掉模板代码
        .replace('通过 app.common.[name].xxx 访问这里定义的方法或值', '')
        // 再匹配
        .match(/[^'"\w]?app[^'"\w]/g);

      if (isIncludeAppDot) {
        weappsApiPrefix = `import { app } from '${path
          .relative(path.dirname(file), appBuildDir + '/app/global-api')
          .replace(/\\/g, '/')}';`;
      }
    }

    if (mod.type === 'style') {
      // 生成页面样式
      let pageStyleString = '';
      if (page) {
        const pageClass = [rootPath, page.id].filter(Boolean).join('-');
        pageStyleString = toCssText(
          toCssStyle(page.style),
          `.weapps-page-${pageClass}`
        );
      }
      code = await processLess((themeCode?.code || defaultThemeCode) + code);
      // 页面类的样式通过注入css标签的方式挂载到body上
      // 此处不采用这种方式是为了防止 body.width 50% pagecontainer.width 50% 情况的出现
      // 期望是半屏，结果四分之一屏了
      // code = pageStyleString + os.EOL + code;
    }

    if (mod.type === 'theme') {
      return;
    }

    fileCodeMap[file] = {
      code: weappsApiPrefix + os.EOL + code.replace(/\$page/g, 'this.$page'),
    };
  }
}

function generateDefaultLifecycle(data) {
  const lowCodes = data.lowCodes || data.codeModules || [];
  const isHas = lowCodes.find((item) => item.type === 'lifecycle');
  if (!isHas) {
    const themeStyle = {
      type: 'lifecycle',
      name: 'lifecycle',
      code: `export default {}`,
      path: `global/lifecycle`,
      system: true,
    };
    lowCodes.unshift(themeStyle);
    return themeStyle;
  }
  return isHas;
}

export async function generateCodeFromTpl(
  /**
   * 应用ID
   */
  appKey: string,
  /**
   * 应用数据
   */
  appData: IWebRuntimeAppData,
  appBuildDir: string,
  rootPath: string,
  extraData: IExtraData,
  i18nConfig: any,
  fileCodeMap: IFileCodeMap,
  isSandbox: boolean,
  subAppDataList: IWebRuntimeAppData[],
  buildTypeList: IBuildType[],
  deployMode: DEPLOY_MODE,
  /**
   * 静态域名
   */
  domain: string
) {
  const pageIds: string[] = [];
  const pageModules = {};
  appData.pageInstanceList.map((p) => {
    pageIds.push(p.id);
    pageModules[p.id] = p.codeModules;
  });
  const yyptConfig = await getYyptConfigInfo(extraData);

  // # all templates to be generated
  const templatesData = {
    'app/global-api.js': {
      appId: appKey,
      subPackageName: rootPath,
      domain: domain,
    },
    'app/handlers.js': {
      pageModules,
    },
    'app/common.js': {
      mods: appData.codeModules
        .filter((m) => m.type === 'normal-module' && m.name !== '____index____')
        .map((m) => m.name),
    },
    'store/computed.js': {
      pageIds,
    },
    'store/index.js': {},
    'utils/initGlobalVar.js': {},
    'datasources/index.js.tpl': {},
    'datasources/config.js.tpl': {
      appID: appKey,
      envID: appData.envId,
      isProd: deployMode === DEPLOY_MODE.UPLOAD,
    },
    'datasources/datasource-profiles.js.tpl': {
      datasourceProfiles: JSON.stringify(
        getDatasourceProfiles((appData as any).datasources || []),
        null,
        2
      ),
    },
    'datasources/dataset-profiles.js.tpl': {
      datasetProfiles: JsonToStringWithVariableName(
        getDatasetProfiles(appData, [appData]),
        { EOL: true }
      ),
    },
    'utils/common.js': {
      isAdminPortal: buildAsAdminPortalByBuildType(buildTypeList as any),
    },
  };

  if (!rootPath) {
    templatesData['index.jsx'] = {
      ...yyptConfig,
      i18nConfig,
      isSandbox,
      isBuildApp: buildTypeList.includes('app'),
      subAppDataList,
    };
  }

  // Generating file by template and data
  for (const file in templatesData) {
    const filePath = `/src/${file}`;
    if (!templateFileMap[filePath]) {
      console.log('not found', filePath);
      process.exit();
    }
    const tplStr = templateFileMap[filePath].code;
    const generatedCode = tpl(tplStr)(templatesData[file]);
    const outFile = path.resolve(appBuildDir, file.replace(/.tpl$/, ''));
    fileCodeMap[outFile] = {
      code: generatedCode,
    };
  }
}
