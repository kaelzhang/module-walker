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
  concurrency: 50,
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
      // `filename` will always be an absolute path.
      let filename = task.node.id
      this._parse_file(filename, task.type, err => {
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
      let node = this._get_node(entry)
      if (node) {
        return
      }

      this._walk_one(this._create_node(entry))
    })
  }

  _walk_one (node, type) {
    type = type || 'require'

    // All ready parsed
    if (~node.type.indexOf(type)) {
      return
    }
    node.type.push(type)

    if (node.foreign) {
      return
    }

    this.queue.push({
      node: node,
      type: type
    })
  }

  _done () {
    this.callback(this.error || null, this.nodes)
  }

  _parse_file (path, type, callback) {
    let node = this._get_node(path)

    this._get_compiled_content(node, err => {
      if (err) {
        return callback(err)
      }

      if (!node.js || type !== 'require') {
        return callback(null)
      }

      parseDependenciesFromAST(node.ast, this.options).then(
        (data) => {
          async.each(['require', 'resolve', 'async'], (type, done) => {
            this._parse_dependencies_by_type(path, data[type], type, done)
          }, callback)
        },

        (err) => {
          err.message = `${path}: ${err.message}`
          callback(err)
        }
      )
    })
  }

  _get_compiled_content (node, callback) {
    if (node.content) {
      return callback(null)
    }

    let filename = node.id
    this._read(filename, (err, content) => {
      if (err) {
        return callback(err)
      }

      this._compile(filename, content, (err, compiled) => {
        if (err) {
          return callback(err)
        }

        mix(node, compiled)
        console.log(node)
        callback(null)
      })
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
      let task = (compiled, done) => {
        let ast = compiled.ast

        // if no ast, try to generate ast
        if (!ast && compiled.js) {
          try {
            ast = astFromSource(compiled.code, this.options)
          } catch (e) {
            return done(e)
          }
        }

        let options = set({}, c.options)
        if (ast) {
          options.ast
        }

        if (compiled.map) {
          options.map = compiled.map
        }

        // adds `filename` to options of each compiler
        options.filename = filename
        c.compiler(compiled.code, options, done)
      }
      prev.push(task)
      return prev

    }, [init])

    // If no registered compilers, just return
    function init (done) {
      let node = matchExt(filename, 'node')
      let json = matchExt(filename, 'json')
      let js = matchExt(filename, 'js')

      done(null, {
        code: content,
        json,
        node,
        js
      })
    }

    async.waterfall(tasks, callback)
  }

  _parse_dependencies_by_type (path, paths, type, callback) {
    let node = this._get_node(path)

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

        if (!this.options.allowAbsoluteDependency) {
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
        extensions: this.options.extensions
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

    let sub_node = this._get_node(real)
    let new_node = sub_node || this._create_node(real)
    this._walk_one(new_node, type)

    // We only check the node if it meets the conditions below:
    // 1. already exists: all new nodes are innocent.
    // 2. but assigned as a dependency of anothor node
    // If one of the ancestor dependents of `node` is `current`, it forms a circle.

    // If newly created node, then skip checking.
    if (!sub_node) {
      return callback(null)
    }
    sub_node = new_node

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
      foreign: this._is_foreign(id),
      type: [],
      require: {},
      resolve: {},
      async: {}
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
    return path === '.'
      || path === '..'
      || path.indexOf('./') === 0
      || path.indexOf('../') === 0
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
