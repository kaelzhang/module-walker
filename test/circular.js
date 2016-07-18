'use strict'

var expect = require('chai').expect
var traceCircular = require('../src/circular')


describe("traceCircular()", function(){
  it("should not fuck himself", function(){
    var a = {}
    var nodes = {
      '/a': a
    }

    var result = traceCircular(a, a, nodes)
    expect(result).to.equal(null)
  })

  it("no match", function(){
    var a = {}
    var b = {}
    var nodes = {
      '/a': a,
      '/b': b
    }

    var result = traceCircular(a, b, nodes)
    expect(result).to.equal(null)
  })

  it("a longer link, but no match", function(){
    var a = {}
    var b = {
      require: {
        './c': '/c'
      }
    }
    var nodes = {
      '/a': a,
      '/b': b,
      '/c': {
        require: {}
      }
    }

    var result = traceCircular(a, b, nodes)
    expect(result).to.equal(null)
  })

  it("matches", function(){
    var a = {
      name: 'a'
    }
    var b = {
      name: 'b',
      require: {
        './c': '/c',
        './e': '/e'
      }
    }
    var c = {
      name: 'c',
      require: {
        './d': '/d',
        './a': '/a'
      }
    }

    var nodes = {
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

    var result = traceCircular(b, a, nodes).map(function (item) {
      return item.name
    })
    expect(result).to.deep.equal(['a', 'b', 'c', 'a'])
  })
})