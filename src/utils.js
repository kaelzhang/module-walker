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


exports.flavorAstError = (error, {filename, code}) => {
  const loc = error.loc
  const printed = exports.printCode(code, loc)
  let message = `${error.message} while parsing "${filename}"

${printed}
`
  let e = new SyntaxError(message)
  e.loc = loc
  throw e
}


// @public
exports.astFromSource = (code, options = {}) => {
  options = set(options, DEFAULT_BABYLON_OPTIONS)

  let ast

  try {
    ast = parse(code, options)
  } catch (e) {
    exports.flavorAstError(e, {
      filename: options.filename,
      code
    })
  }

  return ast
}


exports.resolve = (id, options = {}, callback) => {
  return resolve(id, options, callback)
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
