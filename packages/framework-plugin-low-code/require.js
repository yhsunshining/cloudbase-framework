const list = Object.keys({
  '@cloudbase/cals': '0.1.2-2',
  '@cloudbase/framework-core': '^1.6.13',
  '@cloudbase/framework-plugin-auth': '^1.6.13',
  '@cloudbase/framework-plugin-database': '^1.6.13',
  '@cloudbase/framework-plugin-function': '^1.6.13',
  '@cloudbase/framework-plugin-mp': 'v1.3.6-beta.8',
  '@cloudbase/framework-plugin-website': '^1.6.14',
  '@formily/react-schema-renderer': '1.1.7',
  archiver: '^4.0.1',
  axios: '^0.21.0',
  chalk: '^2.4.2',
  'command-exists': '^1.2.9',
  compressing: '^1.4.0',
  'cos-nodejs-sdk-v5': '^2.8.2',
  'cross-spawn': '^6.0.5',
  'fs-extra': '^7.0.1',
  'json-schema-defaults': '^0.4.0',
  less: '^3.10.3',
  lodash: '^4.17.11',
  'lodash.clone': '^4.5.0',
  'lodash.get': '^4.4.2',
  'lodash.set': '^4.3.2',
  'lodash.template': '^4.5.0',
  'merge-package-json': '^0.1.3',
  postcss: '^7.0.32',
  'postcss-pxtorem': '^5.1.1',
  prettier: '^2.0.5',
  qrcode: '^1.4.4',
  react: '^16.12.0',
  'react-dom': '^16.8.6',
  'react-eva': '^1.1.12',
  'symlink-dir': '^3.1.1',
  webpack: '^4.41.4',
  'xml-js': '^1.6.11',
})

// console.time('miniprogram-ci')
// require('miniprogram-ci')
// console.timeEnd('miniprogram-ci')

// console.time('load')
// for (let package of list) {
//   console.time(package)
//   require(package)
//   console.timeEnd(package)
// }
// console.timeEnd('load')

console.time('package')
require('./lib/index')
console.timeEnd('package')
