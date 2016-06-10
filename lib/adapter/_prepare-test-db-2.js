'use strict'

const config = require('../config.js')
const options = {dsn: config.d2alias}

const Adapter = require('./index')

const initialData = {
  posts: [
    {postTag: 1, subTag: 4, text: 'text of the post1'},
    {postTag: 1, subTag: 4, text: 'text of the post2'},
    {postTag: 2, subTag: 5, text: 'text of the post3'},
    {postTag: 2, subTag: 1, text: 'text of the post4'},
    {postTag: 3, subTag: 2, text: 'text of the post5'}
  ],
  messages: [
    {msgTag: 3, text: 'long message 1'},
    {msgTag: 2, text: 'long message 2'},
    {msgTag: 1, text: 'long message 3'}
  ],
  tags: [
    {name: 'tag1'},
    {name: 'tag2'},
    {name: 'tag3'},
    {name: 'tag4'},
    {name: 'tag5'}
  ]
}

const recordTypes2 = {
  post: {
    $table: 'TestPost',
    text: {type: String},
    postTag: {link: 'tag'},
    subTag: {link: 'tag'}
  },
  message: {
    $table: 'TestMsg',
    text: {type: String},
    msgTag: {link: 'tag'}
  },
  tag: {
    $table: 'TestTag',
    name: {type: String},
    posts: { link: 'post', isArray: true, inverse: 'postTag' },
    subposts: { link: 'post', isArray: true, inverse: 'subTag' },
    messages: { link: 'message', isArray: true, inverse: 'msgTag' }
  }
}

function prepareTestTables2 () {
  const adapter = new Adapter({options})

  return adapter.connect()

  // tables and data preparation
  .then(() => adapter.query("SELECT Xf$Id FROM X$File WHERE Xf$Name='TestPost'"))
  .then((res) => {
    return res.length && adapter.query('DROP TABLE TestPost')
  })
  .then(() => adapter.query(
    "CREATE TABLE TestPost USING 'testpost.mkd'" +
    ' (id AUTOINC(4),' +
    ' text ZSTRING(200),' +
    ' postTag INT(2),' +
    ' subTag INT(2))' +
    ' WITH INDEX (id UNIQUE)'
  ))

  .then(() => adapter.query("SELECT Xf$Id FROM X$File WHERE Xf$Name='TestMsg'"))
  .then((res) => {
    return res.length && adapter.query('DROP TABLE TestMsg')
  })
  .then(() => adapter.query(
    "CREATE TABLE TestMsg USING 'testmsg.mkd'" +
    ' (id AUTOINC(4),' +
    ' text ZSTRING(200),' +
    ' msgTag INT(2))' +
    ' WITH INDEX (id UNIQUE)'
  ))

  .then(() => adapter.query("SELECT Xf$Id FROM X$File WHERE Xf$Name='TestTag'"))
  .then((res) => {
    return res.length && adapter.query('DROP TABLE TestTag')
  })
  .then(() => adapter.query(
    "CREATE TABLE TestTag USING 'testtag.mkd'" +
    ' (id AUTOINC(4),' +
    ' name ZSTRING(8))' +
    ' WITH INDEX (id UNIQUE)'
  ))

  .then(() => {
    return Promise.all(initialData.posts.map((row) =>
      adapter.query(`INSERT INTO TestPost (text, postTag, subTag) VALUES ('${row.text}', ${row.postTag}, ${row.subTag})`)))
  })

  .then(() => {
    return Promise.all(initialData.messages.map((row) =>
      adapter.query(`INSERT INTO TestMsg (text, msgTag) VALUES ('${row.text}', ${row.msgTag})`)))
  })

  .then(() => {
    return Promise.all(initialData.tags.map((row) =>
      adapter.query(`INSERT INTO TestTag (name) VALUES ('${row.name}')`)))
  })

  .catch((e) => {
    return adapter.disconnect()
    .then(() => { throw e })
  })

  .then(() => adapter.disconnect())
}

module.exports = {
  prepareTestTables2,
  recordTypes2
}
