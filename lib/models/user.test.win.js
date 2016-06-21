'use strict'
const test = require('blue-tape')

const config = require('../config.js')
process.env.D2ALIAS = config.d2alias

const User = require('./user')

test('User.passwordVerify', (t) => {
  const admin = config.adminCredentials

  return User.passwordVerify(admin.id, admin.password)
  .then((user) => {
    t.ok(user, 'credentials OK')
    t.equal(user.name, 'Admin', 'user name is Admin')
  })
})
