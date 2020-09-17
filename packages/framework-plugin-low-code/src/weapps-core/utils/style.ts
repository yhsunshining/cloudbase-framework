import * as _ from 'lodash'
import { CSSProperties, ICommonStyle } from '../types'
import {
  PERCENTAGE_KEY_LIST,
  DISTANCE_KEY_LIST,
  SELF_REMOVE_STYLE_KEY_LIST,
  WRAPPER_REMOVE_STYLE_KEY_LIST,
  SELF_REMOVE_WITH_PERCENTAGE_KEY_LIST,
} from '../config'
import { kebabCase, camelcase, isPlainObject, isEmptyObj } from './common'

// Convert WeApps common style to css styles(React.CSSProperties)
export function toCssStyle(
  commonStyle: ICommonStyle = {},
  options = { toRem: true, ignoreSelf: false }
): CSSProperties {
  const {
    size,
    transform,
    text,
    border,
    background,
    margin,
    padding,
    zIndex,
    position,
    display,
    flexConfig,
    custom,
    self,
  } = commonStyle

  const style: CSSProperties = {}

  if (size) {
    setStyleValue(style, 'width', size.width)
    setStyleValue(style, 'height', size.height)
  }

  if (transform) {
    const { rotate, opacity, scale, radius } = transform
    if ((rotate && rotate !== 0) || (scale && scale !== 1)) {
      style.transform = `${rotate ? `rotate(${rotate}deg) ` : ''}${scale ? `scale(${scale})` : ''}`
    }
    setStyleValue(style, 'opacity', opacity)
    setStyleValue(style, 'borderRadius', radius)
  }

  if (margin) {
    setDistanceStyle(style, margin, 'margin')
  }

  if (padding) {
    setDistanceStyle(style, padding, 'padding')
  }

  if (display) {
    setStyleValue(style, 'display', display)
  }

  if (display === 'flex' && flexConfig) {
    if (flexConfig.justifyContent) setStyleValue(style, 'justifyContent', flexConfig.justifyContent)
    if (flexConfig.alignItems) setStyleValue(style, 'alignItems', flexConfig.alignItems)
    if (flexConfig.flexWrap && flexConfig.flexDirection) {
      setStyleValue(style, 'flexFlow', `${flexConfig.flexDirection} ${flexConfig.flexWrap}`)
    } else {
      if (flexConfig.flexWrap) setStyleValue(style, 'flexWrap', flexConfig.flexWrap)
      if (flexConfig.flexDirection) setStyleValue(style, 'flexDirection', flexConfig.flexDirection)
    }
  }

  if (typeof zIndex === 'number') {
    style.zIndex = zIndex
  }

  if (text) {
    setStyleValue(style, 'color', text.color)
    setStyleValue(style, 'fontSize', text.fontSize)
    setStyleValue(style, 'lineHeight', text.lineHeight)
    setStyleValue(style, 'textAlign', text.textAlign)
    setStyleValue(style, 'fontWeight', text.weight)
    if (text.opacity) setStyleValue(style, 'opacity', text.opacity / 100)
  }

  if (border) {
    const { type, color, width, radius, radiusInfo } = border
    if (width !== undefined) {
      if (type) {
        setStyleValue(style, 'border', `${width} ${type} ${color || ''}`)
      } else {
        setStyleValue(style, 'borderWidth', width)
        if (color) setStyleValue(style, 'borderColor', color)
      }
    }

    setStyleValue(style, 'borderRadius', radius)
    if (radiusInfo && !isEmptyObj(radiusInfo)) {
      if (Object.keys(radiusInfo).length === 4) {
        if (_.uniq(_.map(radiusInfo, val => val)).length === 1) {
          // 4个值全相等的情况
          setStyleValue(style, 'borderRadius', radiusInfo.topLeft)
        } else if (
          radiusInfo.topLeft === radiusInfo.bottomRight &&
          radiusInfo.topRight === radiusInfo.bottomLeft
        ) {
          // 俩俩相等的情况
          setStyleValue(style, 'borderRadius', `${radiusInfo.topLeft} ${radiusInfo.topRight}`)
        } else if (radiusInfo.topRight === radiusInfo.bottomLeft) {
          setStyleValue(
            style,
            'borderRadius',
            `${radiusInfo.topLeft} ${radiusInfo.topRight} ${radiusInfo.bottomRight}`
          )
        } else {
          setStyleValue(
            style,
            'borderRadius',
            `${radiusInfo.topLeft} ${radiusInfo.topRight} ${radiusInfo.bottomRight} ${radiusInfo.bottomLeft}`
          )
        }
      } else {
        setStyleValue(style, 'borderTopLeftRadius', radiusInfo.topLeft)
        setStyleValue(style, 'borderTopRightRadius', radiusInfo.topRight)
        setStyleValue(style, 'borderBottomRightRadius', radiusInfo.bottomRight)
        setStyleValue(style, 'borderBottomLeftRadius', radiusInfo.bottomLeft)
      }
    }
  }

  if (background) {
    const { bgType, color, image, size, repeat, position, positionObj } = background
    if (bgType === 'color') {
      setStyleValue(style, 'background', color)
    } else if (bgType === 'image') {
      if (image != null) {
        style.background = `url(${image})`
      }
      if (repeat) style.background += ` ${repeat}`
      if (size) setStyleValue(style, 'backgroundSize', size)
      setStyleValue(style, 'backgroundPosition', position)
      if (positionObj && !isEmptyObj(positionObj)) {
        style.background += ` ${positionObj.left} ${positionObj.top}`
      }
    }

    // FIXME: 这里兼容原有应用的数据，后面应去掉
    if (bgType === undefined) {
      setStyleValue(style, 'backgroundColor', color)
      if (image != null) {
        style.backgroundImage = `url(${image})`
        setStyleValue(style, 'backgroundRepeat', repeat)
        setStyleValue(style, 'backgroundSize', size)
        setStyleValue(style, 'backgroundPosition', position)
      }
    }
  }

  if (position) {
    setStyleValue(style, 'position', position.position)
    setStyleValue(style, 'left', position.left)
    setStyleValue(style, 'right', position.right)
    setStyleValue(style, 'top', position.top)
    setStyleValue(style, 'bottom', position.bottom)
  }

  if (custom && custom.length > 0) {
    custom.map(item => {
      setStyleValue(style, item.key, item.value)
    })
  }

  if (self && !options.ignoreSelf) {
    Object.assign(style, self)
  }

  return options.toRem ? translateStyleToRem(style) : style
}

export function removeInvalidStyleFormValue(styleForm: ICommonStyle = {}): ICommonStyle {
  return Object.keys(styleForm).reduce((result, key) => {
    const propStyleFormData = styleForm[key]
    if (isPlainObject(propStyleFormData)) {
      setStyleValue(result, key, removeInvalidStyleFormValue(propStyleFormData))
    } else {
      setStyleValue(result, key, styleForm[key])
    }
    return result
  }, {})
}

function setDistanceStyle(style, distance, attr: string) {
  if (Object.keys(distance).length === 4) {
    if (_.uniq(_.map(distance, val => val)).length === 1) {
      // 4个值全相等的情况
      setStyleValue(style, camelcase(`${attr}`), distance.top)
    } else if (distance.top === distance.bottom && distance.left === distance.right) {
      // 俩俩相等的情况
      setStyleValue(style, camelcase(`${attr}`), `${distance.top} ${distance.right}`)
    } else if (distance.left === distance.right) {
      setStyleValue(
        style,
        camelcase(`${attr}`),
        `${distance.top} ${distance.right} ${distance.bottom}`
      )
    } else {
      setStyleValue(
        style,
        camelcase(`${attr}`),
        `${distance.top} ${distance.right} ${distance.bottom} ${distance.left}`
      )
    }
  } else {
    DISTANCE_KEY_LIST.forEach(key => {
      if (distance[key] !== undefined)
        setStyleValue(style, camelcase(`${attr}_${key}`), distance[key])
    })
  }
}

export function translateStyleToRem(style: CSSProperties = {}): CSSProperties {
  return Object.entries(style).reduce((result, [key, value]) => {
    if (PERCENTAGE_KEY_LIST.includes(key)) {
      setStyleValue(result, key, value)
    } else if (value !== undefined && value !== null) {
      setStyleValue(result, key, toREM(value as string))
    }
    return result
  }, {})
}

function setStyleValue(object, key, value) {
  if (value === undefined || value === null || value === '') {
    return
  }
  // 特殊样式移除
  if (key === 'open') {
    return
  }

  if (isEmptyObj(value)) {
    return
  }

  object[camelcase(key)] = value
}

function calPxToREM(px: number) {
  if (+px === 0) {
    return '0'
  }
  return (px / 28).toFixed(4) + 'rem'
}

export function toREM(cssLen: number | string): string {
  if (typeof cssLen === 'string') {
    const cssLenArr = cssLen.split(' ')
    return cssLenArr
      .map(attr => {
        const matchResult = attr.match(/^(-?\d+)(px)?$/)
        if (matchResult && matchResult[1]) {
          return calPxToREM(+matchResult[1])
        }
        return attr
      })
      .join(' ')
  }
  return calPxToREM(cssLen)
}

export function removeWrapperBadEffectStyle(commonStyle: CSSProperties = {}): CSSProperties {
  return Object.keys(commonStyle).reduce((result, key) => {
    const value = commonStyle[key]
    const camelcaseKey = camelcase(key)

    if (WRAPPER_REMOVE_STYLE_KEY_LIST.includes(camelcaseKey)) {
      return result
    }

    if (key === 'display' && value === 'flex') {
      return result
    }

    setStyleValue(result, camelcaseKey, value)
    return result
  }, {})
}

export function removeEffectTwiceStyle(commonStyle: CSSProperties = {}): CSSProperties {
  const style: CSSProperties = {}
  Object.entries(commonStyle).map(([key, value]) => {
    const camelcaseKey = camelcase(key)

    // 去掉会重复影响布局样式属性
    if (SELF_REMOVE_STYLE_KEY_LIST.includes(camelcaseKey)) {
      return false
    }

    // 去掉特殊有百分比的样式属性，比如 width
    // 不能去掉的有类似 border-radius
    if (
      SELF_REMOVE_WITH_PERCENTAGE_KEY_LIST.includes(camelcaseKey) &&
      String(value).match(/.+%$/)
    ) {
      return false
    }

    setStyleValue(style, camelcaseKey, value)
  })
  return style
}

export function toCssText(style: CSSProperties, className = '.some-class-name') {
  const attrText = Object.entries(style)
    .map(([key, value]) => {
      return `${kebabCase(key)}: ${value};`
    })
    .join('\n')
  return `${className} { ${attrText} }\n`
}
