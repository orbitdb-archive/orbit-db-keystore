'use strict'

const path = require('path')
const Uglify = require('uglifyjs-webpack-plugin')

module.exports = {
  entry: './index-browser.js',
  output: {
    libraryTarget: 'var',
    library: 'Keystore',
    filename: 'dist/index-browser.min.js'
  },
  target: 'web',
  devtool: 'sourcemap',
  node: {
    console: false,
    Buffer: true
  },
  plugins: [
    new Uglify()
  ],
  resolve: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ]
  },
  resolveLoader: {
    modules: [
      'node_modules',
      path.resolve(__dirname, '../node_modules')
    ],
    moduleExtensions: ['-loader']
  }
}
