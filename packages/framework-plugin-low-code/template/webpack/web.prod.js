const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const themeVars = require('./themeVars');
const HappyPack = require('happypack');
const core = 4;
const happyThreadPool = HappyPack.ThreadPool({ size: core });

module.exports = function (options) {
  const {
    context,
    entry,
    output,
    mode,
    watch,
    externals,
    resolveModules,
    htmlTemplatePath,
    htmlTemplateData = {
      meta: {},
    },
    definePlugin = {},
  } = options;
  const isDevelopment = mode !== 'production';
  let plugins = [
    new HappyPack({
      id: 'babel',
      loaders: [
        {
          loader: 'babel-loader',
          options: {
            compact: false,
            cacheDirectory: true,
            cwd: context,
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: {
                    esmodules: true,
                  },
                },
              ],
              '@babel/preset-react',
            ],
            plugins: [
              [
                'babel-plugin-import',
                {
                  libraryName: '@govcloud/gsd-kbone-react',
                  libraryDirectory: 'lib/components',
                  camel2DashComponentName: false,
                },
              ],
              '@babel/plugin-proposal-class-properties',
              ['@babel/plugin-proposal-decorators', { legacy: true }],
              '@babel/plugin-proposal-export-default-from',
              '@babel/plugin-proposal-export-namespace-from',
              '@babel/plugin-proposal-optional-chaining',
              '@babel/plugin-proposal-partial-application',
              [
                '@babel/plugin-proposal-pipeline-operator',
                { proposal: 'minimal' },
              ],
            ].filter(Boolean),
          },
        },
      ],
      threadPool: happyThreadPool,
    }),
    new HtmlWebpackPlugin({
      template: htmlTemplatePath,
      filename: 'index.html',
      cache: false,
      templateParameters: htmlTemplateData,
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
      chunkFilename: '[id].[contenthash].css',
    }),
    new webpack.DefinePlugin(
      Object.assign(
        {
          'process.env.isMiniprogram': false, // 注入环境变量，用于业务代码判断
          'process.env.SSR': false,
        },
        definePlugin
      )
    ),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, '../assets'),
          to: '.',
          noErrorOnMissing: true,
        },
      ],
    }),
  ];
  if (isDevelopment) {
    plugins.concat([new HardSourceWebpackPlugin()]);
  } else {
    plugins = plugins.concat([
      new webpack.HashedModuleIdsPlugin({
        hashFunction: 'sha256',
        hashDigest: 'hex',
        hashDigestLength: 20,
      }),
      new webpack.EnvironmentPlugin({
        SSR: false,
        WEBPACK_ENV: 'production',
      }),
    ]);
  }
  return {
    context,
    entry,
    mode,
    watch,
    output,
    externals,
    cache: {
      type: 'memory',
    },
    devtool: isDevelopment ? 'eval' : false,
    resolve: {
      extensions: ['.js', '.jsx', '.tsx', '.json', '.scss', '.css'],
      modules: [...resolveModules],
      symlinks: false,
      cacheWithContext: false,
      alias: {
        '@': path.resolve(__dirname, '../src'),
        // react: 'preact/compat',
        // 'react-dom/test-utils': 'preact/test-utils',
        // 'react-dom': 'preact/compat',
      },
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules\/(?!@cloudbase\/weda-ui)|gsd-kbone-react/,
          use: ['happypack/loader?id=babel'],
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
                postcssOptions: {
                  plugins: [
                    [
                      'postcss-pxtorem',
                      {
                        rootValue: 14,
                        propList: ['*'],
                        // todo
                        selectorBlackList: ['.weui-picker__indicator'],
                      },
                    ],
                  ],
                },
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
                postcssOptions: {
                  plugins: [
                    [
                      'postcss-pxtorem',
                      {
                        rootValue: 14,
                        propList: ['*'],
                        // todo
                        selectorBlackList: ['.weui-picker__indicator'],
                      },
                    ],
                  ],
                },
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
    plugins,
    optimization: {
      concatenateModules: true,
      noEmitOnErrors: true,
      splitChunks: {
        cacheGroups: {
          base: {
            test: /(react|react-dom|react-router|react-router-dom|mobx|mobx-react-lite|@cloudbase\/js-sdk)/,
            chunks: 'all',
            priority: 100, //优先级
          },
          utils: {
            test: /(lodash|dayjs|axios|kbone-api|fastclick)/,
            chunks: 'all',
            priority: 100, //优先级
          },
          'async-commons': {
            chunks: 'async',
            minChunks: 2,
            priority: 20,
          },
          commons: {
            chunks: 'all',
            minChunks: 2,
            priority: 20,
          },
        },
      },
      ...(isDevelopment
        ? {
            minimize: false,
            removeAvailableModules: false,
            removeEmptyChunks: true,
          }
        : {
            minimizer: [
              new TerserPlugin({
                test: /\.js(\?.*)?$/i,
                cache: false,
                parallel: true,
                sourceMap: false,
              }),
            ],
          }),
    },
  };
};
