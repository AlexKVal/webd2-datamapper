'use strict'

const test = require('tape')

const DataMapper = require('./datamapper')

test('DataMapper', (t) => {
  t.throws(
    () => new DataMapper('record types'),
    /First argument must be an object/
  )

  t.throws(
    () => new DataMapper({}),
    /At least one type must be specified/
  )

  const recordTypes = {
    user: {
      name: String
    }
  }
  const instance = new DataMapper(recordTypes)

  t.equal(instance.recordTypes, recordTypes)

  t.end()
})

const validateTransforms = DataMapper.validateTransforms
test.only('DataMapper validateTransforms(transforms, recordTypes)', (t) => {
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
