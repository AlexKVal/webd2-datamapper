'use strict'
const test = require('tape')

// prevent require('odbc')
GLOBAL.dbInstance = { exec () { return Promise.resolve([]) } }

const registry = require('./registry')

test('UserGroup.validateBeforeUpdate()', (t) => {
  t.plan(6)

  registry.reset()
  const userGroup = require('./user-group')
  const userModel = require('./user')

  t.ok(userGroup, 'userGroup registered')
  t.ok(userModel, 'user registered')

  userModel.selectMany = (options) => {
    t.pass('uses user.selectMany()')
    t.deepEqual(
      options,
      { fieldsOnly: 'id', where: { GrpID: 33, hide: false } },
      'options for user.selectMany()'
    )

    return Promise.resolve([ // mock 2 users in the group
      {id: '123', name: 'user1'},
      {id: '124', name: 'user2'}
    ])
  }

  const newData = { id: 33, hide: false }
  const prevData = { id: 33, hide: false }

  Promise.resolve() // could return just 'true' or Promise
  .then(() => userGroup.validateBeforeUpdate(123, newData, prevData))
  .then((result) => t.ok(result, 'w/o a try to delete should validate OK'))
  .catch((e) => t.fail(e))

  .then(() => {
    newData.hide = true // an attempt to delete the group
    return userGroup.validateBeforeUpdate(123, newData, prevData)
  })
  .then(() => t.fail('should not be OK'))
  .catch((e) => t.equal(
    e.message,
    'Cannot delete. There are (2) users in the group',
    'it does not allow to delete a group with active users'
  ))

  .then(() => t.end())
})
