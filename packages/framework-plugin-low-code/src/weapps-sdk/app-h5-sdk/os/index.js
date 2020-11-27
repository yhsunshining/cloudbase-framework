const u = navigator.userAgent;
const isAndroid = u.indexOf('Android') > -1 || u.indexOf('Adr') > -1;   //判断是否是 android终端
const isIOS = !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/);
const isApp = isAndroid || isIOS
export default {
  isAndroid,
  isIOS,
  isApp
}
