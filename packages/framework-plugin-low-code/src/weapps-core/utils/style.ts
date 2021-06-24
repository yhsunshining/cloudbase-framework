import _uniq from 'lodash/uniq';
import _map from 'lodash/map';
import { CSSProperties, ICommonStyle } from '../types';
import {
  PERCENTAGE_KEY_LIST,
  DISTANCE_KEY_LIST,
  SELF_REMOVE_STYLE_KEY_LIST,
  WRAPPER_REMOVE_STYLE_KEY_LIST,
  SELF_REMOVE_WITH_PERCENTAGE_KEY_LIST,
} from '../config';
import { kebabCase, camelcase, isPlainObject, isEmptyObj } from './common';

function _handleStyleNumValue(styleVal: string | number, addPXUnit: boolean) {
  if (addPXUnit) {
    const value = `${styleVal}`;
    if (value.search(/^\d+$/) >= 0) {
      return value + 'px';
    }
  }
  return styleVal;
}

// Convert WeApps common style to css styles(React.CSSProperties)
export function toCssStyle(
  commonStyle: ICommonStyle = {},
  options: {
    toRem: boolean;
    ignoreSelf?: boolean;
    addPXUnit?: boolean;
    toRpx?: boolean;
  } = { toRem: true, ignoreSelf: false, addPXUnit: false, toRpx: false }
): CSSProperties {
  const {
    size,
    // transform,
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
  } = commonStyle;

  const style: CSSProperties = {};

  if (size) {
    setStyleValue(
      style,
      'width',
      _handleStyleNumValue(size.width, !!options.addPXUnit)
    );
    setStyleValue(
      style,
      'height',
      _handleStyleNumValue(size.height, !!options.addPXUnit)
    );
  }

  // if (transform) {
  //   const { rotate, opacity, scale, radius } = transform
  //   if ((rotate && rotate !== 0) || (scale && scale !== 1)) {
  //     style.transform = `${rotate ? `rotate(${rotate}deg) ` : ''}${scale ? `scale(${scale})` : ''}`
  //   }
  //   setStyleValue(style, 'opacity', opacity)
  //   setStyleValue(style, 'borderRadius', radius)
  // }

  if (margin) {
    setDistanceStyle(style, margin, 'margin', !!options.addPXUnit);
  }

  if (padding) {
    setDistanceStyle(style, padding, 'padding', !!options.addPXUnit);
  }

  if (display) {
    setStyleValue(style, 'display', display);
  }

  if (display === 'flex' && flexConfig) {
    if (flexConfig.justifyContent)
      setStyleValue(style, 'justifyContent', flexConfig.justifyContent);
    if (flexConfig.alignItems)
      setStyleValue(style, 'alignItems', flexConfig.alignItems);
    if (flexConfig.flexWrap && flexConfig.flexDirection) {
      setStyleValue(
        style,
        'flexFlow',
        `${flexConfig.flexDirection} ${flexConfig.flexWrap}`
      );
    } else {
      if (flexConfig.flexWrap)
        setStyleValue(style, 'flexWrap', flexConfig.flexWrap);
      if (flexConfig.flexDirection)
        setStyleValue(style, 'flexDirection', flexConfig.flexDirection);
    }
  }

  if (typeof zIndex === 'number' || `${zIndex}`.search(/^\d+$/) === 0) {
    style.zIndex = zIndex;
  }

  if (text) {
    setStyleValue(style, 'color', text.color);
    setStyleValue(
      style,
      'fontSize',
      _handleStyleNumValue(text.fontSize, !!options.addPXUnit)
    );
    setStyleValue(style, 'lineHeight', text.lineHeight);
    setStyleValue(style, 'textAlign', text.textAlign);
    setStyleValue(style, 'fontWeight', text.weight);
    if (text.opacity) {
      setStyleValue(style, 'opacity', text.opacity / 100);
    }
  }

  if (border) {
    const { type, color, width, radius, radiusInfo } = border;
    if (width !== undefined) {
      if (type) {
        setStyleValue(
          style,
          'border',
          `${_handleStyleNumValue(width, !!options.addPXUnit)} ${type} ${
            color || ''
          }`
        );
      } else {
        setStyleValue(
          style,
          'borderWidth',
          _handleStyleNumValue(width, !!options.addPXUnit)
        );
        if (color) setStyleValue(style, 'borderColor', color);
      }
    }
    if (radius !== undefined) {
      setStyleValue(
        style,
        'borderRadius',
        _handleStyleNumValue(radius, !!options.addPXUnit)
      );
    }
    if (radiusInfo && !isEmptyObj(radiusInfo)) {
      if (Object.keys(radiusInfo).length === 4) {
        if (_uniq(_map(radiusInfo, (val) => val)).length === 1) {
          // 4个值全相等的情况
          setStyleValue(
            style,
            'borderRadius',
            _handleStyleNumValue(radiusInfo.topLeft, !!options.addPXUnit)
          );
        } else if (
          radiusInfo.topLeft === radiusInfo.bottomRight &&
          radiusInfo.topRight === radiusInfo.bottomLeft
        ) {
          // 俩俩相等的情况
          setStyleValue(
            style,
            'borderRadius',
            `${_handleStyleNumValue(
              radiusInfo.topLeft,
              !!options.addPXUnit
            )} ${_handleStyleNumValue(
              radiusInfo.topRight,
              !!options.addPXUnit
            )}`
          );
        } else if (radiusInfo.topRight === radiusInfo.bottomLeft) {
          setStyleValue(
            style,
            'borderRadius',
            `${_handleStyleNumValue(
              radiusInfo.topLeft,
              !!options.addPXUnit
            )} ${_handleStyleNumValue(
              radiusInfo.topRight,
              !!options.addPXUnit
            )} ${_handleStyleNumValue(
              radiusInfo.bottomRight,
              !!options.addPXUnit
            )}`
          );
        } else {
          setStyleValue(
            style,
            'borderRadius',
            `${_handleStyleNumValue(
              radiusInfo.topLeft,
              !!options.addPXUnit
            )} ${_handleStyleNumValue(
              radiusInfo.topRight,
              !!options.addPXUnit
            )} ${_handleStyleNumValue(
              radiusInfo.bottomRight,
              !!options.addPXUnit
            )} ${_handleStyleNumValue(
              radiusInfo.bottomLeft,
              !!options.addPXUnit
            )}`
          );
        }
      } else {
        setStyleValue(
          style,
          'borderTopLeftRadius',
          _handleStyleNumValue(radiusInfo.topLeft, !!options.addPXUnit)
        );
        setStyleValue(
          style,
          'borderTopRightRadius',
          _handleStyleNumValue(radiusInfo.topRight, !!options.addPXUnit)
        );
        setStyleValue(
          style,
          'borderBottomRightRadius',
          _handleStyleNumValue(radiusInfo.bottomRight, !!options.addPXUnit)
        );
        setStyleValue(
          style,
          'borderBottomLeftRadius',
          _handleStyleNumValue(radiusInfo.bottomLeft, !!options.addPXUnit)
        );
      }
    }
  }

  if (background) {
    const { bgType, color, image, size, repeat, position, positionObj } =
      background;
    if (bgType === 'color') {
      setStyleValue(style, 'background', color);
    } else if (bgType === 'image') {
      // 如 radial-gradient(crimson, skyblue);
      if (image != null) {
        if (image.search(/[()]/) >= 0) {
          style.background = image;
        } else {
          style.background = `url(${image})`;
        }
      }
      if (repeat) style.background += ` ${repeat}`;
      if (size) {
        setStyleValue(
          style,
          'backgroundSize',
          _handleStyleNumValue(size, !!options.addPXUnit)
        );
      }
      setStyleValue(style, 'backgroundPosition', position);
      if (positionObj && !isEmptyObj(positionObj)) {
        style.background += ` ${_handleStyleNumValue(
          positionObj.left,
          !!options.addPXUnit
        )} ${_handleStyleNumValue(positionObj.top, !!options.addPXUnit)}`;
      }
    }

    // FIXME: 这里兼容原有应用的数据，后面应去掉
    if (bgType === undefined) {
      setStyleValue(style, 'backgroundColor', color);
      if (image != null) {
        style.backgroundImage = `url(${image})`;
        setStyleValue(style, 'backgroundRepeat', repeat);
        setStyleValue(
          style,
          'backgroundSize',
          _handleStyleNumValue(size, !!options.addPXUnit)
        );
        setStyleValue(style, 'backgroundPosition', position);
      }
    }
  }

  if (position) {
    setStyleValue(style, 'position', position.position);
    if (position.left !== undefined) {
      setStyleValue(
        style,
        'left',
        _handleStyleNumValue(position.left, !!options.addPXUnit)
      );
    }
    if (position.right !== undefined) {
      setStyleValue(
        style,
        'right',
        _handleStyleNumValue(position.right, !!options.addPXUnit)
      );
    }
    if (position.top !== undefined) {
      setStyleValue(
        style,
        'top',
        _handleStyleNumValue(position.top, !!options.addPXUnit)
      );
    }
    if (position.bottom !== undefined) {
      setStyleValue(
        style,
        'bottom',
        _handleStyleNumValue(position.bottom, !!options.addPXUnit)
      );
    }
  }

  if (custom && custom.length > 0) {
    custom.map((item) => {
      setStyleValue(style, item.key, item.value);
    });
  }

  if (self && !options.ignoreSelf) {
    Object.assign(style, self);
  }

  if (options.toRpx) {
    return translateStyleToRpx(style);
  }

  return options.toRem ? translateStyleToRem(style) : style;
}

export function removeInvalidStyleFormValue(
  styleForm: ICommonStyle = {}
): ICommonStyle {
  return Object.keys(styleForm).reduce((result, key) => {
    const propStyleFormData = styleForm[key];
    if (isPlainObject(propStyleFormData)) {
      setStyleValue(
        result,
        key,
        removeInvalidStyleFormValue(propStyleFormData)
      );
    } else {
      setStyleValue(result, key, styleForm[key]);
    }
    return result;
  }, {});
}

function setDistanceStyle(style, distance, attr: string, addPXUnit: boolean) {
  if (Object.keys(distance).length === 4) {
    if (_uniq(_map(distance, (val) => val)).length === 1) {
      // 4个值全相等的情况
      setStyleValue(
        style,
        camelcase(`${attr}`),
        _handleStyleNumValue(distance.top, addPXUnit)
      );
    } else if (
      distance.top === distance.bottom &&
      distance.left === distance.right
    ) {
      // 俩俩相等的情况
      setStyleValue(
        style,
        camelcase(`${attr}`),
        `${_handleStyleNumValue(
          distance.top,
          addPXUnit
        )} ${_handleStyleNumValue(distance.right, addPXUnit)}`
      );
    } else if (distance.left === distance.right) {
      setStyleValue(
        style,
        camelcase(`${attr}`),
        `${_handleStyleNumValue(
          distance.top,
          addPXUnit
        )} ${_handleStyleNumValue(
          distance.right,
          addPXUnit
        )} ${_handleStyleNumValue(distance.bottom, addPXUnit)}`
      );
    } else {
      setStyleValue(
        style,
        camelcase(`${attr}`),
        `${_handleStyleNumValue(
          distance.top,
          addPXUnit
        )} ${_handleStyleNumValue(
          distance.right,
          addPXUnit
        )} ${_handleStyleNumValue(
          distance.bottom,
          addPXUnit
        )} ${_handleStyleNumValue(distance.left, addPXUnit)}`
      );
    }
  } else {
    DISTANCE_KEY_LIST.forEach((key) => {
      if (distance[key] !== undefined)
        setStyleValue(
          style,
          camelcase(`${attr}_${key}`),
          _handleStyleNumValue(distance[key], addPXUnit)
        );
    });
  }
}

export function translateStyleToRpx(style: CSSProperties = {}): CSSProperties {
  return translateStyleByHandler(style, toRPX);
}

export function translateStyleToRem(style: CSSProperties = {}): CSSProperties {
  return translateStyleByHandler(style, toREM);
}

export function translateStyleByHandler(
  style: CSSProperties = {},
  handler: (p: string) => string
) {
  return Object.keys(style).reduce((result, key) => {
    const value = style[key];
    if (PERCENTAGE_KEY_LIST.includes(key)) {
      setStyleValue(result, key, value);
    } else if (value !== undefined && value !== null) {
      setStyleValue(result, key, handler(value as string));
    }
    return result;
  }, {});
}

function setStyleValue(object, key, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  // 特殊样式移除
  if (key === 'open') {
    return;
  }

  if (isEmptyObj(value)) {
    return;
  }

  object[camelcase(key)] = value;
}

function calPxToREM(px: number) {
  if (Number.isNaN(px / 28)) return px.toString();
  if (+px === 0) {
    return '0';
  }
  return (px / 28).toFixed(4) + 'rem';
}

export function toREM(cssLen: number | string): string {
  if (typeof cssLen === 'string') {
    const cssLenArr = cssLen.split(' ');
    return cssLenArr
      .map((attr) => {
        const matchResult = attr.match(/^(-?\d+)(px)?$/);
        if (matchResult && matchResult[1]) {
          return calPxToREM(+matchResult[1]);
        }
        return attr;
      })
      .join(' ');
  } else if (typeof cssLen === 'number') {
    return calPxToREM(cssLen);
  } else {
    throw new Error('cssLen type error');
  }
}

export function toRPX(cssLen: number | string): string {
  if (typeof cssLen === 'string') {
    const cssLenArr = cssLen.split(' ');
    return cssLenArr
      .map((attr) => {
        const matchResult = attr.match(/^(-?\d+)(px)?$/);
        if (matchResult && matchResult[1]) {
          return `${+matchResult[1]}rpx`;
        }
        return attr;
      })
      .join(' ');
  }
  return `${cssLen}rpx`;
}

export function removeWrapperBadEffectStyle(
  commonStyle: CSSProperties = {}
): CSSProperties {
  return Object.keys(commonStyle).reduce((result, key) => {
    const value = commonStyle[key];
    const camelcaseKey = camelcase(key);

    if (WRAPPER_REMOVE_STYLE_KEY_LIST.includes(camelcaseKey)) {
      return result;
    }

    if (key === 'display' && value === 'flex') {
      return result;
    }

    setStyleValue(result, camelcaseKey, value);
    return result;
  }, {});
}

export function removeEffectTwiceStyle(
  commonStyle: CSSProperties = {}
): CSSProperties {
  const style: CSSProperties = {};
  Object.keys(commonStyle).map((key) => {
    const value = commonStyle[key];
    const camelcaseKey = camelcase(key);

    // 去掉会重复影响布局样式属性
    if (SELF_REMOVE_STYLE_KEY_LIST.includes(camelcaseKey)) {
      return false;
    }

    // 去掉特殊有百分比的样式属性，比如 width
    // 不能去掉的有类似 border-radius
    if (
      SELF_REMOVE_WITH_PERCENTAGE_KEY_LIST.includes(camelcaseKey) &&
      String(value).match(/.+%$/)
    ) {
      return false;
    }

    setStyleValue(style, camelcaseKey, value);
  });
  return style;
}

export function toCssText(
  style: CSSProperties,
  className = '.some-class-name'
) {
  const attrText = Object.keys(style)
    .map((key) => {
      const value = style[key];
      return `${kebabCase(key)}: ${value};`;
    })
    .join('\n');
  return `${className} { ${attrText} }\n`;
}
