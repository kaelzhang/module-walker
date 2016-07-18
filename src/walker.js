
'use strict'

const { parseDependenciesFromAST } = require('./dependency')
const traceCircular = require('./circular')
const {
  matchExt,
  astFromSource
} = require('./utils')

const node_path = require('path')
const fs = require('fs')
const util = require('util')
const { EventEmitter } = require('events')

const resolve = require('resolve')
const mix = require('mix2')
const make_array = require('make-array')
const async = require('async')
const set = require('set-options')


// [ref](http://nodejs.org/api/modules.html#modules_file_modules)
const EXTS_NODE = ['.js', '.json', '.node']
const DEFAULT_WALKER_OPTIONS = {
  concurrency: 10,
  extensions: EXTS_NODE,
  allowCyclic: true,
  allowAbsoluteDependency: true
  // pathFilter
  // paths:
  // moduleDirectory: 'node_modules'
}


// @param {Object} options
// - concurrency
module.exports = class Walker extends EventEmitter {

  // @param {Object} options see walker-promise.js
  constructor (entries, options, callback) {
    super()

    this.options = set(options, DEFAULT_WALKER_OPTIONS)

    this.nodes = {}
    this.callback = callback

    this._init_queue()
    this._walk(entries)
  }

  _init_queue () {
    this.queue = async.queue((task, done) => {
      // `path` will always be an absolute path.
      let path = task.path

      this._parse_file(path, err => {
        if (!err) {
          return done()
        }

        this.queue.kill()
        this.error = err
        this._done()
      })

    }, this.options.concurrency)

    this.queue.drain = () => {
      this._done()
    }
  }

  _walk (entries) {
    make_array(entries).forEach(entry => {
      entry = node_path.resolve(entry)
      this._walk_one(entry)
    })
  }

  _walk_one (entry) {
    if (this._has_node(entry)) {
      return
    }

    let node = this._create_node(entry)

    if (node.foreign) {
      return
    }

    this.queue.push({
      path: entry
    })
  }

  _done () {
    this.callback(this.error || null, this.nodes)
  }

  _parse_file (path, callback) {
    this._get_compiled_content(path, (err, compiled) => {
      if (err) {
        return callback(err)
      }

      let node = this._get_node(path)
      node.require = {}
      node.resolve = {}
      node.async = {}
      node.code = compiled.content

      if (!compiled.js) {
        return callback(null)
      }

      let ast = astFromSource(compiled.content)

      parseDependenciesFromAST(ast, this.options).then(
        (data) => {
          async.each(['require', 'resolve', 'async'], (type, done) => {
            this._parse_dependencies_by_type(path, data[type], type, done)
          }, callback)
        },

        (err) => {
          err.message = `${path}: $err.message`
          callback(err)
        }
      )
    })
  }

  _get_compiled_content (filename, callback) {
    this._read(filename, (err, content) => {
      if (err) {
        return callback(err)
      }

      this._compile(filename, content, callback)
    })
  }

  _read (path, callback) {
    fs.readFile(path, (err, content) => {
      if (err) {
        return callback({
          code: 'ERROR_READ_FILE',
          message: 'Error reading module "' + path + '": ' + err.stack,
          data: {
            path: path,
            error: err
          }
        })
      }

      callback(null, content.toString())
    })
  }

  // Applies all compilers to process the file content
  _compile (filename, content, callback) {
    let tasks = this.options.compilers.filter(c => {
      return c.test.test(filename)

    }).reduce((prev, c) => {
      function task (compiled, done) {
        let options = mix({
          // adds `filename` to options of each compiler
          filename: filename

        }, c.options, false)
        c.compiler(compiled.content, options, done)
      }
      prev.push(task)
      return prev

    }, [init])

    // If no registered compilers, just return
    function init (done) {
      done(null, {
        content: content,
        js: matchExt(filename, 'js')
      })
    }

    async.waterfall(tasks, callback)
  }

  _parse_dependencies_by_type (path, paths, type, callback) {
    var options = this.options
    var node = this._get_node(path)

    async.each(paths, (dep, done) => {
      var origin = dep

      if (dep.indexOf('/') === 0) {
        var message = {
          code: 'NOT_ALLOW_ABSOLUTE_PATH',
          message: 'Requiring an absolute path "' + dep + '" is not allowed in "' + path + '"',
          data: {
            dependency: dep,
            path: path
          }
        }

        if (!options.allowAbsoluteDependency) {
          return done(message)
        } else {
          this.emit('warn', message)
        }
      }

      // if (!this._is_relative_path(dep)) {
      //   // we only map top level id for now
      //   dep = this._solve_aliased_dependency(options['as'][dep], path) || dep
      // }

      // package name, not a path
      if (!this._is_relative_path(dep)) {
        return this._deal_dependency(origin, dep, node, type, done)
      }

      let resolveOptions = {
        basedir: node_path.dirname(path),
        extensions: options.extensions
      }

      ;[
        'pathFilter',
        'paths',
        'moduleDirectory'

      ].forEach((key) => {
        if (key in this.options) {
          resolveOptions[key] = this.options[key]
        }
      })

      resolve(dep, resolveOptions, (err, real) => {
        if (err) {
          return done({
            code: 'MODULE_NOT_FOUND',
            message: err.message,
            stack: err.stack,
            data: {
              path: dep
            }
          })
        }

        this._deal_dependency(origin, real, node, type, done)
      })
    }, callback)
  }

  // // #17
  // // If we define an `as` field in cortex.json
  // // {
  // //   "as": {
  // //     "abc": './abc.js' // ./abc.js is relative to the root directory
  // //   }
  // // }
  // // @param {String} dep path of dependency
  // // @param {String} env_path the path of the current file
  // _solve_aliased_dependency (dep, env_path) {
  //   var cwd = this.options.cwd

  //   if (!dep || !cwd || !this._is_relative_path(dep)) {
  //     return dep
  //   }

  //   dep = node_path.join(cwd, dep)
  //   dep = node_path.relative(node_path.dirname(env_path), dep)
  //     // After join and relative, dep will contains `node_path.sep` which varies from operating system,
  //     // so normalize it
  //     .replace(/\\/g, '/')

  //   if (!~dep.indexOf('..')) {
  //     // 'abc.js' -> './abc.js'
  //     dep = './' + dep
  //   }

  //   return dep
  // }

  _deal_dependency (dep, real, node, type, callback) {
    node[type][dep] = real

    if (!this._has_node(real)) {
      // Only walk a module file if the node not exists.
      this._walk_one(real)
      return callback(null)
    }

    var sub_node = this._get_node(real)

    // We only check the node if it meets the conditions below:
    // 1. already exists: all new nodes are innocent.
    // 2. but assigned as a dependency of anothor node
    // If one of the ancestor dependents of `node` is `current`, it forms a circle.
    var circular_trace
    // node -> sub_node
    if (circular_trace = traceCircular(sub_node, node, this.nodes)) {
      var message = {
        code: 'CYCLIC_DEPENDENCY',
        message: 'Cyclic dependency found: \n' + this._print_cyclic(circular_trace),
        data: {
          trace: circular_trace,
          path: real
        }
      }

      if (!this.options.allowCyclic) {
        return callback(message)
      } else {
        this.emit('warn', message)
      }
    }
    callback(null)
  }

  _has_node  (path) {
    return path in this.nodes
  }

  _get_node (path) {
    return this.nodes[path]
  }

  // Creates the node by id if not exists.
  // No fault tolerance for the sake of private method
  // @param {string} id
  // - `path` must be absolute path if is a relative module
  // - package name for foreign module
  _create_node (id) {
    return this.nodes[id] = {
      id: id,
      foreign: this._is_foreign(id)
    }
  }

  _is_foreign (path) {
    return !this._is_absolute_path(path)
  }

  _is_absolute_path (path) {
    return node_path.resolve(path) === path.replace(/[\/\\]+$/, '')
  }

  _is_relative_path (path) {
    // Actually, this method is called after the parser.js,
    // and all paths are parsed from require(foo),
    // so `foo` will never be affected by windows,
    // so we should not use `'.' + node_path.sep` to test these paths
    return path.indexOf('./') === 0 || path.indexOf('../') === 0
  }

  // 1. <path>
  // 2. <path>
  //
  _print_cyclic (trace) {
    var list = trace.map(function (node, index) {
      return index + 1 + ': ' + node.id
    })
    list.pop()

    var flow = trace.map(function (node, index) {
      ++ index
      return index === 1 || index === trace.length
        ? '[1]'
        : index
    })

    return list.join('\n') + '\n\n' + flow.join(' -> ')
  }
}
