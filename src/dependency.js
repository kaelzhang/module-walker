'use strict'

let parser = exports
const node_path = require('path')
const util = require('util')
const unique = require('make-unique')
const utils = require('./utils')

const set = require('set-options')

const DEFAULT_OPTIONS = {
  commentRequire: false,
  requireResolve: true,
  requireAsync: false,
  checkRequireLength: false,
  allowNonLiteralRequire: true
}

// Parses an AST and get its dependencies and code
// @public
// @param {Object} ast babylon ast
// @param {Object} options
// @param {function()} callback
parser.parseDependenciesFromAST = (ast, options) => {
  options = set(options, DEFAULT_OPTIONS)

  return new Promise((resolve, reject) => {
    parser._parseDependenciesFromAST(ast, options, (err, result) => {
      if (err) {
        return reject(err)
      }

      resolve(result)
    })
  })
}


parser._parseDependenciesFromAST = (ast, options, callback) => {
  let normal = []
  let resolve = []
  let async = []

  let dependencies = {
    normal,
    resolve,
    async
  }

  ast = ast.program.body

  try {
    parser._parseDependencies(ast, dependencies, options)
  } catch (e) {
    return callback({
      code: 'WRONG_USAGE_REQUIRE',
      message: 'Error parsing dependencies: ' + e.message,
      data: {
        error: e
      }
    })
  }

  if (options.commentRequire) {
    parser._parseComments(ast, dependencies, options)
  }

  callback(null, {
    require: unique(dependencies.normal),
    resolve: unique(dependencies.resolve),
    async: unique(dependencies.async)
  })
}


// Parses AST and returns the dependencies
parser._parseDependencies = (node, dependencies, options) => {
  // Only arrays or objects has child node, or is a sub AST.
  if (!node || Object(node) !== node) {
    return
  }

  parser._checkCommonJSDependencyNode(
    node,
    node => {
      return node.type === 'CallExpression'
        && node.callee.type === 'Identifier'
        && node.callee.name === 'require'
    },
    dependencies.normal, options, true)

  || options.requireResolve && parser._checkCommonJSDependencyNode(
    node,
    node => {
      return node.type === 'CallExpression'
        && node.callee.type === 'MemberExpression'
        && node.callee.object.name === 'require'
        && node.callee.property.name === 'resolve'
    }, dependencies.resolve, options, true)

  || options.requireAsync && parser._checkCommonJSDependencyNode(
    node,
    node => {
      return node.type === 'CallExpression'
        && node.callee.type === 'MemberExpression'
        && node.callee.object.name === 'require'
        && node.callee.property.name === 'async'
    }, dependencies.async, options, false)

  || parser._checkES6Imported(node, dependencies.normal)

  if (util.isArray(node)) {
    node.forEach((sub) => {
      parser._parseDependencies(sub, dependencies, options)
    })
    return
  }

  let key
  for (key in node) {
    if (node.hasOwnProperty(key)){
      parser._parseDependencies(node[key], dependencies, options)
    }
  }
}


parser._checkES6Imported = (node, dependencies) => {
  if (node.type !== 'ImportDeclaration') {
    return
  }

  dependencies.push(node.source.value)
}


// @returns {Boolean} whether a dependency is found
parser._checkCommonJSDependencyNode = (
  node,
  condition,
  deps_array,
  options,
  check_if_length_exceeded
) => {
  if (!condition(node)) {
    return
  }

  let args = node.arguments
  let loc = node.callee.loc.start
  let loc_text = generateLocText(loc)
  let check_length = options.checkRequireLength

  if (args.length === 0) {
    utils.throw(check_length, loc_text + 'Method `require` accepts one and only one parameter.')
  }

  if (check_if_length_exceeded && args.length > 1) {
    utils.throw(check_length, loc_text + 'Method `require` should not contains more than one parameters')
  }

  let arg1 = args[0]
  if (!arg1) {
    return
  }

  if (arg1.type !== 'StringLiteral') {
    utils.throw(!options.allowNonLiteralRequire, generateLocText(arg1.loc.start) + 'Method `require` only accepts a string literal.' )
  } else {
    deps_array.push(arg1.value)
    return true
  }
}


const REGEX_LEFT_PARENTHESIS_STRING = '\\s*\\(\\s*([\'"])([A-Za-z0-9_\\/\\-\\.]+)\\1\\s*'
const REGEX_PARENTHESIS_STRING      = REGEX_LEFT_PARENTHESIS_STRING + '\\)'

const REGEX_REQUIRE =
  new RegExp('@require'           + REGEX_PARENTHESIS_STRING, 'g')

const REGEX_REQUIRE_RESOLVE =
  new RegExp('@require\\.resolve' + REGEX_PARENTHESIS_STRING, 'g')

const REGEX_REQUIRE_ASYNC =
  new RegExp('@require\\.async'   + REGEX_LEFT_PARENTHESIS_STRING, 'g')

// Parses `@require`, `@require.resolve`, `@require.async` in comments
parser._parseComments = (ast, dependencies, options) => {
  let comments = ast.comments
  if (!comments) {
    return
  }

  comments.forEach(comment => {
    parser._parseByRegex(comment.value, REGEX_REQUIRE, dependencies.normal)

    if (options.requireResolve) {
      parser._parseByRegex(comment.value, REGEX_REQUIRE_RESOLVE, dependencies.resolve)
    }

    if (options.requireAsync) {
      parser._parseByRegex(comment.value, REGEX_REQUIRE_ASYNC, dependencies.async)
    }
  })
}


// @param {string} content
// @param {RegExp} regex
// @param {*Array} matches
parser._parseByRegex = (content, regex, matches) => {
  let match
  while(match = regex.exec(content)){
    matches.push(match[2])
  }
}


function generateLocText (loc) {
  return 'Line ' + loc.line + ': Column ' + loc.column + ': '
}
