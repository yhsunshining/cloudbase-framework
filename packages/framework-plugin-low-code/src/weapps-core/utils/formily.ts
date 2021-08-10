/**
 * Tencent is pleased to support the open source community by making CloudBaseFramework - 云原生一体化部署工具 available.
 *
 * Copyright (C) 2020 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * Please refer to license text included with this package for license details.
 */

// @ts-nocheck
import {
  IWeAppPage,
  IWeAppComponentInstance,
  IWeAppData,
  IPageInstance,
  IListenerInstance,
  IComponentInstanceProps,
  IDataAndBindInstanceProps,
  IDynamicValue,
  PropBindType,
  ActionType,
  IWebRuntimeAppData,
} from '../types';
import { IDataBind, IDataType, IComponentSchemaJson } from '../types/web';
import {
  isValidClassNameListBind,
  isValidStyleBind,
  setValidValue,
} from './common';
import { removeInvalidStyleFormValue } from './style';
import { HISTORY_TYPE } from '../../types';

/**
 * Convert webRuntimeAppData format to weAppData format
 * @param webRuntimeAppData app content of weAppData format
 */
export function serialize(webRuntimeAppData: IWebRuntimeAppData): IWeAppData {
  const weAppData: IWeAppData = {
    selectedPageId: webRuntimeAppData.selectedPageId,
    pageInstanceList: [],
    lowCodes: webRuntimeAppData.codeModules,
    npmDependencies: webRuntimeAppData.npmDependencies,
    plugins: webRuntimeAppData.plugins,
    rootPath: webRuntimeAppData.rootPath,
    datasources: webRuntimeAppData.datasources || [],
    vars: webRuntimeAppData.vars || { data: [] },
    dataset: webRuntimeAppData.dataset,
  };
  console.log('webRuntimeAppData', webRuntimeAppData);
  setValidValue(weAppData, 'appConfig', webRuntimeAppData.appConfig);
  setValidValue(weAppData, 'themeVars', webRuntimeAppData.themeVars);
  setValidValue(weAppData, 'presetColors', webRuntimeAppData.presetColors);

  handlePageInstanceList(
    webRuntimeAppData.pageInstanceList,
    weAppData.pageInstanceList
  );

  function handlePageInstanceList(
    pageInstanceList: IPageInstance[],
    collection: IWeAppPage[]
  ) {
    pageInstanceList.map((pageData) => {
      console.log('pageData', pageData);
      const newPage: IWeAppPage = {
        id: pageData.id,
      } as IWeAppPage;
      setValidValue(newPage, 'isHome', pageData.isHome);
      setValidValue(newPage, 'data', readDynamicData(pageData));
      setValidValue(
        newPage,
        'commonStyle',
        removeInvalidStyleFormValue(pageData.style)
      );
      setValidValue(newPage, 'styleBindPath', pageData.styleBindPath);
      if (isValidStyleBind(pageData.styleBind)) {
        setValidValue(newPage, 'styleBind', pageData.styleBind);
      }
      if (isValidClassNameListBind(pageData.classNameListBind)) {
        setValidValue(newPage, 'classNameListBind', pageData.classNameListBind);
      }
      setValidValue(
        newPage,
        'componentInstances',
        readComponents(pageData.componentSchemaJson.properties)
      );
      setValidValue(
        newPage,
        'listeners',
        readListeners(pageData.listenerInstances)
      );
      setValidValue(newPage, 'pluginInstances', pageData.pluginInstances);
      setValidValue(newPage, 'lowCodes', pageData.codeModules);

      if (pageData.children?.length) {
        newPage.children = newPage.children || [];
        handlePageInstanceList(pageData.children, newPage.children);
      }
      collection.push(newPage);
    });
  }

  function readComponents(
    properties: { [key: string]: IComponentSchemaJson } = {},
    excludeKeys: string[] = []
  ) {
    const cmps: IWeAppPage['componentInstances'] = {};
    for (const key in properties) {
      if (excludeKeys.indexOf(key) > -1) {
        continue;
      }
      const srcCmp = properties[key];
      const srcProps = srcCmp['x-props'] as IComponentInstanceProps;
      if (srcProps) {
        const cmpParts = srcProps.sourceKey.split(':');
        cmps[key] = { genericComp: srcCmp['genericComp'] };
        setValidValue(cmps[key], 'xComponent', {
          moduleName: cmpParts[0],
          name: cmpParts[1],
        });
        const componentXProps: IWeAppComponentInstance['xProps'] = {};
        setValidValue(componentXProps, 'data', readDynamicData(srcProps));
        setValidValue(
          componentXProps,
          'listeners',
          readListeners(srcProps.listenerInstances)
        );
        setValidValue(componentXProps, 'staticResourceAttribute', srcProps.staticResourceAttribute);
        setValidValue(componentXProps, 'directives', readDirectives(srcProps));
        setValidValue(
          componentXProps,
          'customDataForm',
          srcProps.customDataForm
        );
        setValidValue(componentXProps, 'style', srcProps.style);
        setValidValue(
          componentXProps,
          'commonStyle',
          removeInvalidStyleFormValue(srcProps.commonStyle)
        );
        setValidValue(componentXProps, 'styleBindPath', srcProps.styleBindPath);
        if (srcProps.styleBind?.bindDataPath) {
          componentXProps.styleBind = {
            type: srcProps.styleBind.type,
            value: srcProps.styleBind.bindDataPath,
          };
        }

        if (isValidClassNameListBind(srcProps.classNameListBind)) {
          const classList = srcProps.classNameListBind;
          setValidValue(componentXProps, 'classListBind', {
            type: classList.type,
            value: classList.bindDataPath,
          });
        }
        if (srcProps.classNameList) {
          setValidValue(componentXProps, 'classList', srcProps.classNameList);
        }
        setValidValue(cmps[key], 'xProps', componentXProps);
        setValidValue(cmps[key], 'xIndex', srcCmp['x-index']);

        const excludeKeys = (srcProps.dataTypes || [])
          .filter((dataType) => dataType.type !== 'slot')
          .map((dataType) => dataType.propertyPath);
        setValidValue(
          cmps[key],
          'properties',
          readComponents(srcCmp.properties, excludeKeys)
        );
      } else {
        cmps[key] = { properties: readComponents(srcCmp.properties) };
      }
    }
    return cmps;
  }

  function readDirectives(cmp: IComponentInstanceProps) {
    const directives: IWeAppComponentInstance['xProps']['directives'] = {};

    // 默认为 true，节省体积不记录
    if (cmp.data && cmp.data._visible !== true) {
      directives.waIf = {
        value: cmp.data._visible,
      };
    }

    if (cmp.dataBinds?.length) {
      const bind = cmp.dataBinds.find(
        (bind) => bind.propertyPath === '_visible'
      );
      if (bind) {
        const foundDataType = (cmp.dataTypes || []).find(
          (dataType) => dataType.propertyPath === bind.propertyPath
        );
        if (foundDataType && foundDataType.type === 'bind') {
          directives.waIf = {
            type: bind.type || PropBindType.state,
            value: bind.bindDataPath,
          };
        }
      }

      const forBind = cmp.dataBinds.find(
        (bind) => bind.propertyPath === '_waFor'
      );
      if (forBind) {
        directives.waFor = {
          type: forBind.type || PropBindType.state,
          value: forBind.bindDataPath,
        };
      }
    }

    return directives;
  }

  function readDynamicData(cmp: IDataAndBindInstanceProps) {
    const data: IWeAppPage['data'] = {};
    const ignoredProps = ['_visible', '_waFor'];
    // Read data
    for (const prop in cmp.data) {
      if (ignoredProps.indexOf(prop) > -1) {
        continue;
      }
      // Keep null values to generate all wxml attributes
      data[prop] = { value: cmp.data[prop] };
    }
    // Read data binds
    cmp.dataBinds?.forEach((bind) => {
      if (ignoredProps.indexOf(bind.propertyPath) > -1) {
        return;
      }

      const foundDataType = (cmp.dataTypes || []).find(
        (dataType) => dataType.propertyPath === bind.propertyPath
      );
      if (foundDataType && foundDataType.type === 'bind') {
        data[bind.propertyPath] = {
          type: bind.type || PropBindType.state,
          value: bind.bindDataPath,
        };
      }
    });

    return data;
  }

  function readListeners(listenerInstances: IListenerInstance[] = []) {
    const listeners: IWeAppPage['listeners'] = listenerInstances.map((act) => {
      const fromParts = act.sourceKey.split(':');
      let handler: any;
      if (act.type !== ActionType.Inline) {
        const fromParts = act.sourceKey.split(':');
        handler = {
          handler: {
            moduleName: fromParts[0],
            name: fromParts[1],
          },
        };
      } else {
        handler = { jsCode: act.jsCode };
      }

      return {
        key: act.key || '',
        trigger: act.trigger,
        type: act.type,
        ...handler,
        data: readDynamicData(act),
        isCapturePhase: act.isCapturePhase,
        noPropagation: act.noPropagation,
      };
    });
    return listeners;
  }

  return weAppData;
}

/**
 * Convert weAppData format to webRuntimeAppData
 * @param weAppData
 */
export function deserialize(weAppData: IWeAppData): IWebRuntimeAppData {
  const webRuntimeAppData: IWebRuntimeAppData = {
    appTitle: (weAppData as any).label,
    label: (weAppData as any).label,
    selectedPageId: weAppData.selectedPageId,
    historyType: weAppData.historyType || HISTORY_TYPE.BROWSER,
    pageInstanceList: [],
    codeModules: weAppData.lowCodes || [],
    npmDependencies: weAppData.npmDependencies || {},
    plugins: weAppData.plugins || [],
    rootPath: weAppData.rootPath || '',
    themeVars: weAppData.themeVars || {},
    presetColors: weAppData.presetColors || [],
    appConfig: weAppData.appConfig || {},
    datasources: weAppData.datasources || [],
    vars: weAppData.vars || { data: [] },
    dataset: weAppData.dataset,
    envId: weAppData.envId || '',
    extra: weAppData.extra || {},
  };
  handlePageInstanceList(
    weAppData.pageInstanceList,
    webRuntimeAppData.pageInstanceList
  );

  function handlePageInstanceList(
    pageInstanceList: IWeAppPage[],
    collection: IPageInstance[]
  ) {
    pageInstanceList.map((srcPage) => {
      const page: IPageInstance = {
        id: srcPage.id,
        data: {},
        dataBinds: [],
        vars: { data: [] },
        dataset: srcPage.dataset,
      };
      page.vars = srcPage.vars ? srcPage.vars : page.vars;
      page.isHome = srcPage.isHome || false;
      page.style = srcPage.commonStyle || {};
      setValidValue(page, 'styleBindPath', srcPage.styleBindPath);
      page.codeModules = srcPage.lowCodes || [];
      page.pluginInstances = srcPage.pluginInstances || [];
      page.componentSchemaJson = {
        type: 'object',
        properties: readCmpInstances(srcPage.componentInstances),
        'x-index': 0,
      };
      page.listenerInstances = readListeners(srcPage.listeners) || [];
      // Compatibility logic
      if (srcPage['code']) {
        const target =
          srcPage['codeType'] === 'page' ? page : webRuntimeAppData;
        target.codeModules.push({
          type: 'rematch',
          code: srcPage['code'],
          name: srcPage.id,
          path: '',
        });
      }

      readDynamicData(srcPage.data, page);
      if (srcPage.children?.length) {
        page.children = page.children || [];
        handlePageInstanceList(srcPage.children, page.children);
      }
      collection.push(page);
    });
  }
  console.log('webRuntimeAppData', webRuntimeAppData);
  return webRuntimeAppData;
}
/* tslint:disable */
export function readCmpInstances(cmps: IWeAppPage['componentInstances']) {
  const properties = {};
  for (const key in cmps) {
    const cmp = cmps[key];
    if (key === 'id16') {
      console.log('key', key);
      console.log('cmp', cmp);
    }
    const target = (properties[key] = {
      key,
      type: 'object',
      properties: readCmpInstances(cmp.properties || {}),
      genericComp: cmp.genericComp,
    });
    if (cmp.xComponent) {
      cmp.xProps = (cmp.xProps || {}) as IWeAppComponentInstance['xProps'];
      const xCmp = cmp.xComponent.moduleName + ':' + cmp.xComponent.name;
      const xProps = {
        sourceKey: xCmp,
        data: {},
      } as IComponentInstanceProps;
      xProps.dataBinds = xProps.dataBinds || [];
      xProps.dataTypes = xProps.dataTypes || [];
      xProps.customDataForm = xProps.customDataForm || {};
      xProps.style = cmp.xProps.style || {};
      xProps.commonStyle = cmp.xProps.commonStyle || {};
      xProps.staticResourceAttribute = cmp.xProps.staticResourceAttribute || [];
      setValidValue(xProps, 'styleBindPath', cmp.xProps.styleBindPath);

      let { classList, classListBind } = cmp.xProps;
      const { styleBind } = cmp.xProps;

      // for compatibility with error data
      const legacyClassList = classList as any;
      if (legacyClassList?.value) {
        if (!legacyClassList.type || legacyClassList.type === 'static') {
          classList = legacyClassList.value;
        } else {
          classList = [];
          classListBind = classListBind;
        }
      }

      classList && setValidValue(xProps, 'classNameList', classList);
      classListBind &&
        setValidValue(xProps, 'classNameListBind', {
          type: classListBind.type,
          propertyPath: 'classNameList',
          bindDataPath: classListBind.value,
        });
      if (styleBind && styleBind.type !== 'static') {
        xProps.styleBind = {
          type: styleBind.type,
          propertyPath: 'style',
          bindDataPath: styleBind.value,
        };
      }

      xProps.listenerInstances = readListeners(cmp.xProps.listeners) || [];
      readDynamicData(cmp.xProps.data, xProps, cmp.properties);

      if (cmp.xProps.directives) {
        const { waIf, waFor } = cmp.xProps.directives;
        if (waIf) {
          if (waIf.type === 'static' || waIf.type === undefined) {
            xProps.data = xProps.data || {};
            xProps.data._visible = waIf.value;
          } else {
            xProps.dataBinds = xProps.dataBinds || [];
            xProps.dataBinds.push({
              // @ts-ignore
              type: waIf.type || PropBindType.state,
              propertyPath: '_visible',
              bindDataPath: waIf.value,
            });
            xProps.dataTypes.push({
              propertyPath: '_visible',
              type: 'bind',
            });
          }
        }

        if (waFor && waFor.type !== 'static') {
          xProps.dataBinds = xProps.dataBinds || [];
          xProps.dataBinds.push({
            type: waFor.type || PropBindType.state,
            propertyPath: '_waFor',
            bindDataPath: waFor.value,
          });
          xProps.dataTypes.push({
            propertyPath: '_waFor',
            type: 'bind',
          });
        }
      } else {
        // 默认是 true
        xProps.data = xProps.data || {};
        xProps.data._visible = true;
      }

      setValidValue(target, 'x-component', xCmp.toLocaleLowerCase());
      setValidValue(xProps, 'customDataForm', cmp.xProps.customDataForm);
      target['x-props'] = xProps;
      setValidValue(target, 'x-index', cmp.xIndex);
    }
  }
  return properties;
}
/* tslint:enable */
function readListeners(listeners: IWeAppPage['listeners'] = []) {
  return listeners.map((l) => {
    const { handler } = l;
    const act: IListenerInstance = {
      key: l.key || '',
      sourceKey: handler ? handler.moduleName + ':' + handler.name : '',
      trigger: l.trigger,
      type: l.type,
      data: {},
      dataBinds: [],
      handler: l.handler,
      jsCode: l.jsCode,
      isCapturePhase: l.isCapturePhase,
      noPropagation: l.noPropagation,
    };
    readDynamicData(l.data, act);
    return act;
  });
}

function readDynamicData(
  from: { [prop: string]: IDynamicValue } = {},
  to: { data: any; dataBinds?: IDataBind[]; dataTypes?: IDataType[] },
  properties?: any
) {
  to.dataTypes = to.dataTypes || [];
  for (const prop in from) {
    const dv = from[prop];
    if (dv.type === 'static' || dv.type === undefined) {
      to.data = to.data || {};
      to.data[prop] = dv.value;
      to.dataTypes.push({
        propertyPath: prop,
        type: 'static',
      });
    } else if (dv.type === 'slot') {
      to.dataTypes.push({
        propertyPath: prop,
        type: 'slot',
      });
    } else {
      to.dataBinds = to.dataBinds || [];
      to.dataBinds.push({
        propertyPath: prop,
        bindDataPath: dv.value,
        type: dv.type,
      });
      to.dataTypes.push({
        propertyPath: prop,
        type: 'bind',
      });
    }
  }

  // 兼容之前的应用，slot类型的字段从 properties 中取
  if (properties) {
    Object.keys(properties).forEach((key) => {
      const foundOne = (to.dataTypes as IDataType[]).find(
        (dataType) => dataType.propertyPath === key
      );
      if (foundOne) {
        foundOne.type = 'slot';
      } else {
        if (!properties[key].xComponent)
          to.dataTypes.push({
            propertyPath: key,
            type: 'slot',
          });
      }
    });
  }
}
