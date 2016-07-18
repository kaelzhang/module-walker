'use strict'

// Scenario:
// One day, `to` depends on `from`,
// So we suppose that there is a trace goes back the dependency chain
// from `from` up to `to`:
// ```
//
// ```


// @param {Object} from The from node, the spring generations
// @param {Object} to The node to be tested, the ancestors
// @returns
// - null if no circle
// - `Array` if has a circle
module.exports = (from, to, nodes) => {
  var trace = [to]

  if (from === to) {
    return null
  }

  return _lookBack(from, to, trace, nodes)
}


function _lookBack (from, to, trace, nodes) {
  trace.push(from)

  if (from === to) {
    return trace
  }

  var dependencies = from.require
  var deps_array = dependencies
    ? Object.keys(dependencies)
    : []

  // if meets the end, just pop.
  if (deps_array.length === 0) {
    trace.pop()
    return null
  }

  var found = deps_array.some(dep => {
    var dep_path = dependencies[dep]
    var new_from = nodes[dep_path]
    return _lookBack(new_from, to, trace, nodes)
  })

  if (!found) {
    // If not found, recursively pop()
    trace.pop()
    return null
  }

  return trace
}
