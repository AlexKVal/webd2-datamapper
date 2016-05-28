'use strict'

const test = require('tape')

const DataMapper = require('./')

test('DataMapper', (t) => {
  t.throws(
    () => new DataMapper('record types'),
    /First argument must be an object/
  )

  t.throws(
    () => new DataMapper({}),
    /At least one type must be specified/
  )

  let recordTypes = {
    user: {
      name: {type: String}
    }
  }
  t.equal(new DataMapper(recordTypes).recordTypes, recordTypes)

  recordTypes = {
    user: { name: { type: String } },
    group: { name: { type: String } },
    known: { name: { type: String } }
  }
  let options = {
    transforms: {
      known: [() => 'in', () => 'out']
    }
  }

  t.deepEqual(
    new DataMapper(recordTypes, options).transforms,
    {
      user: [],
      group: [],
      known: options.transforms.known
    },
    'it calls validateRecordTypes()'
  )

  options.transforms = {
    undescribedModelName: []
  }
  t.throws(
    () => new DataMapper(recordTypes, options),
    /Attempted to define transform on "undescribedModelName" type which does not exist/,
    'it calls validateTransforms()'
  )

  t.end()
})
