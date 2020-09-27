import React, { useCallback, useContext } from 'react'
import { set, cloneDeep } from 'lodash'
import { ComponentActionHandler } from '../actionHandler'
import { emitEvent } from '../actionHandler/utils'
import { resolveDataBinds, pathTransformSymbolToDot } from '../utils/common'
import { onComponentEventAction } from '../componentEventActionEmitter'
import { FormActionsContext } from '../controller'
import {
  translateStyleToRem,
  removeEffectTwiceStyle,
  removeWrapperBadEffectStyle,
} from '@govcloud/weapps-core/lib/utils/style'

const ForContext = React.createContext({})

export const rendererFieldMiddleware = Field => schemaConfig => {
  const { schema } = schemaConfig

  const parentForItems = useContext(ForContext)

  const emit = (trigger, event, forItems) => {
    const listenerInstances = schema['x-props'].listenerInstances
    emitEvent(trigger, listenerInstances, { event, customEventData: event, forItems })
  }

  const on = useCallback(
    (eventName, callback) => onComponentEventAction(schema, eventName, callback),
    [schema]
  )

  const isCustomComponent = schema && schema['x-component'] && schema['x-component'].includes(':')
  if (!isCustomComponent) {
    return <Field {...schemaConfig} />
  }

  const { style, commonStyle, dataBinds = {}, styleBind, classNameList, classNameListBind } = schema[
    'x-props'
  ]
  const data = cloneDeep(schema['x-props'].data || {});
  let forList = data._waFor
  if (dataBinds._waFor) {
    forList = dataBinds._waFor(parentForItems)
    // delete dataBinds._waFor
  }
  if (forList) {
    return forList.map((item, idx) => {
      const forItems = { ...parentForItems, [schema.key]: item }
      const dynamicProps = resolveDataBinds(dataBinds, forItems)
      if (dynamicProps.hasOwnProperty('_visible') === !dynamicProps._visible) {
        return null
      }
      const finalData = setData(cloneDeep(data), dynamicProps)
      updateComponentProps(finalData, schemaConfig.children)
      const { wrapperStyle, selfStyle, selfCommonStyle } = getAllStyle(commonStyle, style, styleBind, forItems)
      const emitWithForItems = (trigger, evt) => emit(trigger, evt, forItems)
      const finalClassNameList = getFinalClassNameList(classNameList, classNameListBind, forItems)
      return (
        <ForContext.Provider value={forItems}>
          <ComponentActionHandler
            classNameList={finalClassNameList}
            schema={schema}
            style={wrapperStyle}
            emit={emitWithForItems}
          >
            <Field
              key={item.key || idx}
              {...schemaConfig}
              {...schema}
              {...schema['x-props']}
              data={finalData}
              commonStyle={selfCommonStyle}
              style={selfStyle}
              emit={emitWithForItems}
              on={on}
            >
              {schemaConfig.children}
            </Field>
          </ComponentActionHandler>
        </ForContext.Provider>
      )
    })
  }

  const dynamicProps = resolveDataBinds(dataBinds, parentForItems)
  // Only check dynamic value of waIf, if waIf is static value, it should be handled by code generated.
  if (dynamicProps.hasOwnProperty('_visible') === !dynamicProps._visible) {
    return null
  }
  const finalData =  setData(data, dynamicProps)
  updateComponentProps(finalData, schemaConfig.children)
  const { wrapperStyle, selfStyle, selfCommonStyle } = getAllStyle(commonStyle, style, styleBind, parentForItems)
  const emitWithForItems = (trigger, evt) => emit(trigger, evt, parentForItems)
  const finalClassNameList = getFinalClassNameList(classNameList, classNameListBind, parentForItems)
  return (
    <ComponentActionHandler
      classNameList={finalClassNameList}
      schema={schema}
      style={wrapperStyle}
      emit={emitWithForItems}
    >
      <Field
        {...schemaConfig}
        {...schema}
        {...schema['x-props']}
        key={schema.path}
        data={finalData}
        commonStyle={selfCommonStyle}
        style={selfStyle}
        emit={emitWithForItems}
        on={on}
      >
        {schemaConfig.children}
      </Field>
    </ComponentActionHandler>
  )
}

export function getAllStyle(commonStyle, style, styleBind, forItems) {
  const tempBindStyle = styleBind ? resolveDataBinds(styleBind, forItems) : {}
  const bindStyle = (tempBindStyle && tempBindStyle.style) || {}
  const remStyle = translateStyleToRem(style)
  const remBindStyle = translateStyleToRem(bindStyle)

  return {
    wrapperStyle: removeWrapperBadEffectStyle({
      ...commonStyle,
      ...remStyle,
      ...remBindStyle,
    }),
    selfStyle: removeEffectTwiceStyle(remStyle),
    selfCommonStyle: removeEffectTwiceStyle({
      ...commonStyle,
      ...remBindStyle,
    }),
  }
}

export function getFinalClassNameList(classNameList = [], classNameListBind, forItems) {
  const tempBindClassNameList = classNameListBind
    ? resolveDataBinds(classNameListBind, forItems)
    : {}
  const targetBindClassNameList = tempBindClassNameList.classNameList || []
  let finalClassNameList = []
  if (targetBindClassNameList) {
    finalClassNameList = classNameList.concat(targetBindClassNameList)
  }
  return finalClassNameList
}

// handle props which are react elements
function updateComponentProps(props, children) {
  React.Children.map(children, child => {
    // FIXME remove element from children when it's props
    // Possible bugs: when component is container and has component props
    const dataPath = pathTransformSymbolToDot(child.key)
    set(props, dataPath, child)
  })
}


//bind props 深度处理绑定
function setData(data, dynamicProps) {
  Object.keys(dynamicProps).forEach(key => {
    set(data, key, dynamicProps[key])
  })
  return data
}
