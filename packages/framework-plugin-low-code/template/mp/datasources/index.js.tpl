export { TCBError } from './utils'
import { setConfig } from './utils'
export { createDataVar, buildDataVarFetchFn } from './datavar'
export { createDataset, updateDatasetParams, createStateDatasrouceVar } from './dataset'
export { dataSources, createDataSource } from './datasources'
import { init } from './tcb'

setConfig({
  envID: '<%= envId %>' || undefined
})
init()
