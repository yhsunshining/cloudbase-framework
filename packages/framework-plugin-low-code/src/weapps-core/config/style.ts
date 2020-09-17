// 组件 自身 应该移除的样式属性
export const SELF_REMOVE_STYLE_KEY_LIST = [
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',

  'position',
  'top',
  'right',
  'bottom',
  'left',
  'float',

  'transform',
  'animation',
]

export const SELF_REMOVE_WITH_PERCENTAGE_KEY_LIST = ['width', 'height']

// 组件 外包裹 应该移除的样式属性
export const WRAPPER_REMOVE_STYLE_KEY_LIST = [
  // flex
  'justifyContent',
  'alignItems',
  'flexDirection',
  'flexWrap',
  'flexFlow',

  'background',
  'backgroundColor',
  'backgroundImage',

  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  'border',
  'borderStyle',
  'borderWidth',
  'borderColor',
  'borderImage',
  'borderRadius',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',

  'outline',
  'outlineColor',
  'outlineOffset',
  'outlineStyle',
  'outlineWidth',

  'boxShadow',

  // column
  'columnCount',
  'columnGap',
  'columnRuleStyle',
  'columnRuleWidth',
  'columnRuleColor',
  'columnRule',
  'columnSpan',
  'columnWidth',
]

export const PERCENTAGE_KEY_LIST = ['opacity', 'zIndex', 'fontWeight']

export const DISTANCE_KEY_LIST = ['top', 'right', 'bottom', 'left']

export const KEBAB_REGEX = /[A-Z]/g
