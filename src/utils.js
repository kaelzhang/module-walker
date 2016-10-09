'use strict'

const { parse } = require('babylon')
const set = require('set-options')
const codeFrame = require('babel-code-frame')
const resolve = require('resolve')

const DEFAULT_BABYLON_OPTIONS = {
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  sourceType: 'module'
}


// @public
exports.astFromSource = (code, sourceFilename) => {
  const options = set({
    sourceFilename
  }, DEFAULT_BABYLON_OPTIONS)

  let ast

  try {
    ast = parse(code, options)
  } catch (error) {
    const loc = error.loc
    const printed = codeFrame(code, loc.line, loc.col, {
      highlightCode: true
    })
    let message = `${error.message} while parsing "${sourceFilename}"

${printed}
`
    let e = new SyntaxError(message)
    e.loc = loc
    throw e
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
