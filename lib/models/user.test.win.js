'use strict'
const test = require('tape')

const config = require('../config.js')
process.env.D2ALIAS = config.d2alias

const User = require('./user')

test('User.passwordVerify', (t) => {
  t.plan(2)

  const admin = config.adminCredentials

  User.passwordVerify(admin.id, admin.password)
  .then((user) => {
    t.ok(user, 'credentials OK')
    t.ok(/Admin/.test(user.name), 'user name is Admin')
  })
  .catch(t.fail)
  .then(t.end)
})
