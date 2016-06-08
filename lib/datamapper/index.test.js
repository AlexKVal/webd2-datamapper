'use strict'

const test = require('tape')

const Context = require('./context')
const DataMapper = require('./')

test('DataMapper', (t) => {
  t.throws(
    () => new DataMapper('record types'),
    /First argument must be an object/
  )

  t.throws(
    () => new DataMapper({}),
    /At least one type must be specified/
  )

  let recordTypes = {
    user: {
      name: {type: String}
    }
  }
  t.equal(new DataMapper(recordTypes).recordTypes, recordTypes)
  t.ok(new DataMapper(recordTypes).adapter, 'it uses Adapter')

  recordTypes = {
    user: { name: { type: String } },
    group: { name: { type: String } },
    known: { name: { type: String } }
  }
  let options = {
    transforms: {
      known: {
        input: {
          create () {}
        },
        output () {}
      }
    }
  }

  t.deepEqual(
    new DataMapper(recordTypes, options).transforms,
    {
      user: {},
      group: {},
      known: options.transforms.known
    },
    'it calls validateRecordTypes()'
  )

  options.transforms = {
    undescribedModelName: []
  }
  t.throws(
    () => new DataMapper(recordTypes, options),
    /Attempted to define transform on "undescribedModelName" type which does not exist/,
    'it calls validateTransforms()'
  )

  t.end()
})

test('dataMapper.request()', (t) => {
  t.plan(13)

  const recordTypes = { user: { name: {type: String} } }
  const dataMapper = new DataMapper(recordTypes)

  // mocks
  dataMapper.delete = (context) => {
    t.deepEqual(
      context.request.ids,
      [1, 2, 3],
      'ensures ids are unique'
    )
    return context
  }
  dataMapper.find = (context) => {
    t.deepEqual(
      context.request.ids,
      [3, 2],
      'ensures ids are unique'
    )
    context.response.payload = {records: [{some: 'found data'}]}
    return context
  }
  dataMapper.create = (context) => {
    t.equal(context.request.ids, null, 'it does not touch "ids" field')
    t.deepEqual(
      context.request.payload,
      [{some: 'incoming data'}]
    )
    context.response.payload = {records: [{some: 'created data'}]}
    return context
  }
  dataMapper.update = (context) => {
    t.equal(context.request.ids, null, 'it does not touch "ids" field')
    t.deepEqual(
      context.request.payload,
      [{some: 'updates'}]
    )
    context.response.payload = {records: [{some: 'updated data'}]}
    return context
  }

  dataMapper.request({/* type: undefined */})
  .catch((e) => t.equal(e.message, 'UnspecifiedType', 'type is required'))

  dataMapper.request({type: 'unknownType'})
  .catch((e) => t.equal(e.message, 'InvalidType: "unknownType"'))

  dataMapper.request({type: 'user', method: 'unknownMethod'})
  .catch((e) => t.equal(e.message, 'InvalidMethod: "unknownMethod"'))

  .then(() => dataMapper.request({
    type: 'user',
    method: 'delete',
    ids: [1, 1, 2, 2, 3, 3]
  }))
  .then((response) => t.deepEqual(
    response,
    {
      payload: null,
      status: 'empty'
    },
    'with "delete" method it returns "empty" "response"'
  ))

  .then(() => dataMapper.request({
    type: 'user',
    method: 'find',
    ids: [3, 2, 2]
  }))
  .then((response) => t.deepEqual(
    response,
    {
      payload: {records: [{some: 'found data'}]},
      status: 'ok'
    },
    'with "find" method it returns "ok" "response"'
  ))

  .then(() => dataMapper.request({
    type: 'user',
    method: 'create',
    payload: [{some: 'incoming data'}]
  }))
  .then((response) => t.deepEqual(
    response,
    {
      payload: {records: [{some: 'created data'}]},
      status: 'created'
    },
    'with "create" method it returns "created" "response"'
  ))

  .then(() => dataMapper.request({
    type: 'user',
    method: 'update',
    payload: [{some: 'updates'}]
  }))
  .then((response) => t.deepEqual(
    response,
    {
      payload: {records: [{some: 'updated data'}]},
      status: 'ok'
    },
    'with "update" method it returns "ok" "response"'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.request() method: "find"', (t) => {
  t.plan(8)

  const recordTypes = { user: { name: {type: String} } }
  const dataMapper = new DataMapper(recordTypes)

  // mocks
  dataMapper.adapter = {
    connect () {
      t.pass('it calls adapter.connect()')
      return Promise.resolve()
    },
    disconnect () {
      t.pass('it calls adapter.disconnect()')
      return Promise.resolve()
    },
    find (type, options) {
      t.equal(type, 'user')
      t.deepEqual(
        options,
        {ids: [ 1, 2 ], match: { deleted: false }},
        'adapter.find() gets options for it'
      )
      const someFoundRecords = [
        {id: 1, name: 'John'},
        {id: 2, name: 'Maria'}
      ]
      return Promise.resolve(someFoundRecords)
    }
  }
  dataMapper.include = (context) => {
    t.pass('it calls "include"')
    return context
  }
  dataMapper.end = (context) => {
    t.pass('it calls "end"')
    context.response.payload = {
      records: context.response.records
    }
    delete context.response.records
    return context
  }
  dataMapper._ensureIncludeFields = () => t.pass('it calls _ensureIncludeFields()')

  dataMapper.request({
    type: 'user',
    method: 'find',
    ids: [1, 2],
    options: {match: {deleted: false}}
  })
  .then((response) => t.deepEqual(
    response,
    {
      payload: {
        records: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Maria' }
        ]
      },
      status: 'ok'
    },
    'with "find" method it returns "ok" "response"'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.end() with no records. i.e. after "delete"', (t) => {
  const recordTypes = { user: { name: {type: String} } }

  new DataMapper(recordTypes).end({
    request: {},
    response: {},
    transaction: {}
  })
  .then((context) => t.deepEqual(
    context,
    {
      request: {},
      response: {}
    },
    'with no records it returns empty "response"'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.end() fills "payload"', (t) => {
  const recordTypes = { user: { name: {type: String} } }

  new DataMapper(recordTypes).end({
    request: {},
    response: {
      records: [{}, {}],
      include: {type2: [{}, {}], type3: [{}, {}]}
    },
    transaction: {}
  })
  .then((updatedContext) => t.deepEqual(
    updatedContext,
    {
      request: {},
      response: {
        payload: {
          records: [{}, {}],
          include: {type2: [{}, {}], type3: [{}, {}]}
        }
      }
    },
    'it moves records under "payload" and removes "transaction" field'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.end() runs "output" transformers on primary types', (t) => {
  const recordTypes = {
    user: { name: {type: String} },
    group: { shortName: {type: String} },
    post: { text: {type: String} }
  }

  const options = {
    transforms: {
      user: {
        output (context, record) {
          record.userSummary = `${record.id} ${record.name} user`
          return record
        }
      },
      group: {
        output (context, record) {
          record.groupSummary = `${record.id} ${record.shortName} group`
          return record
        }
      }
      // post: {} no "output" for 'post'
    }
  }
  const dataMapper = new DataMapper(recordTypes, options)

  dataMapper.end({
    request: {
      type: 'user'
      // method doesn't matter for "output"
    },
    response: {
      records: [
        {id: 1, name: 'a'},
        {id: 2, name: 'b'}
      ]
    }
  })
  .then((updatedContext) => t.deepEqual(
    updatedContext,
    {
      request: { type: 'user' },
      response: {
        payload: {
          records: [
            {id: 1, name: 'a', userSummary: '1 a user'},
            {id: 2, name: 'b', userSummary: '2 b user'}
          ]
        }
      }
    },
    'it runs "output" transform for "user" type'
  ))

  .then(() => dataMapper.end({
    request: { type: 'group' },
    response: {
      records: [
        {id: 11, shortName: 'gg'},
        {id: 22, shortName: 'hh'}
      ]
    }
  }))
  .then((updatedContext) => t.deepEqual(
    updatedContext,
    {
      request: { type: 'group' },
      response: {
        payload: {
          records: [
            {id: 11, shortName: 'gg', groupSummary: '11 gg group'},
            {id: 22, shortName: 'hh', groupSummary: '22 hh group'}
          ]
        }
      }
    },
    'it runs "output" transform for "group" type'
  ))

  .then(() => dataMapper.end({
    request: { type: 'post' },
    response: {
      records: [
        {id: 101, text: 'some long text'},
        {id: 202, text: 'some another long text'}
      ]
    }
  }))
  .then((updatedContext) => t.deepEqual(
    updatedContext,
    {
      request: { type: 'post' },
      response: {
        payload: {
          records: [
            {id: 101, text: 'some long text'},
            {id: 202, text: 'some another long text'}
          ]
        }
      }
    },
    'without "output" it just returns records as is'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.end() runs "output" transformers of included types', (t) => {
  const recordTypes = {
    user: {
      name: {type: String},
      group: { link: 'group' },
      posts: { link: 'post', isArray: true, inverse: 'user' }
    },
    // 'group' and 'post' records will be 'included'
    group: { shortName: {type: String} },
    post: { text: {type: String}, user: { link: 'user' } }
  }

  const options = {
    transforms: {
      // no 'user' transformers
      group: {
        output (context, record) {
          record.groupSummary = `${record.id} ${record.shortName} group`
          return record
        }
      },
      post: {
        output (context, record) {
          record.postSummary = `${record.id} ${record.text} post`
          return record
        }
      }
    }
  }
  const dataMapper = new DataMapper(recordTypes, options)

  // e.g. find('user', {include: [['group'], ['posts']]})
  dataMapper.end({
    request: {
      type: 'user',
      method: 'find'
    },
    response: {
      records: [
        {id: 1, name: 'a', group: 22},
        {id: 2, name: 'b', group: 23}
      ],
      include: {
        group: [
          {id: 22, shortName: 'Admins'},
          {id: 23, shortName: 'Users'}
        ],
        post: [
          {id: 101, text: 'some long text'},
          {id: 102, text: 'some another long text'}
        ]
      }
    }
  })
  .then((updatedContext) => t.deepEqual(
    updatedContext,
    {
      request: { type: 'user', method: 'find' },
      response: {
        payload: {
          records: [ // 'user' has no "output" hence 'user' records are as is
            {id: 1, name: 'a', group: 22},
            {id: 2, name: 'b', group: 23}
          ],
          include: {
            group: [
              {id: 22, shortName: 'Admins', groupSummary: '22 Admins group'},
              {id: 23, shortName: 'Users', groupSummary: '23 Users group'}
            ],
            post: [
              {id: 101, text: 'some long text', postSummary: '101 some long text post'},
              {id: 102, text: 'some another long text', postSummary: '102 some another long text post'}
            ]
          }
        }
      }
    },
    'it runs "output" transform for included types'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.include() primary model has no hasMany links', (t) => {
  const recordTypes = { user: { name: {type: String} } } // no hasMany links

  const contextWithoutRecords = {
    request: { type: 'user', include: [['group']] },
    response: { /* no records */ }
  }
  t.equal(
    new DataMapper(recordTypes).include(contextWithoutRecords),
    contextWithoutRecords,
    'without "response.records" it does nothing'
  )

  const contextWithoutInclude = {
    request: { type: 'user' }, /* no include and no hasMany links */
    response: {
      records: [{}, {}]
    }
  }
  t.equal(
    new DataMapper(recordTypes).include(contextWithoutInclude),
    contextWithoutInclude,
    'w/o "request.include" option and hasMany links it does nothing'
  )

  const contextWithoutEmptyInclude = {
    request: { type: 'user', include: [] },
    response: {
      records: [{}, {}]
    }
  }
  t.equal(
    new DataMapper(recordTypes).include(contextWithoutEmptyInclude),
    contextWithoutEmptyInclude,
    'with empty "request.include" option and w/o hasMany links it does nothing'
  )

  t.end()
})

test('dataMapper.include() with belongsTo records', (t) => {
  t.plan(3)

  const recordTypes = {
    user: {
      name: { type: String },
      group: { link: 'group' } // belongsTo
    },
    group: {
      shortName: { type: String }
    }
  }

  const context = {
    request: {
      type: 'user',
      include: [
        ['group']
      ]
    },
    response: {
      records: [
        {id: 1, name: 'John', group: 3},
        {id: 2, name: 'Joan', group: 1},
        {id: 3, name: 'John 2', group: 3},
        {id: 4, name: 'Joan 2', group: 1}
      ]
    }
  }

  const mapper = new DataMapper(recordTypes)

  // mock
  mapper.adapter.find = (type, options) => {
    t.equal(type, 'group')
    t.deepEqual(
      options,
      { ids: [3, 1] },
      'it sends to adapter only unique ids' // instead of [3, 1, 3, 1]
    )

    return Promise.resolve([
      {id: 1, shortName: 'Admins'},
      {id: 3, shortName: 'Users'}
    ])
  }

  mapper.include(context)
  .then((result) => t.deepEqual(
    result.response,
    {
      records: [
        {id: 1, name: 'John', group: 3},
        {id: 2, name: 'Joan', group: 1},
        {id: 3, name: 'John 2', group: 3},
        {id: 4, name: 'Joan 2', group: 1}
      ],
      include: {
        group: [
          {id: 1, shortName: 'Admins'},
          {id: 3, shortName: 'Users'}
        ]
      }
    }
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.include() with all "null" belongsTo', (t) => {
  const recordTypes = {
    user: {
      name: { type: String },
      group: { link: 'group' } // belongsTo
    },
    group: {
      shortName: { type: String }
    }
  }

  const context = {
    request: {
      type: 'user',
      include: [
        ['group']
      ]
    },
    response: {
      records: [
        {id: 1, name: 'John', group: null},
        {id: 2, name: 'Joan', group: null}
      ]
    }
  }

  const mapper = new DataMapper(recordTypes)

  // mock
  mapper.adapter.find = () => t.fail('adapter.find() should not be called')

  mapper.include(context)
  .then((result) => t.deepEqual(
    result.response,
    {
      records: [
        {id: 1, name: 'John', group: null},
        {id: 2, name: 'Joan', group: null}
      ]
    },
    'it should not add "include"'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.include() with some "null" belongsTo', (t) => {
  t.plan(3)

  const recordTypes = {
    user: {
      name: { type: String },
      group: { link: 'group' } // belongsTo
    },
    group: {
      shortName: { type: String }
    }
  }

  const context = {
    request: {
      type: 'user',
      include: [
        ['group']
      ]
    },
    response: {
      records: [
        {id: 1, name: 'John', group: 3},
        {id: 2, name: 'Joan', group: null}
      ]
    }
  }

  const mapper = new DataMapper(recordTypes)

  // mock
  mapper.adapter.find = (type, options) => {
    t.equal(type, 'group')
    t.deepEqual(options, { ids: [3] })

    return Promise.resolve([
      {id: 3, shortName: 'Users'}
    ])
  }

  mapper.include(context)
  .then((result) => t.deepEqual(
    result.response,
    {
      records: [
        {id: 1, name: 'John', group: 3},
        {id: 2, name: 'Joan', group: null}
      ],
      include: {
        group: [
          {id: 3, shortName: 'Users'}
        ]
      }
    },
    'it adds only not "null" relations'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.include() with hasMany records', (t) => {
  t.plan(3)

  const recordTypes = {
    user: {
      name: { type: String },

      // this belongsTo is always exist for hasMany counterparts
      group: { link: 'group', $fname: 'GrpID' }
    },
    group: {
      name: { type: String },
      users: { link: 'user', isArray: true } // hasMany
    }
  }

  const context = {
    request: {
      type: 'group',
      include: [
        ['users']
      ]
    },
    response: {
      records: [
        // find() does not fetch hasMany fields of primary records
        {id: 10, name: 'Admins'}, // there is no 'users' field yet
        {id: 11, name: 'Users'},
        {id: 12, name: 'Waiters'},
        {id: 13, name: 'Stuff'}
      ]
    }
  }

  const mapper = new DataMapper(recordTypes)

  // mock
  mapper.adapter.find = (type, options) => {
    t.equal(type, 'user')
    t.deepEqual(
      options,
      { match: { group: [10, 11, 12, 13] } },
      'it fetches records by foreign key'
    )

    return Promise.resolve([
      {id: 8, name: 'User-8', group: 10},
      {id: 7, name: 'User-7', group: 10},
      {id: 6, name: 'User-6', group: 11},
      {id: 5, name: 'User-5', group: 11},
      {id: 4, name: 'User-4', group: 12},
      {id: 3, name: 'User-3', group: 12},
      {id: 2, name: 'User-2', group: 13},
      {id: 1, name: 'User-1', group: 13}
    ])
  }

  mapper.include(context)
  .then((result) => t.deepEqual(
    result.response,
    {
      records: [
        {id: 10, name: 'Admins', users: [8, 7]},
        {id: 11, name: 'Users', users: [6, 5]},
        {id: 12, name: 'Waiters', users: [4, 3]},
        {id: 13, name: 'Stuff', users: [2, 1]}
      ],
      include: {
        user: [
          {id: 8, name: 'User-8', group: 10},
          {id: 7, name: 'User-7', group: 10},
          {id: 6, name: 'User-6', group: 11},
          {id: 5, name: 'User-5', group: 11},
          {id: 4, name: 'User-4', group: 12},
          {id: 3, name: 'User-3', group: 12},
          {id: 2, name: 'User-2', group: 13},
          {id: 1, name: 'User-1', group: 13}
        ]
      }
    },
    'it embeds hasMany fields into primary records'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.include() w/o "include" option but w/ hasMany in primary model', (t) => {
  t.plan(3)

  const recordTypes = {
    user: {
      name: { type: String },
      group: { link: 'group', $fname: 'GrpID' }
    },
    group: {
      name: { type: String },
      users: { link: 'user', isArray: true } // hasMany
    }
  }

  const context = {
    request: {
      type: 'group'
      // no "include"
    },
    response: {
      records: [
        // find() does not fetch hasMany fields of primary records
        {id: 10, name: 'Admins'}, // there is no 'users' field yet
        {id: 11, name: 'Users'},
        {id: 12, name: 'Waiters'},
        {id: 13, name: 'Stuff'}
      ]
    }
  }

  const mapper = new DataMapper(recordTypes)

  // mock
  mapper.adapter.find = (type, options) => {
    t.equal(type, 'user')
    t.deepEqual(
      options,
      {
        fieldsOnly: ['id', 'group'],
        match: { group: [10, 11, 12, 13] }
      },
      'it asks for only IDs'
    )

    return Promise.resolve([
      {id: 8, group: 10},
      {id: 7, group: 10},
      {id: 6, group: 11},
      {id: 5, group: 11},
      {id: 4, group: 12},
      {id: 3, group: 12},
      {id: 2, group: 13},
      {id: 1, group: 13}
    ])
  }

  mapper.include(context)
  .then((result) => t.deepEqual(
    result.response,
    {
      records: [
        {id: 10, name: 'Admins', users: [8, 7]},
        {id: 11, name: 'Users', users: [6, 5]},
        {id: 12, name: 'Waiters', users: [4, 3]},
        {id: 13, name: 'Stuff', users: [2, 1]}
      ]
    },
    'it only fetches and embeds IDs of hasMany'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper.include() w/ a couple of "hasMany" pointing to different models', (t) => {
  t.plan(5)

  const recordTypes = {
    person: {
      ownPets: { link: 'pet', isArray: true },
      accounts: { link: 'account', isArray: true }
    },
    pet: {
      owner: { link: 'person', inverse: 'ownPets' }
    },
    account: {
      user: { link: 'person', inverse: 'accounts' }
    }
  }

  const context = {
    request: { type: 'person' },
    response: {
      records: [
        {id: 10},
        {id: 11},
        {id: 12},
        {id: 13}
      ]
    }
  }

  const mapper = new DataMapper(recordTypes)

  // mock
  let callsCounter = 0
  mapper.adapter.find = (type, options) => {
    callsCounter++

    if (callsCounter === 1) {
      t.equal(type, 'pet')
      t.deepEqual(
        options,
        {
          fieldsOnly: ['id', 'owner'],
          match: { owner: [10, 11, 12, 13] }
        }
      )

      return Promise.resolve([
        {id: 8, owner: 10},
        {id: 6, owner: 11},
        {id: 4, owner: 12},
        {id: 2, owner: 13},
        {id: 1, owner: 13}
      ])
    }

    if (callsCounter === 2) {
      t.equal(type, 'account')
      t.deepEqual(
        options,
        {
          fieldsOnly: ['id', 'user'],
          match: { user: [10, 11, 12, 13] }
        }
      )

      return Promise.resolve([
        {id: 105, user: 10},
        {id: 104, user: 10},
        {id: 103, user: 11},
        {id: 102, user: 12},
        {id: 101, user: 13}
      ])
    }

    t.fail('it calls more than two times find()')
  }

  mapper.include(context)
  .then((result) => t.deepEqual(
    result.response,
    {
      records: [
        {id: 10, ownPets: [8], accounts: [105, 104]},
        {id: 11, ownPets: [6], accounts: [103]},
        {id: 12, ownPets: [4], accounts: [102]},
        {id: 13, ownPets: [2, 1], accounts: [101]}
      ]
    },
    'it embeds all hasMany links'
  ))

  .catch(t.fail)
  .then(t.end)
})

test('dataMapper._validateIncludeOption()', (t) => {
  const recordTypes = {
    user: {
      notALinkField: { type: String },
      group: { link: 'group' } // belongsTo
      // there is no belongsTo 'account' relation
    },
    group: {
      shortName: { type: String },
      users: { link: 'user', isArray: true } // hasMany
    }
  }

  const mapper = new DataMapper(recordTypes)

  t.throws(
    () => mapper._validateIncludeOption('user', 'include option is not an array'),
    /"include" option should be an array/
  )

  t.throws(
    () => mapper._validateIncludeOption('user', [ 'notAnArray' ]),
    /"include" 'notAnArray' field descriptor should be an array/
  )

  t.throws(
    () => mapper._validateIncludeOption('user', [ ['undescribedField'] ]),
    /include: there is no 'undescribedField' field in 'user' type/
  )

  t.throws(
    () => mapper._validateIncludeOption('user', [ ['notALinkField'] ]),
    /include: 'notALinkField' field is not a link/
  )

  t.throws(
    () => mapper._validateIncludeOption('user', [ ['group', 'options'] ]),
    /include: options for 'group' is not an object/
  )

  t.doesNotThrow(
    () => mapper._validateIncludeOption('group', [ ['users'] ]),
    'right hasMany relation'
  )

  t.end()
})

test('dataMapper._ensureIncludeFields()', (t) => {
  const recordTypes = {
    user: {
      name: { type: String },
      group: { link: 'group' }, // belongsTo
      rights: { link: 'rights' } // belongsTo
    },
    group: {
      shortName: { type: String },
      users: { link: 'user', isArray: true } // hasMany
    },
    rights: {
      name: { type: String }
    }
  }

  const mapper = new DataMapper(recordTypes)

  t.deepEqual(
    mapper._ensureIncludeFields({
      type: 'user',
      options: {}, // there is no 'fieldsOnly'
      include: [
        ['group']
      ]
    }),
    {
      type: 'user',
      include: [ [ 'group' ] ],
      options: {}
    },
    'it does nothing if there is no "fieldsOnly" constraint'
  )

  t.deepEqual(
    mapper._ensureIncludeFields({
      type: 'user',
      options: {
        fieldsOnly: ['id', 'name'] // there is some 'fieldsOnly' constraints
      }
      // and no 'include' option
    }),
    {
      type: 'user',
      options: { fieldsOnly: ['id', 'name'] }
    },
    'it does nothing if there is no "include" option'
  )

  t.deepEqual(
    mapper._ensureIncludeFields({
      type: 'user',
      options: {
        fieldsOnly: ['id', 'name'] // 'group' is not specified
      },
      include: [
        ['group']
      ]
    }),
    {
      type: 'user',
      include: [ [ 'group' ] ],

      options: {
        fieldsOnly: [ 'id', 'name', 'group' ]
      }
    },
    'it adds belongsTo fields if they were not specified in fieldsOnly'
  )

  t.deepEqual(
    mapper._ensureIncludeFields({
      type: 'user',
      options: {
        fieldsOnly: ['id', 'name', 'group'] // 'rights' is forgotten
      },
      include: [
        ['group'],
        ['rights']
      ]
    }),
    {
      type: 'user',
      include: [
        ['group'],
        ['rights']
      ],
      options: {
        fieldsOnly: [ 'id', 'name', 'group', 'rights' ]
      }
    },
    'it adds only missing fields'
  )

  t.deepEqual(
    mapper._ensureIncludeFields({
      type: 'group',
      options: {
        fieldsOnly: ['id', 'shortName']
      },
      include: [
        ['users'] // hasMany
      ]
    }),
    {
      type: 'group',
      options: {
        fieldsOnly: ['id', 'shortName']
      },
      include: [
        ['users'] // hasMany
      ]
    },
    'it does nothing with hasMany'
  )

  t.throws(
    () => mapper._ensureIncludeFields({
      type: 'user',
      include: ['group'] // wrong: should be [['group']]
    }),
    /"include" 'group' field descriptor should be an array/,
    'it uses _validateIncludeOption()'
  )

  t.throws(
    () => mapper._ensureIncludeFields({
      type: 'user',
      include: 'some string'
    }),
    /"include" option should be an array/,
    'it uses _validateIncludeOption() even if the value is not an array'
  )

  t.end()
})

test('dataMapper._ensureIncludeFields() uses `include` option validation', (t) => {
  t.plan(1)

  const recordTypes = {
    user: {
      name: { type: String },
      group: { link: 'group' }, // belongsTo
      rights: { link: 'rights' } // belongsTo
    },
    group: {
      shortName: { type: String },
      users: { link: 'user', isArray: true } // hasMany
    },
    rights: {
      name: { type: String }
    }
  }

  const mapper = new DataMapper(recordTypes)

  // mock
  mapper._validateIncludeOption = () => t.pass('it uses _validateIncludeOption()')

  mapper._ensureIncludeFields({
    type: 'user',
    options: {
      fieldsOnly: ['id', 'name'] // 'group' is not specified
    },
    include: [
      ['group']
    ]
  })

  t.end()
})

test('dataMapper._getInverseLink(primaryType, isArrayLinkName)', (t) => {
  const mapper = new DataMapper({
    person: {
      $table: 'sPersonal',
      ownPets: { link: 'pet', isArray: true }, // or inverse: 'owner'
      groomingPets: { link: 'pet', isArray: true, inverse: 'groomer' }
    },
    pet: {
      $table: 'sPets',
      owner: { link: 'person', inverse: 'ownPets' },
      groomer: { link: 'person' } // or inverse: 'groomingPets'
    }
  })

  t.equal(
    mapper._getInverseLink('person', 'ownPets'),
    'owner'
  )

  t.equal(
    mapper._getInverseLink('person', 'groomingPets'),
    'groomer'
  )

  t.equal(
    new DataMapper({
      person: {
        groomingPets: { link: 'pet', isArray: true, inverse: 'groomer' }
      },
      pet: {
        owner: { link: 'person' },
        groomer: { link: 'person' }
      }
    })._getInverseLink('person', 'groomingPets'),
    'groomer',
    'by `inverse` in hasMany link'
  )

  t.equal(
    new DataMapper({
      person: {
        groomingPets: { link: 'pet', isArray: true }
      },
      pet: {
        owner: { link: 'person' },
        groomer: { link: 'person', inverse: 'groomingPets' }
      }
    })._getInverseLink('person', 'groomingPets'),
    'groomer',
    'by `inverse` in belongsTo link'
  )

  t.equal(
    new DataMapper({
      person: {
        groomingPets: { link: 'pet', isArray: true }
      },
      pet: {
        groomer: { link: 'person' }
      }
    })._getInverseLink('person', 'groomingPets'),
    'groomer',
    'with unambiguous belongsTo link'
  )

  t.end()
})

test('dataMapper._mergeIncludeWithArrayLinks(primaryType, includeOption)', (t) => {
  const recordTypes = {
    person: {
      $table: 'sPersonal',
      ownPets: { link: 'pet', isArray: true },
      accounts: { link: 'account', isArray: true }
    },
    pet: {
      $table: 'sPets',
      owner: { link: 'person', inverse: 'ownPets' }
    },
    account: {
      $table: 'sAccounts',
      user: { link: 'person', inverse: 'accounts' }
    }
  }

  const mapper = new DataMapper(recordTypes)

  t.deepEqual(
    mapper._mergeIncludeWithArrayLinks('person', [
      ['accounts', {fieldsOnly: ['id', 'name'], match: {deleted: false}}]
    ]),
    [
      ['accounts', {fieldsOnly: ['id', 'name', 'user'], match: {deleted: false}}],
      ['ownPets', {fieldsOnly: ['id', 'owner']}]
    ],
    'it adds array link field and merges options for another'
  )

  t.deepEqual(
    mapper._mergeIncludeWithArrayLinks('person', [/* empty include */]),
    [
      ['ownPets', {fieldsOnly: ['id', 'owner']}],
      ['accounts', {fieldsOnly: ['id', 'user']}]
    ],
    'w/ empty "include" it adds array link fields'
  )

  t.deepEqual(
    mapper._mergeIncludeWithArrayLinks('person', [
      ['ownPets'],
      ['accounts']
    ]),
    [
      ['ownPets'],
      ['accounts']
    ],
    'when all array links are present in "include" and w/o custom options'
  )

  t.deepEqual(
    mapper._mergeIncludeWithArrayLinks('person', [
      ['ownPets', {match: {deleted: false}}],
      ['accounts', {match: {deleted: false}}]
    ]),
    [
      ['ownPets', {match: {deleted: false}}],
      ['accounts', {match: {deleted: false}}]
    ],
    'when all array links are present in "include" and w/ custom options'
  )

  t.end()
})

test('dataMapper.create()', (t) => {
  t.plan(14)

  const recordTypes = {
    user: { name: {type: String}, counter: {type: Number} }
  }
  const options = {
    transforms: { user: { input: {
      create (context, record) {
        t.pass('it calls "create" transfomer for each record')
        t.equal(context.transaction, adapter, 'transformer has access to `transaction`')
        record.counter = 33
        return record
      }
    }}}
  }
  const dataMapper = new DataMapper(recordTypes, options)

  // mocks
  const adapter = {}
  adapter.beginTransaction = () => {
    t.pass('it calls adapter.beginTransaction()')
    return Promise.resolve(adapter)
  }
  adapter.endTransaction = () => {
    t.pass('it calls adapter.endTransaction()')
    return Promise.resolve()
  }
  adapter.create = (type, records) => {
    t.pass('it calls adapter.create()')
    t.equal(type, 'user')
    t.deepEqual(
      records,
      [
        {name: 'New1', counter: 33},
        {name: 'New2', counter: 33},
        {name: 'New3', counter: 33}
      ],
      'it passes input-transformed records to adapter.create()'
    )

    return Promise.resolve([ // db-layer adds ids
      {name: 'New1', counter: 33, id: 1},
      {name: 'New2', counter: 33, id: 2},
      {name: 'New3', counter: 33, id: 3}
    ])
  }

  dataMapper.adapter = adapter

  dataMapper.end = (context) => {
    t.pass('it calls "end"')
    context.response.payload = {
      records: context.response.records
    }
    delete context.response.records
    delete context.transaction
    return context
  }

  dataMapper.create(new Context({
    type: 'user',
    payload: [] // empty payload
  }))
  .catch((e) => t.equal(e.message, 'CreateRecordsInvalid'))

  dataMapper.create(new Context({
    type: 'user',
    payload: [
      {name: 'New1', counter: 11},
      {name: 'New2', counter: 12},
      {name: 'New3', counter: 13}
    ]
  }))
  .then((context) => t.deepEqual(
    context.response,
    {
      payload: {
        records: [
          { id: 1, name: 'New1', counter: 33 },
          { id: 2, name: 'New2', counter: 33 },
          { id: 3, name: 'New3', counter: 33 }
        ]
      }
    },
    'it returns input-transformed and saved records w/ autoassigned ids'
  ))

  .catch(t.fail)
  .then(t.end)
})
