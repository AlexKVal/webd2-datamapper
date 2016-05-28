'use strict'

const test = require('tape')

const validateTransforms = require('./validate-transforms')

test('validateTransforms(transforms, recordTypes)', (t) => {
  const recordTypes = {
    user: { name: String }
  }

  let transforms = {
    undescribedModelName: []
  }
  t.throws(
    () => validateTransforms(transforms, recordTypes),
    /Attempted to define transform on "undescribedModelName" type which does not exist/
  )

  transforms = {
    user: 'transforms'
  }
  t.throws(
    () => validateTransforms(transforms, recordTypes),
    /Transform value for "user" type must be an array/
  )

  transforms = {
    user: []
  }
  t.doesNotThrow(
    () => validateTransforms(transforms, recordTypes),
    'is ok with empty transformers as well'
  )

  t.end()
})
