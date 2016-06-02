'use strict'

const config = require('../config.js')
const options = {dsn: config.d2alias}

const Adapter = require('./index')

const initialData = {
  groups: [
    {name: 'Admins', hide: false},
    {name: 'Users', hide: false},
    {name: 'Officers', hide: true}
  ],
  users: [
    {name: 'John', hide: false, config: 1, grpid: 1, password: '333'},
    {name: 'Smith', hide: false, config: 3, grpid: 1, password: '123'},
    {name: 'Johanna', hide: false, config: 2, grpid: 2, password: '321'},
    {name: 'Ann', hide: true, config: 3, grpid: 2, password: '11111'},
    {name: 'Makbeth', hide: false, config: 3, grpid: 2, password: 'fffgg'}
  ]
}

const recordTypes = {
  user: {
    $id: 'PersID',
    $table: 'TestUser',
    name: {type: String},
    deleted: {type: Boolean, $fname: 'hide'},
    config: {private: true, type: Number},
    password: {private: true, type: String},
    group: {link: 'group', $fname: 'GrpID'}
  },
  group: {
    $id: 'GrpID',
    $table: 'TestGroup',
    name: {type: String},
    deleted: {type: Boolean, $fname: 'hide'}
  }
}

function prepareTestTables (t, initialData) {
  const adapter = new Adapter({options})

  return adapter.connect()

  // tables and data preparation
  .then(() => adapter.query("SELECT Xf$Id FROM X$File WHERE Xf$Name='TestUser'"))
  .then((res) => {
    return res.length && adapter.query('DROP TABLE TestUser')
  })
  .then(() => adapter.query(
    "CREATE TABLE TestUser USING 'testuser.mkd'" +
    ' (PersID AUTOINC(4),' +
    ' Name ZSTRING(31),' +
    ' Hide LOGICAL(1),' +
    ' Config INT(1),' +
    ' GrpID INT(2),' +
    ' Password ZSTRING(7))' +
    ' WITH INDEX (PersID UNIQUE)'
  ))
  .then(() => t.pass('TestUser table has been created'))

  .then(() => adapter.query("SELECT Xf$Id FROM X$File WHERE Xf$Name='TestGroup'"))
  .then((res) => {
    return res.length && adapter.query('DROP TABLE TestGroup')
  })
  .then(() => adapter.query(
    "CREATE TABLE TestGroup USING 'testgroup.mkd'" +
    ' (GrpID AUTOINC(4),' +
    ' Name ZSTRING(31),' +
    ' Hide LOGICAL(1))' +
    ' WITH INDEX (GrpID UNIQUE)'
  ))
  .then(() => t.pass('TestGroup table has been created'))

  .then(() => {
    return Promise.all(initialData.groups.map((g) =>
      adapter.query(`INSERT INTO TestGroup (Name, Hide) VALUES ('${g.name}', ${g.hide})`)))
  })
  .then(() => t.pass('TestGroup has been populated'))

  .then(() => {
    return Promise.all(initialData.users.map((u) =>
      adapter.query('INSERT INTO TestUser (Name, Hide, Config, GrpID, Password)' +
      ` VALUES ('${u.name}', ${u.hide}, ${u.config}, ${u.grpid}, '${u.password}')`)))
  })
  .then(() => t.pass('TestUser has been populated'))

  .then(() => adapter.disconnect())
  .catch(t.fail)
}

module.exports = {
  prepareTestTables,
  initialData,
  recordTypes
}
