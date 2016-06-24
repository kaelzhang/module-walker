'use strict'

const expect = require('chai').expect
const dependency = require('../src/dependency')
const node_path = require('path')
const util = require('util')
const utils = require('../src/utils')
const fs = require('fs')

const cases = [
  {
    desc: 'could get dependencies',
    file: 'correct.js',
    options: {
      check_require_length: true
    },
    deps: ['../abc', 'abc', './abc']
  },
  {
    desc: 'no arguments, strict',
    file: 'no-arg.js',
    options: {
      check_require_length: true
    },
    error: true
  },
  {
    desc: 'no arguments, no strict',
    file: 'no-arg.js',
    options: {
    },
    deps: ['abc']
  },
  {
    desc: 'more than one arguments, strict',
    file: 'more-than-one-arg.js',
    options: {
      check_require_length: true
    },
    error: true

  },
  {
    desc: 'more than one arguments, no strict',
    file: 'more-than-one-arg.js',
    options: {
    },
    deps: ['../abc', './abc']
  },
  {
    desc: 'parsing a json file will fail',
    file: 'json.json',
    error: true
  }
]

describe("parser.parseDependenciesFromAST()", function(){
  cases.forEach(function (c) {
    it(c.desc, function(done) {
      let file = node_path.join(__dirname, 'fixtures', 'parser', c.file)
      let content = fs.readFileSync(file).toString()
      let ast = utils.astFromSource(content)
      dependency.parseDependenciesFromAST(ast, c.options || {})
      .catch(() => {
        if (!c.error) {
          expect('error').to.equal('success')
        }
        done()
      })
      .then((result) => {
        done()
        if (c.error) {
          expect('success').to.equal('error')
        }

        if (util.isArray(c.deps)) {
          expect(result.require.sort()).to.deep.equal(c.deps.sort())
        }
      })
    })
  })
})