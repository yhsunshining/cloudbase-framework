import postcss from 'postcss';

interface IRpxOptions {
  zoom: number;
}

// export default postcss('wx-px2rpx', (opts) => {
// const { zoom = 1 } = (opts as IRpxOptions) || {};
// const pxRegExp = /\b(\d+(\.\d+)?)px\b/g;

// return (root) => {
//   root.replaceValues(pxRegExp, { fast: 'px' }, (string) => {
//     return `${zoom * parseInt(string)}rpx`;
//   });
// };
// });

const plugin = (opts = {}) => {
  const { zoom = 1 } = (opts as IRpxOptions) || {};
  const pxRegExp = /\b(\d+(\.\d+)?)px\b/g;
  return {
    postcssPlugin: 'wx-px2rpx',
    Once(root, { result }) {
      root.replaceValues(pxRegExp, { fast: 'px' }, (string) => {
        return `${zoom * parseInt(string)}rpx`;
      });
    },
  };
};

plugin.postcss = true;
export default plugin;
