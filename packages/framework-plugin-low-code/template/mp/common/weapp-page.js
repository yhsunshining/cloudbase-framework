import { observable } from 'mobx'
import { createComputed, createEventHandlers } from './util'
import { createWidgets, resolveWidgetData } from './widget'
import mergeRenderer from './merge-renderer'
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

  const evtHandlers = createEventHandlers(evtListeners)

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

  return Component({
    data: Object.keys(widgets).reduce((initData, id) => {
      initData[id] = resolveWidgetData(widgets[id])
      return initData
    }, {}),
    lifetimes: {
      attached() {
        this.initMergeRenderer(widgets)
      }
    },
    methods: {
      /** page lifecycles **/
      ...extractLifecyles(),
      onLoad: function (options) {
        app.activePage = $page
        let query = decodePageQuery(options || {})
        updateDatasetParams($page.id, query)
        // 页面创建时执行
        fetchDataVar()
        createStateDatasrouceVar($page.id, {app, $page})

        const hook = lifecycle.onLoad || lifecycle.onPageLoad
        hook && hook.call(this, query)
      },
      onShow: function () {
        app.activePage = $page

        const hook = lifecycle.onShow || lifecycle.onPageShow
        hook && hook.call(this)
      },

      ...evtHandlers,
      ...mergeRenderer,
      getWeAppInst: () => $page,
    },
  })
}

function decodePageQuery(query) {
  return Object.keys(query).reduce((decoded, key) => {
    decoded[key] = decodeURIComponent(query[key])
    return decoded
  }, {})
}
