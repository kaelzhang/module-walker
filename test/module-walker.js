'use strict'

const expect = require('chai').expect
const walker = require('../')

let result = walker.astFromSource('require("abc"); import a from "abc"')

console.log(JSON.stringify(result, null, 2))