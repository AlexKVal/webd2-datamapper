'use strict'

/**
 * Mutates 'transforms' argument
 */
function validateRecordTypes (transforms, recordTypes) {
  for (let type in recordTypes) {
    validate(recordTypes[type])
    if (!transforms.type) transforms[type] = {}
  }

  return transforms
}

function validate (fields) {
  if (typeof fields !== 'object') throw new TypeError('Type definition must be an object.')

  for (let key in fields) validateField(fields[key], key)
}

function validateField (value, key) {
  if (typeof value !== 'object' || value.constructor !== Object) {
    throw new TypeError(`The definition of "${key}" must be an object.`)
  }

  if (key === 'id') {
    throw new Error('Cannot define primary key "id". Probably you need "$id".')
  }

  // const plainObject = {}
  // if (key in plainObject) throw new Error(`Cannot define "${key}" which is in Object.prototype.`)

  if (!value.type && !value.link) {
    throw new Error(`The definition of "${key}" must contain either the "type" or "link" property.`)
  }

  if (value.type && value.link) {
    throw new Error(`Cannot define both "type" and "link" on "${key}".`)
  }

  const nativeTypes = [ String, Number, Boolean, Date ]
  if (value.type && !~nativeTypes.indexOf(value.type)) {
    throw new Error(`The "type" on "${key}" is invalid.`)
  }

  if (value.link && typeof value.link !== 'string') {
    throw new TypeError(`The "link" on "${key}" must be a string.`)
  }

  if (value.isArray !== undefined && typeof value.isArray !== 'boolean') {
    throw new TypeError(`The key "isArray" on "${key}" must be a boolean.`)
  }
}

module.exports = {
  validateRecordTypes,
  validate,
  validateField
}
