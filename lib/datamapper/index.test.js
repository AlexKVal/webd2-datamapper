'use strict'

const test = require('tape')

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
      known: [() => 'in', () => 'out']
    }
  }

  t.deepEqual(
    new DataMapper(recordTypes, options).transforms,
    {
      user: [],
      group: [],
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
  t.plan(11)

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
    t.deepEqual(
      context.request.payload,
      [{some: 'incoming data'}]
    )
    context.response.payload = {records: [{some: 'created data'}]}
    return context
  }
  dataMapper.update = (context) => {
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

test('dataMapper.find()', (t) => {
  t.plan(6)

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
    t.pass('it calls "include" at the end')
    context.response.payload = {
      records: context.response.records
    }
    delete context.response.records
    return context
  }

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

test('dataMapper.end()', (t) => {
  // t.plan()

  const recordTypes = { user: { name: {type: String} } }

  const options = {
    transforms: {
      user: [
        // in
        // out
      ]
    }
  }
  const dataMapper = new DataMapper(recordTypes, options)

  dataMapper.end({
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

  // 'it runs "output" transforms for every type'

  .catch(t.fail)
  .then(t.end)
})
