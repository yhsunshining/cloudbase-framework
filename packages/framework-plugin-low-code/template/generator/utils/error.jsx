import React from 'react'

export function createErrorFallback(cmpKey, id) {
  return function ComponentErrorFallback(props) {
    return (
      <div
        style={{ color: 'red', display: 'flex', alignItems: 'center' }}
        title={`组件${cmpKey} ${id}发生了错误，错误信息：${props.error}`}
      >
        {cmpKey}组件错误
      </div>
    )
  }
}
