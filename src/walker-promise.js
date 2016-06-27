'use strict'

const util = require('util')

const set = require('set-options')
const make_array = require('make-array')
const unique = require('array-unique')

const Walker = require('./walker')

// [ref](http://nodejs.org/api/modules.html#modules_file_modules)
const EXTS_NODE = ['.js', '.json', '.node']
const DEFAULT_WALKER_OPTIONS = {
  concurrency: 10,
  extensions: EXTS_NODE
}


class WalkerWrapper {
  constructor (options) {
    this.options = set(options, DEFAULT_WALKER_OPTIONS)
    this.entries = []

    this.options.compilers =
    this.compilers =
      make_array(this.options.compilers)

    if (!this._checkExtensions()) {
      throw new Error('Invalid value of `options.extensions`')
    }
  }

  // Checks if the `options.extensions` is valid
  _checkExtensions () {
    var exts = this.options.extensions

    if (!util.isArray(exts)) {
      return false
    }

    return exts.every(function (ext, i) {
      return ext === EXTS_NODE[i]
    })
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

      this.compilers.push(compiler)
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
