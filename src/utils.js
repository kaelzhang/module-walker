'use strict'

const { parse } = require('babylon')
const set = require('set-options')

const DEFAULT_BABYLON_OPTIONS = {
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  sourceType: 'module'
}

// @public
exports.astFromSource = (code, options = {}) => {
  options = set(options, DEFAULT_BABYLON_OPTIONS)
  return parse(code, options)
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


// exports.simple_clone = function (object) {
//   let key
//   let obj = {}
//   for (key in object) {
//     obj[key] = exports._shadow_clone(object[key])
//   }

//   return obj
// }


// exports._shadow_clone = function (object) {
//   function F () {}
//   F.prototype = object
//   return new F
// }