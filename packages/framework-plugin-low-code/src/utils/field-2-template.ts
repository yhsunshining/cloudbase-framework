function isSimpleType(dataType: string) {
  return dataType !== 'object' && dataType !== 'array'
}

/**
 * 将 IField 结构转换为 JSON 模版
 *  模版结构可参考 src/ds-helper/json-transform.ts 说明
 * @param field 字段结构描述, 有插值的则需有 keyPath 属性
 */
export function convertField2Template(field: any, result?: any) {
  if (isSimpleType(field.dataType)) {
    const val = field.keyPath ? `{{${field.keyPath}}}` : field.defaultValue
    if (!field.name || !result) return val
    result[field.name] = val
    return result
  }
  if (field.dataType === 'array') {
    if (!result) result = {}
    if (field.keyPath) {
      result[`${field.name || ''}$${field.keyPath}$`] = convertField2Template(field.items as any)
    } else {
      result[`${field.name || ''}`] = [convertField2Template(field.items as any)]
    }
  } else {
    let child = {}
    if (!result) {
      result = {}
      child = result
    } else {
      child = result[field.name!] = {};
    }
    (field.items as any[]).forEach(item => {
      convertField2Template(item, child)
    })
  }
  return result
}