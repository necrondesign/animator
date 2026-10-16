/**
 * Copyright (c) Haiku 2016-2018. All rights reserved.
 */

const path = require('path');

module.exports = {
  devtool: 'source-map',
  watch: true,
  entry: {
    HaikuDOMAdapter: path.resolve(require.resolve('@haiku/core'), '..', 'src', 'adapters', 'dom'),
  },
  output: {
    path: path.resolve(__dirname, 'webpack'),
    filename: '[name].js',
    library: '[name]',
    libraryTarget: 'window',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /src\/.+\.ts$/,
        loader: 'ts-loader',
        options: {
          configFile: path.join(__dirname, '..', '..', '@haiku', 'core', 'tsconfig.json'),
        },
      },
    ],
  },
  mode: 'development',
};
