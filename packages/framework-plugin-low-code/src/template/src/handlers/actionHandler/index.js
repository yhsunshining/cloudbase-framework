if (!process.env.isMiniprogram) {
  require('intersection-observer-polyfill/index.global'); //eslint-disable-line
}

export * from './ComponentActionHandler';
