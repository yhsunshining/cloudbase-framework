const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const MpPlugin = require('mp-webpack-plugin')
const themeVars = require('./themeVars')
// 分析包模块使用 请勿删除
// const bundleAnalyzer = require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const isOptimize = false // 是否压缩业务代码，开发者工具可能无法完美支持业务代码使用到的 es 特性，建议自己做代码压缩

module.exports = function(options) {
  const { context, entry, resolveModules, outputPath, mode, watch } = options

  return {
    context,
    mode,
    watch,
    entry,
    output: {
      path: outputPath, // 放到小程序代码目录中的 common 目录下
      filename: '[name].js', // 必需字段，不能修改
      library: 'createApp', // 必需字段，不能修改
      libraryExport: 'default', // 必需字段，不能修改
      libraryTarget: 'window', // 必需字段，不能修改
    },
    target: 'web', // 必需字段，不能修改
    optimization: {
      runtimeChunk: false, // 必需字段，不能修改
      splitChunks: {
        // 代码分隔配置，不建议修改
        chunks: 'all',
        minSize: 1000,
        maxSize: 0,
        minChunks: 1,
        maxAsyncRequests: 100,
        maxInitialRequests: 100,
        automaticNameDelimiter: '~',
        name: true,
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },

      minimizer:
        mode === 'production'
          ? [
              // 压缩CSS
              new OptimizeCSSAssetsPlugin({
                assetNameRegExp: /\.(css|wxss)$/g,
                cssProcessor: require('cssnano'),
                cssProcessorPluginOptions: {
                  preset: [
                    'default',
                    {
                      discardComments: {
                        removeAll: true,
                      },
                      minifySelectors: false, // 因为 wxss 编译器不支持 .some>:first-child 这样格式的代码，所以暂时禁掉这个
                    },
                  ],
                },
                canPrint: false,
              }),
              // 压缩 js
              new TerserPlugin({
                test: /\.js(\?.*)?$/i,
                parallel: true,
                terserOptions: {
                  compress: {
                    // eslint-disable-next-line @typescript-eslint/camelcase
                    drop_console: true,
                  },
                },
              }),
            ]
          : [],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          loader: 'babel-loader',
          exclude: /node_modules|gsd-kbone-react/,
          options: {
            compact: false,
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: {
                    ios: '10',
                    android: '4'
                  },
                  modules: 'commonjs',
                },
              ],
              '@babel/preset-react',
            ],
            plugins: [
              ['babel-plugin-import', {libraryName: '@govcloud/gsd-kbone-react', libraryDirectory: 'lib/components', camel2DashComponentName: false}],
              '@babel/plugin-proposal-class-properties',
              ['@babel/plugin-proposal-decorators', { legacy: true }],
              '@babel/plugin-proposal-export-default-from',
              ['@babel/plugin-transform-modules-commonjs', { noInterop: true }],
              '@babel/plugin-proposal-export-namespace-from',
              '@babel/plugin-proposal-optional-chaining',
              '@babel/plugin-proposal-partial-application',
              ['@babel/plugin-proposal-pipeline-operator', { proposal: 'minimal' }],
              [
                '@babel/plugin-transform-react-jsx',
                {
                  // "pragma": "h",
                  pragmaFrag: 'Fragment',
                },
              ],
            ],
          },
        },
        {
          test: /\.(scss|sass)$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                modules: false,
                importLoaders: 2,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                ident: 'postcss',
                plugins: loader => [
                  require('postcss-pxtorem')({
                    rootValue: 14,
                    propList: ['*'],
                    // todo
                    selectorBlackList: ['.weui-picker__indicator'],
                  }),
                ],
              },
            },
            {
              loader: 'sass-loader',
              options: {
                implementation: require('dart-sass'),
              },
            },
          ],
        },
        {
          test: /\.(css|less)$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                modules: false,
                importLoaders: 2,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                ident: 'postcss',
                plugins: loader => [
                  require('postcss-pxtorem')({
                    rootValue: 14,
                    propList: ['*'],
                    // todo
                    selectorBlackList: ['.weui-picker__indicator'],
                  }),
                ],
              },
            },
            {
              loader: 'less-loader',
              options: {
                lessOptions: {
                  modifyVars: themeVars,
                },
              },
            },
          ],
        },
        {
          test: /\.(jpe?g|png|gif|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
          loader: 'base64-inline-loader',
        },
      ],
    },
    resolve: {
      extensions: ['.js', '.jsx', '.tsx', '.ts', '.json', '.scss', '.css', '.less'],
      modules: [...resolveModules],
      alias: {
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat',
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.isMiniprogram': true, // 注入环境变量，用于业务代码判断
        'process.env.SSR': false,
      }),
      new MiniCssExtractPlugin({
        filename: '[name].wxss',
      }),
      new MpPlugin(require('./miniprogram.config')),
      // 分析包模块使用 请勿删除
      // new bundleAnalyzer({
      //   // 將分析結果以 HTML 格式儲存
      //   analyzerMode: "static",

      //   // 分析結果存放位置
      //   // 預設位置為 output.path + "/report.html"
      //   reportFilename: "../../report.html",

      //   // Webpack 執行完畢後，是否用瀏覽器自動開啟
      //   // 預設為 true
      //   openAnalyzer: true,
      // }),
    ],
  }
}
