'use strict'
const test = require('tape')

const {
  getHasManyDescriptors,
  getBelongsToDescriptors
} = require('./get-descriptors')

test('getBelongsToDescriptors()', (t) => {
  t.throws(
    () => getBelongsToDescriptors(undefined),
    /getBelongsToDescriptors: schemaObject is undefined/
  )

  const schemaObject = {
    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
      /* fkField: is the same, so we can skip it */
    }
  }

  const relations = getBelongsToDescriptors(schemaObject)
  t.equal(relations.length, 2)
  t.deepEqual(
    relations, [
      {
        relationModelName: 'userGroup',
        modelFieldName: 'group',
        fkField: 'GrpID',
        fkAs: 'userGroupId'
      },
      {
        relationModelName: 'rights',
        modelFieldName: 'rights',
        fkField: 'rights',
        fkAs: 'rightsId'
      }
    ],
    'returns collection of "belongsTo" descriptors'
  )
  t.end()
})

test('getHasManyDescriptors()', (t) => {
  t.throws(
    () => getHasManyDescriptors(undefined),
    /getHasManyDescriptors: schemaObject is undefined/
  )

  const schemaObject = {
    users: {
      hasMany: 'user',
      fkField: 'GrpID'
    },
    tables: {
      hasMany: 'restTable',
      fkField: 'UserGroupID'
    },
    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
      /* fkField: is the same, so we can skip it */
    }
  }

  const relations = getHasManyDescriptors(schemaObject)
  t.equal(relations.length, 2)
  t.deepEqual(
    relations, [
      {
        relationModelName: 'user',
        modelFieldName: 'users',
        fkField: 'GrpID'
      },
      {
        relationModelName: 'restTable',
        modelFieldName: 'tables',
        fkField: 'UserGroupID'
      }
    ],
    'returns collection of "hasMany" descriptors'
  )
  t.end()
})
