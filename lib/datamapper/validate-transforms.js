'use strict'

function validateTransforms (transforms, recordTypes) {
  for (let type in transforms) {
    if (!(type in recordTypes)) {
      throw new Error(`Attempted to define transform on "${type}" type which does not exist.`)
    }
    if (typeof transforms[type] !== 'object' || transforms[type].constructor !== Object) {
      throw new TypeError(`Transform value for "${type}" type must be an object.`)
    }
  }
}

module.exports = validateTransforms
