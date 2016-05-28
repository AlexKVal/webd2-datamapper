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

  const recordTypes = {
    user: {
      name: {type: String}
    }
  }
  const instance = new DataMapper(recordTypes)

  t.equal(instance.recordTypes, recordTypes)

  t.end()
})
