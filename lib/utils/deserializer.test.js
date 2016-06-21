'use strict'
const test = require('tape')

const Deserializer = require('./deserializer')

test('Deserializer.constructor', (t) => {
  t.throws(
    () => new Deserializer(),
    /provide `modelNamesOfRelations` Array/,
    'requires `modelNamesOfRelations`'
  )

  const fn1 = function () {
    new Deserializer([]) // eslint-disable-line
  }

  t.doesNotThrow(fn1, 'when all parameters are provided')

  t.end()
})

test('deserializer.options takes into account "belongsTo" relations', (t) => {
  const deserializer = new Deserializer(['userGroup', 'userRights'])

  const options = deserializer.options

  t.equal(Object.keys(options).length, 3)
  t.equal(options.keyForAttribute, 'camelCase')
  t.equal(typeof options['user-groups'].valueForRelationship, 'function')
  t.equal(typeof options['user-rights'].valueForRelationship, 'function')

  /*
  t.deepEqual(
    options,
    {
      keyForAttribute: 'camelCase',
      'user-groups': { valueForRelationship: [Function: valueForRelationship] },
      'user-rights': { valueForRelationship: [Function: valueForRelationship] }
    }
  )
  */

  t.end()
})

test('deserializer.deserialize() with rows of data', (t) => {
  const deserializer = new Deserializer(['userGroup', 'userRights'])

  deserializer.deserialize({
    data: [
      {
        attributes: {
          name: 'Admin',
          'user-group-id': '1',
          'user-rights-id': '3'
        },
        id: '1',
        type: 'users'
      },
      {
        attributes: {
          name: 'User',
          'user-group-id': '13',
          'user-rights-id': '33'
        },
        id: '2',
        type: 'users'
      }
    ]
  })
  .then((data) => {
    t.deepEqual(data, [
      {id: '1', name: 'Admin', userGroupId: '1', userRightsId: '3'},
      {id: '2', name: 'User', userGroupId: '13', userRightsId: '33'}
    ])
    t.end()
  })
})

test('deserializer.deserialize() with one row of data', (t) => {
  const deserializer = new Deserializer(['userGroup', 'rights'])

  const dataFromTheClient = {
    data: {
      type: 'user-accounts',
      attributes: {name: 'New Name', hide: false},
      relationships: {
        'user-group': {data: {type: 'user-groups', id: '2'}},
        'rights': {data: {type: 'rights', id: '21'}}
      }
    }
  }

  deserializer.deserialize(dataFromTheClient)
  .then((data) => {
    t.deepEqual(
      data,
      {
        name: 'New Name', hide: false,
        rights: { id: '21' },
        userGroup: { id: '2' }
      }
    )
    t.end()
  })
})
