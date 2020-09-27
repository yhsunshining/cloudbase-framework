import { CodeType } from './code_types'

export interface IWeAppCode {
  id?: string // TODO: 为了不影响当前代码，所以新加的 id 字段暂为可选的。后面需要迭代改为必须提供
  path?: string // 代码路径 TODO: 为了不影响当前代码，所以新加的 path 字段暂为可选的。后面需要迭代改为必须提供
  system?: boolean // 是否系统代码（系统默认添加，用户不可删除，只能修改）TODO: 为了不影响当前代码，所以新加的 path 字段暂为可选的。后面需要迭代改为必须提供
  type: CodeType
  name: string // path, module name, should be legal identifier name
  code: string
  desc?: string

  // unused
  title?: string
}

/**
 * Get the folder to hold the code file, used when saving code to files and import each other
 * @param mod code module
 * @param pageId page id or 'global'
 */
export function getCodeModuleFilePath(pageId: string, mod: IWeAppCode) {
  let file = ``
  if (mod?.path?.startsWith('$comp')) {
    // 复合组件，将 $comp_[id] 替换成 [compName]_[id]
    file = `/${mod.path.replace(/\$comp_\d+/, pageId)}`
  } else if (pageId === 'global') {
    file = `/${mod?.path?.replace(/^global/, '')}`
  } else {
    // 页面，由于改变页面ID时没有作path的更新，所以这里需要进行纠正
    file = `/${mod?.path?.replace(/.*?\//, `${pageId}/`)}`
  }
  return file + (mod.type === 'style' ? '.less' : '.js')
}
