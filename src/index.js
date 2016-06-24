'use strict'

module.exports = walker

const Walker = require('./walker')
const { parseDependenciesFromAST } = require('./dependency')
const { astFromSource } = require('./utils')

function walker (options) {
  return new Walker(options)
}


walker.parseDependenciesFromAST = parseDependenciesFromAST
walker.astFromSource = astFromSource
