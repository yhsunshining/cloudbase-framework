import {
  setConfig,
  initTcb,
} from '@cloudbase/weda-cloud-sdk'
export { 
  createDataset,
  createStateDataSourceVar,
  generateParamsParser,
  EXTRA_API,
  CLOUD_SDK,
  DS_API,
  DS_SDK,
} from '@cloudbase/weda-cloud-sdk'

import config from './config'

setConfig(config)
initTcb()
