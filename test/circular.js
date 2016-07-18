'use strict'

const traceCircular = require('../src/circular')
const test = require('ava')

test("should not fuck himself", t => {
  let a = {}
  let nodes = {
    '/a': a
  }

  let result = traceCircular(a, a, nodes)
  t.is(result, null)
})

test("no match", t => {
  let a = {}
  let b = {}
  let nodes = {
    '/a': a,
    '/b': b
  }

  let result = traceCircular(a, b, nodes)
  t.is(result, null)
})

test("a longer link, but no match", t => {
  let a = {}
  let b = {
    require: {
      './c': '/c'
    }
  }
  let nodes = {
    '/a': a,
    '/b': b,
    '/c': {
      require: {}
    }
  }

  let result = traceCircular(a, b, nodes)
  t.is(result, null)
})

test("matches", t => {
  let a = {
    name: 'a'
  }
  let b = {
    name: 'b',
    require: {
      './c': '/c',
      './e': '/e'
    }
  }
  let c = {
    name: 'c',
    require: {
      './d': '/d',
      './a': '/a'
    }
  }

  let nodes = {
    '/a': a,
    '/b': b,
    '/c': c,
    '/d': {
      name: 'd'
    },
    '/e': {
      name: 'e'
    }
  }

  let result = traceCircular(b, a, nodes).map(function (item) {
    return item.name
  })
  t.deepEqual(result, ['a', 'b', 'c', 'a'])
})
