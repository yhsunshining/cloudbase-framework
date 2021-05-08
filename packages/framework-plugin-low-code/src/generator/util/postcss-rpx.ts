import postcss from 'postcss';

interface IRpxOptions {
  zoom: number;
}

export default postcss.plugin('wx-px2rpx', (opts) => {
  const { zoom = 1 } = (opts as IRpxOptions) || {};
  const pxRegExp = /\b(\d+(\.\d+)?)px\b/g;

  return (root) => {
    root.replaceValues(pxRegExp, { fast: 'px' }, (string) => {
      return `${zoom * parseInt(string)}rpx`;
    });
  };
});
