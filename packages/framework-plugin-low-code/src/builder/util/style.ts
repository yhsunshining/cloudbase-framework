import postcss from 'postcss'
import less from 'less'
import pxToRem from 'postcss-pxtorem'
import pxToRpx from './postcss-rpx'
import { remConfig, rpxConfig } from '../config'
const THEME = 'theme'
const STYLE = 'style'

export const defaultThemeCode = `
@example-primary-color: blue;
// 混用 ( Mixin )
/**
 * 可以 在全局style，或者页面的style中使用.mixins()
 *  .a {
      color: #111;
      .mixins();
    }

    .b {
      color: red;
      .mixins(red);
    }
 * （友情提示：不建议theme中书写具体的类样式， 或者不带括号的mixin，会导致代码重复编译 ）
 **/
.mixins(@color: red) {
  display:block;
  padding: 40px;
  background: @color;
  text-decoration:none;
}
`

export async function processLess(lessCode: string) {
  const { css: lessCss } = await less.render(lessCode)
  const { css: remCss } = await postcss([pxToRem(remConfig)]).process(lessCss)
  return remCss
}

export async function processLessToRpx(lessCode: string) {
  const { css: lessCss } = await less.render(lessCode)
  const { css: rpxCss } = await postcss([pxToRpx(rpxConfig)]).process(lessCss)
  return rpxCss
}

// 生成默认theme文件
export function generateDefaultTheme(data) {
  const lowCodes = data.lowCodes || data.codeModules || []
  const isHasTheme = lowCodes.find(item => item.type === THEME)
  if (!isHasTheme) {
    const themeStyle = {
      type: THEME,
      name: THEME,
      code: defaultThemeCode,
      path: `global/${THEME}`,
      system: true,
    }
    lowCodes.unshift(themeStyle)
    return themeStyle
  }
  return isHasTheme
}
// 生成每个页面默认style文件
export function generateDefaultStyle(data) {
  const lowCodes = data.lowCodes || data.codeModules || []
  const isHasSTYLE = lowCodes.find(item => item.type === STYLE)
  if (!isHasSTYLE) {
    lowCodes.unshift({
      type: STYLE,
      name: STYLE,
      code: '',
      path: `${data.id}/${STYLE}`,
      system: true,
    })
  }
}
