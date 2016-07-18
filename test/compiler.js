'use strict'

const Walker = require('../src/walker')
const node_path = require('path')
const util = require('util')

const jade_compiler = require('neuron-jade-compiler')
const root = node_path.join(__dirname, 'fixtures', 'compiler')

const test = require('ava')

function filename (file) {
  return node_path.join(root, file)
}

const cases = [
  {
    desc: 'files to be compiled, that contains dependency',
    file: 'jade/index.js',
    compilers: {
      test: /\.jade$/,
      compiler: jade_compiler
    },
    expect: function (err, path, nodes, entry, t) {
      t.is(err, null)
      var jade = filename('jade/a.jade')
      t.is(jade in nodes, true)
    }
  }
]

cases.forEach(function (c) {
  var i = c.only
    ? test.only.cb
    : test.cb

  let desc = c.desc
  let options = c.options || {}

  i(desc, t => {
    let file = filename(c.file)

    let callback = function (err, nodes) {
      console.log('done')
      t.end()

      let entry
      if (!err && nodes) {
        entry = nodes[file]
      }
      c.expect(err, file, nodes, entry, t)
    }

    if (c.compilers) {
      options.compilers = c.compilers
    }

    new Walker(file, options, callback)
  })
})