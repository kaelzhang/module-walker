'use strict'

const util = require('util')
const { EventEmitter } = require('events')

const set = require('set-options')
const make_array = require('make-array')
const unique = require('make-unique')
const { Minimatch } = require('minimatch')

const Walker = require('./walker')

module.exports = class WalkerWrapper extends EventEmitter {
  constructor (options) {
    super()
    this.options = options
    this.entries = []
    this.options.compilers = make_array(this.options.compilers)
      .map(this._cleanCompiler, this)
  }

  walk (entry) {
    this.entries = this.entries.concat(entry)
    return this
  }

  register (new_compilers) {
    make_array(new_compilers).forEach(compiler => {
      this.options.compilers.push(this._cleanCompiler(compiler))
    })

    return this
  }

  _compilerTest (test) {
    if (typeof test === 'function') {
      return test
    }

    if (util.isRegExp(test)) {
      return (compiled) => {
        return test.test(compiled.filename)
      }
    }

    let mm = new Minimatch(test)

    return (compiled) => {
      return mm.match(compiled.filename)
    }
  }


  _cleanCompiler ({
    test,
    compiler,
    options
  }) {
    test = this._compilerTest(test)

    return {
      test,
      compiler,
      options
    }
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
