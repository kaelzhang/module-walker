'use strict'

const { parse } = require('babylon')
const set = require('set-options')

const DEFAULT_BABYLON_OPTIONS = {
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  sourceType: 'module'
}

exports.astFromSource = (code, options = {}) => {
  options = set(options, DEFAULT_BABYLON_OPTIONS)
  return parse(code, options)
}


exports.throw = function (enable, message) {
  if (enable) {
    throw new Error(message)
  }
}
