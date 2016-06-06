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
    ids: [1, 2, 3, 5]
  })))
  .then((context) => t.deepEqual(
    context.response,
    {
      payload: {
        records: [
          {id: 1, name: 'John', deleted: false, group: 1},
          {id: 2, name: 'Smith', deleted: false, group: 1},
          {id: 3, name: 'Johanna', deleted: false, group: 2},
          {id: 5, name: 'Makbeth', deleted: false, group: 2}
        ]
      }
    },
    'with ids'
  ))

  .then(() => mapper.find(new Context({
    type: 'user',
    options: {
      match: {group: 1}
    }
  })))
  .then((context) => t.deepEqual(
    context.response,
    {
      payload: {
        records: [
          {id: 1, name: 'John', deleted: false, group: 1},
          {id: 2, name: 'Smith', deleted: false, group: 1}
        ]
      }
    },
    'with options.match belongsTo'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('I&T datamapper.find() include belongsTo: w/ and w/o additional options', (t) => {
  const mapper = new DataMapper(recordTypes, adapterOptions)

  prepareTestTables(initialData)

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

  .then(() => mapper.find(new Context({
    type: 'user',
    options: {
      match: {deleted: false},
      fieldsOnly: ['id', 'name'] // 'group' will be added b/c of 'include'
    },
    include: [['group', {fieldsOnly: ['id', 'name']}]]
  })))
  .then((context) => t.deepEqual(
    context.response,
    {
      payload: {
        records: [
          {id: 1, name: 'John', group: 1},
          {id: 2, name: 'Smith', group: 1},
          {id: 3, name: 'Johanna', group: 2},
          {id: 5, name: 'Makbeth', group: 2}
        ],
        include: {
          group: [
            {id: 1, name: 'Admins'},
            {id: 2, name: 'Users'}
          ]
        }
      }
    },
    '"include" belongsTo with additional options'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('I&T datamapper.find() include hasMany', (t) => {
  const recordTypesHasMany = Object.assign({}, recordTypes)
  recordTypesHasMany.group.users = { link: 'user', isArray: true }
  const mapper = new DataMapper(recordTypesHasMany, adapterOptions)

  prepareTestTables(initialData)

  .then(() => mapper.find(new Context({
    type: 'group',
    include: [['users']]
  })))
  .then((context) => t.deepEqual(
    context.response,
    {
      payload: {
        records: [
          {id: 1, name: 'Admins', deleted: false, users: [1, 2]},
          {id: 2, name: 'Users', deleted: false, users: [3, 4, 5]},
          {id: 3, name: 'Officers', deleted: true, users: []}
        ],
        include: {
          user: [
            {id: 1, name: 'John', deleted: false, group: 1},
            {id: 2, name: 'Smith', deleted: false, group: 1},
            {id: 3, name: 'Johanna', deleted: false, group: 2},
            {id: 4, name: 'Ann', deleted: true, group: 2},
            {id: 5, name: 'Makbeth', deleted: false, group: 2}
          ]
        }
      }
    },
    '"include" everything with hasMany'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('I&T datamapper.find() include hasMany w/ additional options', (t) => {
  const recordTypesHasMany = Object.assign({}, recordTypes)
  recordTypesHasMany.group.users = { link: 'user', isArray: true }
  const mapper = new DataMapper(recordTypesHasMany, adapterOptions)

  prepareTestTables(initialData)

  .then(() => mapper.find(new Context({
    type: 'group',
    include: [['users', {match: {deleted: false}, fieldsOnly: ['name']}]]
  })))
  .then((context) => t.deepEqual(
    context.response,
    {
      payload: {
        records: [
          {id: 1, name: 'Admins', deleted: false, users: [1, 2]},
          {id: 2, name: 'Users', deleted: false, users: [3, 5]},
          {id: 3, name: 'Officers', deleted: true, users: []}
        ],
        include: {
          user: [
            {id: 1, name: 'John', group: 1},
            {id: 2, name: 'Smith', group: 1},
            {id: 3, name: 'Johanna', group: 2},
            {id: 5, name: 'Makbeth', group: 2}
          ]
        }
      }
    },
    '"include" hasMany merges additional options'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('I&T datamapper.find() w/o `include` but w/ hasMany fields', (t) => {
  const recordTypesHasMany = Object.assign({}, recordTypes)
  recordTypesHasMany.group.users = { link: 'user', isArray: true }
  const mapper = new DataMapper(recordTypesHasMany, adapterOptions)

  prepareTestTables(initialData)

  .then(() => mapper.find(new Context({
    type: 'group'
  })))
  .then((context) => t.deepEqual(
    context.response,
    {
      payload: {
        records: [
          {id: 1, name: 'Admins', deleted: false, users: [1, 2]},
          {id: 2, name: 'Users', deleted: false, users: [3, 4, 5]},
          {id: 3, name: 'Officers', deleted: true, users: []}
        ]
      }
    },
    'return embedded hasMany ids'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('I&T datamapper.request() find belongsTo', (t) => {
  const mapper = new DataMapper(recordTypes, adapterOptions)

  prepareTestTables(initialData)

  .then(() => mapper.request({
    method: 'find',
    type: 'user',
    options: {
      match: {deleted: false},
      fieldsOnly: ['id', 'name'] // 'group' will be added b/c of 'include'
    },
    include: [['group', {fieldsOnly: ['id', 'name']}]]
  }))
  .then((response) => t.deepEqual(
    response,
    {
      status: 'ok',
      payload: {
        records: [
          {id: 1, name: 'John', group: 1},
          {id: 2, name: 'Smith', group: 1},
          {id: 3, name: 'Johanna', group: 2},
          {id: 5, name: 'Makbeth', group: 2}
        ],
        include: {
          group: [
            {id: 1, name: 'Admins'},
            {id: 2, name: 'Users'}
          ]
        }
      }
    },
    '"include" belongsTo with additional options'
  ))

  .catch(t.fail)
  .then(t.end)
})
