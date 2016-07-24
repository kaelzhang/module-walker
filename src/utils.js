'use strict'

const { parse } = require('babylon')
const set = require('set-options')
const code = require('print-code')
const resolve = require('resolve')

const DEFAULT_BABYLON_OPTIONS = {
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  sourceType: 'module'
}


// Print the code of the error slice
exports.printCode = function (content, loc) {
  var gen = code(content)
    .highlight(loc.line)
    .slice(Math.max(0, loc.line - 2), loc.line + 2)

  if (typeof loc.column === 'number') {
    gen.arrow_mark(loc.line, loc.column)
  }

  return gen.get()
}


// @public
exports.astFromSource = (code, options = {}) => {
  options = set(options, DEFAULT_BABYLON_OPTIONS)
  return parse(code, options)
}


exports.resolve = (id, options = {}, callback) => {
  return resolve(id, options, callback)
}


exports.throw = function (enable, message) {
  if (enable) {
    throw new Error(message)
  }
}


const REGEX_EXT = /\.([a-z0-9]+)$/i

// @returns {Boolean}
exports.matchExt = function (path, ext) {
  let match = path.match(REGEX_EXT)
  return match
    ? match[1] === ext
    // if there is no extension
    : true
}
