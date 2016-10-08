'use strict'

module.exports = walker

const WalkerPromise = require('./walker-promise')
const { parseDependenciesFromAST } = require('./dependency')

const set = require('set-options')
const make_array = require('make-array')

function walker (options) {
  return new WalkerPromise(options)
}


walker.parseDependenciesFromAST = parseDependenciesFromAST
