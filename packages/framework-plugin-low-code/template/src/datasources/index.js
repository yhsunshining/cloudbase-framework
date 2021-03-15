import {
  setConfig,
  initTcb,
} from '@cloudbase/weda-cloud-sdk/dist/h5'
export { 
  createDataset,
  createStateDataSourceVar,
  generateParamsParser,
  EXTRA_API,
  CLOUD_SDK,
  DS_API,
  DS_SDK,
} from '@cloudbase/weda-cloud-sdk/dist/h5'

import config from './config'

setConfig(config)
initTcb()