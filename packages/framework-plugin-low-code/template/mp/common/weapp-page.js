import { observable, autorun } from 'mobx'
import { createComputed, createEventHandlers, touchObj } from './util'
import { resolveWidgetData, createWidgets } from './widget'
import { createDataVar, buildDataVarFetchFn, createDataset, updateDatasetParams, createStateDatasrouceVar } from '../datasources/index'


export function createPage(
  lifecycle,
  widgetProps,
  pageState,
  pageComputed,
  evtListeners,
  dataBinds,
  app,
  $page
) {
  $page.state = observable(pageState)
  $page.dataVar = createDataVar($page.id)
  let dataset = createDataset($page.id)
  $page.dataset = dataset
  $page.state.dataset = dataset
  $page.computed = createComputed(pageComputed)
  $page.widgets = {}
  const { widgets } = $page
  createWidgets(widgetProps, dataBinds, widgets)
  let fetchDataVar = buildDataVarFetchFn($page.id) || function() {}

  // page data
  const dataFactory = {
    /* <%= dataPropNames.pageState %>: () => pageState,
    <%= dataPropNames.appState %>: () => app.state,
    <%= dataPropNames.pageComputed %>: () => pageComputed,
    <%= dataPropNames.appComputed %>: () => app.computed,
    */
  }

  for (const id in widgets) {
    const props = widgets[id]
    dataFactory['<%= dataPropNames.widgetProp %>' + id] = () => resolveWidgetData(props)
  }

  const evtHandlers = createEventHandlers(evtListeners)

  function createInitData() {
    const data = {}
    for (const k in dataFactory) {
      try {
        data[k] = dataFactory[k]()
      } catch (e) {
        console.warn(`Create init data(${k}) error:`, e)
      }
    }
    return data
  }

  function extractLifecyles() {
    const result = { ...lifecycle }
    const nameMaps = [
      ['onReady', 'onPageReady'],
      ['onHide', 'onPageHide'],
      ['onUnload', 'onPageUnload'],
    ]
    nameMaps.forEach(e => {
      if (!result[e[0]] && result[e[1]]) {
        result[e[0]] = result[e[1]]
        delete result[e[1]]
      }
    })
    return result
  }

  return {
    ...extractLifecyles(),
    data: createInitData(),
    mobxDisposers: {}, // ToDo dispose me
    /** lifecycles **/
    onLoad: function (options) {
      app.activePage = $page
      this.createReactiveState()

      updateDatasetParams($page.id, options || {})

      // 页面创建时执行
      const hook = lifecycle.onLoad || lifecycle.onPageLoad
      fetchDataVar()
      createStateDatasrouceVar($page.id, {app, $page})

      hook && hook.call(this, options)
    },
    onShow: function () {
      app.activePage = $page

      // 页面创建时执行
      const hook = lifecycle.onShow || lifecycle.onPageShow
      hook && hook.call(this)
    },

    ...evtHandlers,

    createReactiveState() {
      for (const k in dataFactory) {
        autorun(r => {
          this.requestRender({ [k]: dataFactory[k]() })
        })
      }
    },

    // setData merging
    pendingData: null,
    requestRender(data) {
      if (!this.pendingData) {
        this.pendingData = {}
        wx.nextTick(() => {
          const label = 'Set data ' + Object.keys(this.pendingData).join(',')
            <% if (debug) {%> console.time(label) <%} %>
              this.setData(this.pendingData, () => {
            <% if (debug) {%> console.timeEnd(label) <%} %>
          })
          this.pendingData = null
        })
      }
      touchObj(data)  // Touch all props to monitor data deeply, FIXME
      Object.assign(this.pendingData, data)
    },
    getWeAppInst: () => $page,
  }
}
