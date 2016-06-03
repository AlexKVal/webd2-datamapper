'use strict'

const test = require('tape')

const config = require('../config.js')
const adapterOptions = {dsn: config.d2alias}

const {recordTypes, initialData, prepareTestTables} = require('../adapter/_prepare-test-db')

const Context = require('./context')
const DataMapper = require('./index')

test('I&T datamapper.find()', (t) => {
  const mapper = new DataMapper(recordTypes, adapterOptions)

  prepareTestTables(initialData)

  .then(() => mapper.find(new Context({
    type: 'user'
  })))
  .then((context) => t.deepEqual(
    context.response.payload.records,
    [
      {id: 1, name: 'John', deleted: false, group: 1},
      {id: 2, name: 'Smith', deleted: false, group: 1},
      {id: 3, name: 'Johanna', deleted: false, group: 2},
      {id: 4, name: 'Ann', deleted: true, group: 2},
      {id: 5, name: 'Makbeth', deleted: false, group: 2}
    ],
    'by default it fetches all records'
  ))

  .then(() => mapper.find(new Context({
    type: 'user',
    include: [['group']]
  })))
  .then((context) => t.deepEqual(
    context.response,
    {
      payload: {
        records: [
          {id: 1, name: 'John', deleted: false, group: 1},
          {id: 2, name: 'Smith', deleted: false, group: 1},
          {id: 3, name: 'Johanna', deleted: false, group: 2},
          {id: 4, name: 'Ann', deleted: true, group: 2},
          {id: 5, name: 'Makbeth', deleted: false, group: 2}
        ],
        include: {
          group: [
            {id: 1, name: 'Admins', deleted: false},
            {id: 2, name: 'Users', deleted: false}
            // {id: 3, name: 'Officers', deleted: true} - this group is not used
          ]
        }
      }
    },
    '"include" option with belongsTo'
  ))

  .catch(t.fail)
  .then(t.end)
})
