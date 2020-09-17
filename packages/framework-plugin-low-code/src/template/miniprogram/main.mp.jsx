import 'utils/kbone' // ensure before all other imports
import 'app/mountMpApis'
import '../../app/mountMpApis'
import React from 'react'
import { render } from 'react-dom'
import App from './index'

export default function createApp() {
  const container = document.createElement('div')
  container.id = 'app'
  document.body.appendChild(container)
  document.documentElement.style.fontSize = wx.getSystemInfoSync().screenWidth / (375 / 14) + 'px'

  render(<App />, container)
}
