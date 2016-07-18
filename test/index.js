'use strict'

const test = require('ava')

const expect = require('chai').expect
const walker = require('../')
const node_path = require('path')
const util = require('util')
const make_array = require('make-array')

const root = node_path.join(__dirname, 'fixtures', 'walker')

function dir_slash (err, path, nodes, entry, t) {
  t.is(err, null)
  var dep = './cases/dir/'
  var real = node_path.join( node_path.dirname(path), dep ) + 'index.js'
  t.is(entry.require[dep], real)
}

function multiple_requires (err, path, nodes, entry, t) {
  t.is(err, null)
}

const cases = [
  {
    desc: 'only foreign deps',
    file: 'simplest.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      t.is(nodes['abc'].foreign, true)
    }
  },
  {
    desc: 'one dep',
    file: 'one-dep/index.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      var dep = entry.require['./a']
      t.is(dep,  node_path.join(root, 'one-dep', 'a.js') )
    }
  },
  {
    desc: 'circular, with errors',
    file: 'circular/index.js',
    options: {
      allowCyclic: false
    },
    expect: function (err, path, nodes, entry, t) {
      t.is(err !== null, true)
      t.is(err.code, 'CYCLIC_DEPENDENCY')
    }
  },
  {
    desc: 'circular, with warnings',
    options: {
      allowCyclic: true
    },
    file: 'circular/index.js',
    expect: function (err, path, nodes, entry, t, warnings) {
      t.is(err, null)
      t.is(warnings.length !== 0, true)
    }
  },
  {
    desc: 'module not found',
    options: {
    },
    file: 'not-found/one.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err.code, 'MODULE_NOT_FOUND')
    }
  },
  {
    desc: 'module not found: fallback, still not found',
    options: {},
    file: 'not-found/two.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err.code, 'MODULE_NOT_FOUND')
    }
  },
  {
    desc: 'module not found: limited by exts',
    options: {
      extensions: ['.js', '.json']
    },
    file: 'not-found/three.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err.code, 'MODULE_NOT_FOUND')
    }
  },
  {
    desc: 'if not limited, could be found',
    options: {
    },
    file: 'not-found/three.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      t.is(!!entry, true)
    }
  },
  {
    desc: 'error require',
    file: 'error-require/a.js',
    options: {
      checkRequireLength: true
    },
    expect: function (err, path, nodes, entry, t) {
      t.is(err !== null, true)
      t.is(err.code, 'WRONG_USAGE_REQUIRE')
    }
  },
  {
    desc: 'modules: no-fallback',
    file: 'fallback/no-fallback.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      var dep = './cases/no-fallback'
      var real = node_path.join( node_path.dirname(path), dep )
      t.is(entry.require[dep], real)
    }
  },
  {
    desc: 'modules: no-fallback not found',
    file: 'fallback/no-fallback-not-found.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err.code, 'MODULE_NOT_FOUND')
    }
  },
  {
    desc: 'modules: fallback',
    file: 'fallback/fallback.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      var dep = './cases/fallback'
      var real = node_path.join( node_path.dirname(path), dep ) + '.js'
      t.is(entry.require[dep], real)
    }
  },
  {
    desc: 'modules: exact, no fallback',
    file: 'fallback/fallback-exact.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      var dep = './cases/fallback.js'
      var real = node_path.join( node_path.dirname(path), dep )
      t.is(entry.require[dep], real)
    }
  },
  {
    desc: 'modules: falback to json',
    file: 'fallback/fallback-json.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      var dep = './cases/fallback-json'
      var real = node_path.join( node_path.dirname(path), dep ) + '.json'
      t.is(entry.require[dep], real)
    }
  },
  {
    desc: 'modules: falback to node',
    options: {
    },
    file: 'fallback/fallback-node.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      var dep = './cases/fallback-node'
      var real = node_path.join( node_path.dirname(path), dep ) + '.node'
      t.is(entry.require[dep], real)
    }
  },
  {
    desc: 'modules: falback to node, without `".node"` extension',
    options: {
      extensions: ['.js', '.json']
    },
    file: 'fallback/fallback-node.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err.code, 'MODULE_NOT_FOUND')
    }
  },

  {
    desc: 'directories: dir without ending slash',
    options: {
    },
    file: 'fallback/dir.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      var dep = './cases/dir'
      var real = node_path.join( node_path.dirname(path), dep ) + node_path.sep + 'index.js'
      t.is(entry.require[dep], real)
    }
  },
  {
    desc: 'directories: dir with ending slash',
    options: {
    },
    file: 'fallback/dir-slash.js',
    expect: dir_slash
  },
  {
    desc: '#13: multiple requires',
    options: {
    },
    file: 'multi-require/index.js',
    expect: multiple_requires
  },
  {
    desc: '#25: multi-walker',
    options: {},
    file: ['fallback/dir-slash.js', 'multi-require/index.js'],
    expect: [dir_slash, multiple_requires],
    multi: true
  },
  {
    desc: '#14: parsing a json file will not fail',
    file: 'json/index.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
    }
  },
  // {
  //   desc: '#15: package.as',
  //   options: {
  //     'as': {
  //       'a': './a'
  //     }
  //   },
  //   file: 'as/index.js',
  //   expect: function (err, path, nodes, entry, t) {
  //     t.is(err, null)
  //     var a = node_path.join( node_path.dirname(path), 'a.js' )
  //     t.is('a' in entry.require, true)
  //     t.is(entry.require['a'], a)
  //   }
  // },
  // {
  //   desc: '#15: package.as, foreign',
  //   options: {
  //     'as': {
  //       'a': 'b'
  //     }
  //   },
  //   file: 'as/foreign.js',
  //   expect: function (err, path, nodes, entry, t) {
  //     t.is(err, null)
  //     t.is(entry.require['a'], 'b')
  //   }
  // },
  // {
  //   desc: '#17: deep deps of package.as',
  //   options: {
  //     'as': {
  //       'abc': './deep/dep.js'
  //     },
  //     cwd: node_path.join(root, 'as')
  //   },
  //   file: 'as/deep/index.js',
  //   expect: function (err, path, nodes, entry, t) {
  //     t.is(err, null)
  //     t.is(entry.require['abc'], node_path.join(node_path.dirname(path), './dep.js'))
  //   }
  // },
  {
    desc: '#21: require.resolve',
    options: {
    },
    file: 'require-resolve/entry.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(entry.resolve['./a'], node_path.join(node_path.dirname(path), './a'))
      t.is(entry.resolve['./b'], node_path.join(node_path.dirname(path), './b.js'))
      t.is(entry.require['./c'], node_path.join(node_path.dirname(path), './c.js'))
    }
  },
  {
    desc: '#21: require.resolve: false',
    options: {
      requireResolve: false
    },
    file: 'require-resolve/entry.js',
    expect: function (err, path, nodes, entry, t) {
      t.is('./a' in entry.resolve, false)
      t.is('./b' in entry.resolve, false)
      t.is(entry.require['./c'], node_path.join(node_path.dirname(path), './c.js'))
    }
  },
  {
    desc: '#21: require.async: true',
    options: {
      requireAsync: true
    },
    file: 'require-async/entry.js',
    expect: function (err, path, nodes, entry, t) {
      t.is(entry.async['./a'], node_path.join(node_path.dirname(path), './a'))
      t.is(entry.async['./b'], node_path.join(node_path.dirname(path), './b.js'))
      t.is(entry.require['./c'], node_path.join(node_path.dirname(path), './c.js'))
    }
  },
  {
    desc: '#21: require.async: false',
    options: {
      requireAsync: false
    },
    file: 'require-async/entry.js',
    expect: function (err, path, nodes, entry, t) {
      t.is('./a' in entry.async, false)
      t.is('./b' in entry.async, false)
      t.is(entry.require['./c'], node_path.join(node_path.dirname(path), './c.js'))
    }
  },
  // {
  //   desc: '#21: require in comments',
  //   options: {
  //     commentRequire: true,
  //     requireAsync: true
  //   },
  //   file: 'require-async/entry-comment.js',
  //   expect: function (err, path, nodes, entry, t) {
  //     t.is(entry.require['./a'], node_path.join(node_path.dirname(path), './a'))
  //     t.is(entry.resolve['./b'], node_path.join(node_path.dirname(path), './b.js'))
  //     t.is(entry.async['./c.js'], node_path.join(node_path.dirname(path), './c.js'))
  //   }
  // }
]


cases.forEach(function (c) {
  let i = c.only
    ? test.only.cb
    : test.cb

  function run (noOptions) {
    let desc = c.desc
    let options = c.options || {}

    if (noOptions) {
      if (Object.keys(options).length !== 0) {
        return
      }

      desc += ': empty argument `options`'
    }

    i(desc, t => {
      let file = make_array(c.file).map(function(f){
        return node_path.join(root, f)
      })
      let warnings = []
      let tests = make_array(c.expect)

      let callback = (err, nodes) => {
        t.end()
        let entry

        file.forEach(function(f, i){
          if (!err && nodes) {
            entry = nodes[f]
          }
          tests[i](err, f, nodes, entry, t, warnings)
        })
      }

      let f = c.multi
        ? file
        : file[0]

      walker(options)
        .on('warn', (message) => {
          warnings.push(message)
        })
        .walk(f)
        .then(
          (nodes) => {
            callback(null, nodes)
          },

          (err) => {
            callback(err)
          }
        )
    })
  }

  run()
  run(true)
})