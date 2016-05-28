'use strict'

const test = require('tape')

const DataMapper = require('./datamapper')

test.only('DataMapper', (t) => {
  const recordTypes = {}

  const instance = new DataMapper(recordTypes)

  t.ok(instance)

  t.end()
})
