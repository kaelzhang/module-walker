'use strict'

const util = require('util')
const { EventEmitter } = require('events')

const set = require('set-options')
const make_array = require('make-array')
const unique = require('array-unique')

const Walker = require('./walker')

module.exports = class WalkerWrapper extends EventEmitter {
  constructor (options) {
    super()

    this.options = options
    this.entries = []

    this.options.compilers = make_array(this.options.compilers)
  }

  walk (entry) {
    this.entries = this.entries.concat(entry)
    return this
  }

  register (new_compilers) {
    make_array(new_compilers).forEach(compiler => {
      compiler.test = util.isRegExp(compiler.test)
        ? compiler.test
        : new RegExp(compiler.test)

      this.options.compilers.push(compiler)
    })

    return this
  }

  _createPromise () {
    let entries = unique(this.entries)

    return new Promise((resolve, reject) => {
      new Walker(entries, this.options, (err, nodes) => {
        if (err) {
          return reject(err)
        }

        resolve(nodes)
      }).on('warn', (message) => {
        this.emit('warn', message)
      })
    })
  }

  then (resolve, reject) {
    return this._createPromise().then(resolve, reject)
  }

  catch (reject) {
    return this._createPromise().catch(reject)
  }
}
