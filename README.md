[![Build Status](https://travis-ci.org/kaelzhang/module-walker.svg?branch=master)](https://travis-ci.org/kaelzhang/module-walker)
<!-- optional appveyor tst
[![Windows Build Status](https://ci.appveyor.com/api/projects/status/github/kaelzhang/module-walker?branch=master&svg=true)](https://ci.appveyor.com/project/kaelzhang/module-walker)
-->
<!-- optional npm version
[![NPM version](https://badge.fury.io/js/module-walker.svg)](http://badge.fury.io/js/module-walker)
-->
<!-- optional npm downloads
[![npm module downloads per month](http://img.shields.io/npm/dm/module-walker.svg)](https://www.npmjs.org/package/module-walker)
-->
<!-- optional dependency status
[![Dependency Status](https://david-dm.org/kaelzhang/module-walker.svg)](https://david-dm.org/kaelzhang/module-walker)
-->

# module-walker

Analyzes and walks down the dependencies from a entry of commonjs or es6 module and creates a B+ dependency tree.

- Fully implemented [File Modules](http://nodejs.org/api/modules.html#modules_file_modules) of nodejs.
- You can define what extensions should commonjs-walker fallback to by [options.extensions](#optionsextensions), which will be very usefull for browser-side modules.

## Install

```sh
$ npm install module-walker --save
```

## walker(options = {})

```js
const walker = require('module-walker')

let resolve = (nodes) => {
  // nodes
}

walker(options)
  .on('warn', message => {
    console.warn(message)
  })
  .walk(filename)
  .walk(filename)
  .then(resolve, reject)
```

- nodes `Object.<id>:<walker.Node>`
- resolve `function(nodes)`
- reject `function(err)`

For the example of variable `nodes`, see the last section below.

### options

All options are optional. Default options are typically used for node.js environment in strict mode.

- **allowCyclic** `Boolean=true` When false, if cyclic dependencies are detected, it will be `reject()`ed.
- **checkRequireLength** `Boolean=false` When true, `require()` method only accepts one argument. Otherwise, it will be `reject()`ed
- **allowAbsoluteDependency** `Boolean=true` When false, `require()`ing an absolute path is not allowed, such as `require('/data/a.js')`, which has several issues for browser-side module.
- **extensions** `Array=['.js', '.json', '.node']` See [options.extensions](#options.extensions) section.
- **requireResolve** `Boolean=true` When true, `require.resolve()` will be parsed.
- **requireAsync** `Boolean=false` Specially, if true, `module-walker` will parse the usage of `require.async(id)` for some browser-side module loaders.
- **allowNonLiteralRequire** `Boolean=true` Whether should check the usage of method `require()`. If false, the argument of `require()` must be an literal string, otherwise it will be `reject()`ed.
- **commentRequire** `Boolean=false` When true, it supports to write

```js
// @require('./controller/a')
// @require('./controller/b')
const Controller = require(`./controller/${type}`)
```

which is really helpful for browsers

- **allowImportExportEverywhere** `Boolean=false` By default, import and export declarations can only appear at a program's top level. Setting this option to true allows them anywhere where a statement is allowed. This option is used for `babylon`.
- **allowReturnOutsideFunction** `Boolean=false` By default, a return statement at the top level raises an error. Set this to true to accept such code. This option is used for `babylon`.
- **sourceType** `String='module'` Indicate the mode the code should be parsed in. Can be either "script" or "module". This option is used for `babylon`.
- **parse** `function(code, options)=walker.astFromSource` Method to parse and return the ast([estree](https://github.com/estree/estree)) of the given `code`. (probably don't use this)
- **resolve** `function(id, options, callback)=walker.resolve` Asynchronous method to `require.resolve()` the given `id`. (probably don't use this)

#### options.extensions

type `Array`

When we `require()` a `path`, if `path` is not found, nodejs will attempt to load the required filename with the added extension of `.js`, `.json`, and then `.node`. [Reference via](http://nodejs.org/api/modules.html#modules_file_modules)

For browser-side environment, we could use `['.js', '.json']`.


## Struct: walker.Node

Actually, there is no `walker.Node` exists. We only use it to declare and describe the structure of the module.

Property | Type | Description
-------- | ---- | -----------
foreign | `Boolean` | whether the current module is from a foreign package.
require | `Object` | The `<id>: <path>` map. `id` is the module identifier user `require()`d in the module file.
resolve | `Object` | similar to `require`
async   | `Object` | similar to `async`
type    | `Array.<String>` | the type of the current node to be required. see example below.


## Example

If the file structure of your project is (actually it is a very extreme scenario):

```
/path/to
       |-- index.js
       |-- a.png
       |-- a
           |-- index.json
```

index.js:

```js
require('./a')
require('b')
var image = require.resolve('./a.png')
```

a/index.json

```json
{}
```

Code:

```js
walker().walk('/path/to/index.js').then(function(nodes){
  console.log(nodes)
});
```

Then, the `nodes` object will be something like:

```js
{
  '/path/to/index.js': {
    id: '/path/to/index.js',
    require: {
      './a': '/path/to/a/index.json',
      'b': 'b'
    },
    resolve: {
      './a.png': '/path/to/a.png'
    },
    code: <buffer>
    type: ['require'] // there is a 'require' type for entry node
  },
  '/path/to/a.png': {
    require: {},
    type: ['resolve'] // indicates that this node is `require.resolve()`d
  }
  '/path/to/a/index.json': {
    require: {},
    type: ['require'],
    code: <buffer>
  },
  'b': {
    foreign: true
  }
}
```

## License

MIT
