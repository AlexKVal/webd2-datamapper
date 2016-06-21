'use strict'
const test = require('tape')

const ApiWrapper = require('./api-wrapper')

const registryMock = { model (modelName) { return {name: modelName} } }

test('ApiWrapper', (t) => {
  const someModelMock = {
    name: 'some-model-name',
    attributesSerialize: [],
    schema: { tableName: 'some' }
  }

  const apiWrappedSomeModel = new ApiWrapper({
    model: someModelMock,
    serializer: {}, deserializer: {},
    registryMock
  })

  t.throws(
    () => new ApiWrapper(),
    /Cannot match against 'undefined' or 'null'/,
    'needs at least a {model: model}'
  )

  t.throws(
    () => new ApiWrapper({ model: {} }),
    /ApiWrapper needs a model with 'name' and 'schema' fields/,
    'model should be with a name'
  )

  t.throws(
    () => new ApiWrapper({ model: {name: 'some-name'} }),
    /ApiWrapper needs a model with 'name' and 'schema' fields/,
    'and model should be with a schema'
  )

  t.doesNotThrow(
    () => new ApiWrapper(someModelMock),
    /ApiWrapper needs a model with 'name' and 'schema' fields/,
    'model could be provided directly'
  )

  const aRegistryMock = {}
  t.doesNotThrow(
    () => new ApiWrapper(someModelMock, aRegistryMock),
    'registry could be passed as a second argument for testing'
  )

  t.equal(apiWrappedSomeModel.model, someModelMock, '`model` property holds a model')

  t.end()
})

test('apiWrapper.apiCreate()', (t) => {
  t.plan(5)

  const newDataFromClient = { some: 'does not matter' }
  const deserializedNewData = { someOther: 'also does not matter' }
  const dataFromCreate = { some2: '2' }

  const deserializer = {
    deserialize (newData) {
      t.equal(newData, newDataFromClient, 'passes to deserializer newData')
      return Promise.resolve(deserializedNewData)
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    create (deserialized) {
      t.equal(
        deserialized,
        deserializedNewData,
        'provides deserialized data to model`s create() method'
      )

      return Promise.resolve(dataFromCreate)
    }
  }

  const apiWrappedModel = new ApiWrapper({model, deserializer, serializer: {}, registryMock})

  t.throws(
    () => apiWrappedModel.apiCreate(/* no data */),
    /newData cannot be undefined/,
    'needs a newData'
  )

  // mock it for testing
  apiWrappedModel._joinRelationsAndSerialize = (record) => {
    t.equal(
      record,
      dataFromCreate,
      'joins relations and serializes the result from model.create()'
    )

    return 'joined and serialized record'
  }

  apiWrappedModel.apiCreate(newDataFromClient)
  .then((result) => t.equal(result, 'joined and serialized record'))
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('apiWrapper.apiCreate() returns error from deserializer', (t) => {
  t.plan(2)

  const deserializer = {
    deserialize (newData) {
      t.equal(newData, 'new data from client', 'passes to deserializer newData')
      return Promise.reject(new Error('some deserializer`s error'))
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    create (deserialized) {
      t.fail('model.create() should not be called')
    }
  }

  const apiWrappedModel = new ApiWrapper({model, deserializer, serializer: {}, registryMock})

  // mock it for testing
  apiWrappedModel._joinRelationsAndSerialize = () => {
    t.fail('_joinRelationsAndSerialize() should not be called')
  }

  apiWrappedModel.apiCreate('new data from client')
  .then(() => t.fail('should not be called'))
  .catch((e) => {
    t.equal(
      e.message,
      'some deserializer`s error',
      'returns error from deserializer'
    )
  })
  .then(() => t.end())
})

test('apiWrapper.apiCreate() returns error from model.create()', (t) => {
  t.plan(3)

  const deserializer = {
    deserialize (newData) {
      t.equal(newData, 'new data from client', 'passes to deserializer newData')
      return Promise.resolve('deserializedNewData')
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    create (deserialized) {
      t.equal(
        deserialized,
        'deserializedNewData',
        'provides deserialized data to model`s create() method'
      )

      return Promise.reject(new Error('some create()`s error'))
    }
  }

  const apiWrappedModel = new ApiWrapper({model, deserializer, serializer: {}, registryMock})

  // mock it for testing
  apiWrappedModel._joinRelationsAndSerialize = () => {
    t.fail('_joinRelationsAndSerialize() should not be called')
  }

  apiWrappedModel.apiCreate('new data from client')
  .then(() => t.fail('should not be called'))
  .catch((e) => {
    t.equal(
      e.message,
      'some create()`s error',
      'returns error from model.create()'
    )
  })
  .then(() => t.end())
})

test('apiWrapper.apiUpdate()', (t) => {
  t.plan(6)

  const updatesDataFromClient = { some: 'does not matter' }
  const deserializedUpdatesData = { someOther: 'also does not matter' }
  const dataFromUpdate = { some2: '2' }

  const deserializer = {
    deserialize (data) {
      t.equal(data, updatesDataFromClient, 'passes to deserializer updates data')
      return Promise.resolve(deserializedUpdatesData)
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    update (id, deserialized) {
      t.equal(id, 131, 'provides id to model`s update method')
      t.equal(
        deserialized,
        deserializedUpdatesData,
        'provides deserialized data to model`s update() method'
      )

      return Promise.resolve(dataFromUpdate)
    }
  }

  const apiWrappedModel = new ApiWrapper({model, deserializer, serializer: {}, registryMock})

  t.throws(
    () => apiWrappedModel.apiUpdate(/* no id */),
    /id and updates cannot be undefined/,
    'needs id and updates'
  )

  // mock it for testing
  apiWrappedModel._joinRelationsAndSerialize = (record) => {
    t.equal(
      record,
      dataFromUpdate,
      'joins relations and serializes the result from model.update()'
    )

    return 'joined and serialized record'
  }

  apiWrappedModel.apiUpdate(131, updatesDataFromClient)
  .then((result) => t.equal(result, 'joined and serialized record'))
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('apiWrapper.apiUpdate() returns error from deserializer', (t) => {
  t.plan(1)

  const deserializer = {
    deserialize () {
      return Promise.reject(new Error('some deserializer`s error'))
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    update () {
      t.fail('model.update() should not be called')
    }
  }

  const apiWrappedModel = new ApiWrapper({model, deserializer, serializer: {}, registryMock})

  // mock it for testing
  apiWrappedModel._joinRelationsAndSerialize = () => {
    t.fail('_joinRelationsAndSerialize() should not be called')
  }

  apiWrappedModel.apiUpdate(131, {updatesData: 'from client'})
  .then(() => t.fail('should not be called'))
  .catch((e) => {
    t.equal(
      e.message,
      'some deserializer`s error',
      'returns error from deserializer'
    )
  })
  .then(() => t.end())
})

test('apiWrapper.apiUpdate() returns error from model.update()', (t) => {
  t.plan(1)

  const deserializer = {
    deserialize () {
      return Promise.resolve('deserializedNewData')
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    update () {
      return Promise.reject(new Error('some update()`s error'))
    }
  }

  const apiWrappedModel = new ApiWrapper({model, deserializer, serializer: {}, registryMock})

  // mock it for testing
  apiWrappedModel._joinRelationsAndSerialize = () => {
    t.fail('_joinRelationsAndSerialize() should not be called')
  }

  apiWrappedModel.apiUpdate(131, {updatesData: 'from client'})
  .then(() => t.fail('should not be called'))
  .catch((e) => {
    t.equal(
      e.message,
      'some update()`s error',
      'returns error from model.update()'
    )
  })
  .then(() => t.end())
})

test('apiWrapper.apiFind()', (t) => {
  t.plan(4)

  const dataFromSelect = { some: 'some' }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    selectOne ({id}) {
      t.equal(id, 1001, 'provides id to model`s selectOne() method')
      return Promise.resolve(dataFromSelect)
    }
  }

  const apiWrappedModel = new ApiWrapper({ model, deserializer: {}, serializer: {}, registryMock })

  t.throws(
    () => apiWrappedModel.apiFind(/* no id */),
    /id cannot be undefined/,
    'needs an id'
  )

  // mock it for testing
  apiWrappedModel._joinRelationsAndSerialize = (record) => {
    t.equal(
      record,
      dataFromSelect,
      'joins relations and serializes the result from model.selectOne()'
    )

    return 'joined and serialized record'
  }

  apiWrappedModel.apiFind(1001)
  .then((result) => t.equal(result, 'joined and serialized record'))
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('apiWrapper.apiFetchMany() without related', (t) => {
  t.plan(4)

  const serializer = {
    withoutRelated (data) {
      t.equal(data, '"joined" data', 'passes to serializer data after joining')
      return Promise.resolve('serialized data')
    },
    withRelated () {
      t.fail('serializer.withRelated() should no be called')
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    selectMany (options) {
      t.deepEqual(options, {}, 'options for model.selectMany()')
      return Promise.resolve('data from selectMany')
    }
  }

  const apiWrappedModel = new ApiWrapper({model, serializer, deserializer: {}, registryMock})

  // mock it for testing
  apiWrappedModel.relations = {
    justEmbedJoinedIds (parentRows) {
      t.equal(
        parentRows,
        'data from selectMany',
        'joins relations and serializes the result from model.update()'
      )

      return '"joined" data'
    }
  }

  apiWrappedModel.apiFetchMany(/* no options */)
  .then((result) => t.equal(result, 'serialized data'))
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('apiWrapper.apiFetchMany() with JOIN-ed relations', (t) => {
  t.plan(4)

  const serializer = {
    withRelated (data) {
      t.equal(data, '"joined" data', 'passes to serializer data after joining')
      return Promise.resolve('serialized data')
    },
    withoutRelated () {
      t.fail('serializer.withoutRelated() should no be called')
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    selectMany (options) {
      t.deepEqual(options, {sideloadJoinedRelations: true}, 'options for model.selectMany()')
      return Promise.resolve('data from selectMany')
    }
  }

  const apiWrappedModel = new ApiWrapper({model, serializer, deserializer: {}, registryMock})

  // mock it for testing
  apiWrappedModel.relations = {
    fetchAndEmbedJoined (parentRows) {
      t.equal(
        parentRows,
        'data from selectMany',
        'joins relations and serializes the result from model.update()'
      )

      return '"joined" data'
    }
  }
  apiWrappedModel._joinBelongsToRelations = () => t.fail('this._joinBelongsToRelations() should not be called')

  apiWrappedModel.apiFetchMany({sideloadJoinedRelations: true})
  .then((result) => t.equal(result, 'serialized data'))
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('apiWrapper.apiFetchMany(options) with options for relations', (t) => {
  t.plan(5)

  const serializer = {
    withRelated (data) {
      t.equal(data, '"joined" data', 'passes to serializer data after joining')
      return Promise.resolve('serialized data')
    },
    withoutRelated () {
      t.fail('serializer.withoutRelated() should no be called')
    }
  }

  const model = {
    name: 'someModelName',
    schema: { tableName: 'some' },
    selectMany (options) {
      t.deepEqual(
        options,
        {
          sideloadJoinedRelations: true,

          fieldsOnly: ['name', 'active', 'hide', 'group'],
          where: {active: true},
          orderBy: 'name'
        },
        'options for parent`s model.selectMany()'
      )
      return Promise.resolve('data from selectMany')
    }
  }

  const apiWrappedModel = new ApiWrapper({model, serializer, deserializer: {}, registryMock})

  // mock it for testing
  apiWrappedModel.relations = {
    fetchAndEmbedJoined (parentRows, options) {
      t.deepEqual(
        options,
        {
          parentWhere: {active: true},

          // additional constraints for relations` models
          group: { where: {hide: false} },
          divisions: { fieldsOnly: ['name', 'manager'], where: {hide: false} }
        },
        'it passes options for relations'
      )

      t.equal(
        parentRows,
        'data from selectMany',
        'joins relations and serializes the result from model.update()'
      )

      return '"joined" data'
    }
  }

  const options = {
    sideloadJoinedRelations: true, // main testing option

    // constraints for parent model
    fieldsOnly: ['name', 'active', 'hide', 'group'],
    where: {active: true},
    orderBy: 'name',

    // constraints for relations` models
    relationsOptions: {
      group: { where: {hide: false} },
      divisions: { fieldsOnly: ['name', 'manager'], where: {hide: false} }
    }
  }

  apiWrappedModel.apiFetchMany(options)
  .then((result) => t.equal(result, 'serialized data'))
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

/**
 * REST Api methods
 */
function getMinimalWrapper () {
  const model = { name: 'someModelName', schema: { tableName: 'some' } }
  return new ApiWrapper({model, deserializer: {}, serializer: {}, registryMock})
}

test('apiWrapper.create()', (t) => {
  t.plan(5)

  const wrapper = getMinimalWrapper()

  wrapper.apiCreate = (body) => {
    t.pass('it calls apiCreate()')
    t.equal(body, 'request body data', 'passes req.body')
    return Promise.resolve({data: {field: 'serialized data'}})
  }

  const next = () => t.fail('next() should not be called')
  const req = { body: 'request body data' }
  const res = {}
  res.status = (code) => {
    t.equal(code, 201, 'calls status with 201')
    return res
  }
  res.json = (serialized) => {
    t.deepEqual(serialized, {data: {field: 'serialized data'}}, 'calls json')
    t.end()
  }

  t.doesNotThrow(
    () => wrapper.create(req, res, next),
    'additional check'
  )
})

test('apiWrapper.update()', (t) => {
  t.plan(6)

  const wrapper = getMinimalWrapper()

  wrapper.apiUpdate = (id, body) => {
    t.pass('it calls apiUpdate()')
    t.equal(id, 123, 'passes parsed req.id')
    t.equal(body, 'request body data', 'passes req.body')
    return Promise.resolve({data: {field: 'serialized data'}})
  }

  const next = () => t.fail('next() should not be called')
  const req = { id: 123, body: 'request body data' }
  const res = {}
  res.status = (code) => {
    t.equal(code, 201, 'calls status with 201')
    return res
  }
  res.json = (serialized) => {
    t.deepEqual(serialized, {data: {field: 'serialized data'}}, 'calls json')
    t.end()
  }

  t.doesNotThrow(
    () => wrapper.update(req, res, next),
    'additional check'
  )
})

test('apiWrapper.delete()', (t) => {
  t.plan(2)

  const wrapper = getMinimalWrapper()

  const next = (err) => t.equal(err.message, 'REST delete() is not implemented')

  t.doesNotThrow(
    () => wrapper.delete({}, {}, next),
    'additional check'
  )

  t.end()
})

test('apiWrapper.readOne()', (t) => {
  t.plan(4)

  const wrapper = getMinimalWrapper()

  wrapper.apiFind = (id) => {
    t.pass('it calls apiFind()')
    t.equal(id, 123, 'passes parsed req.id')
    return Promise.resolve({data: {field: 'serialized data'}})
  }

  const next = () => t.fail('next() should not be called')
  const req = { id: 123 }
  const res = {
    json (serialized) {
      t.deepEqual(serialized, {data: {field: 'serialized data'}}, 'calls json')
      t.end()
    }
  }

  t.doesNotThrow(
    () => wrapper.readOne(req, res, next),
    'additional check'
  )
})

test('apiWrapper.readMany() default', (t) => {
  t.plan(4)

  const wrapper = getMinimalWrapper()

  wrapper.apiFetchMany = (options) => {
    t.pass('it calls apiFetchMany()')

    t.deepEqual(
      options,
      {},
      'by default client will get data w/o related data'
    )

    return Promise.resolve({data: {field: 'serialized data'}})
  }

  const next = () => t.fail('next() should not be called')
  const req = { query: {} }
  const res = {
    json (serialized) {
      t.deepEqual(serialized, {data: {field: 'serialized data'}}, 'calls json')
      t.end()
    }
  }

  t.doesNotThrow(
    () => wrapper.readMany(req, res, next), 'additional check'
  )
})

test('apiWrapper.readMany() with /?includeJoined=true', (t) => {
  t.plan(2)

  const wrapper = getMinimalWrapper()

  wrapper.apiFetchMany = (options) => {
    t.deepEqual(
      options,
      { sideloadJoinedRelations: true },
      'with /?includeJoined=true'
    )
    return Promise.resolve()
  }

  const next = () => t.fail('next() should not be called')
  const req = { query: { includeJoined: 'true' } } // /?includeJoined=true
  const res = { json (serialized) { t.end() } }

  t.doesNotThrow(
    () => wrapper.readMany(req, res, next), 'additional check'
  )
})

/**
 * apiWrapper.connect(router) connects REST api to router
 */
function getRouterMock (t) {
  const model = { name: 'someModelName', schema: { tableName: 'some' } }
  const wrapper = new ApiWrapper({model, deserializer: {}, serializer: {}, registryMock})

  const paths = {
    '/': {},
    '/:id': {}
  }

  const routerMock = {
    param (id, idParamParser) {
      t.equal(id, 'id', 'connects id param parser')
      t.equal((typeof idParamParser), 'function', 'second parameter is middleware')
    },

    route (path) {
      const pathObject = paths[path]
      if (!pathObject) t.fail(`router.route(${path}) has been called`)
      return pathObject
    }
  }

  return { routerMock, wrapper, forMany: paths['/'], forOne: paths['/:id'] }
}

test('apiWrapper.connect(router) connects REST api to router', (t) => {
  t.plan(7)

  const { routerMock, wrapper, forMany, forOne } = getRouterMock(t)

  wrapper.readMany = () => 'readMany'
  wrapper.readOne = () => 'readOne'
  wrapper.create = () => 'create'
  wrapper.update = () => 'update'
  wrapper.delete = () => 'delete'

  forMany.get = (m) => { t.equal(m(), 'readMany', 'get / readMany'); return forMany }
  forMany.post = (m) => { t.equal(m(), 'create', 'post / create'); return forMany }

  forOne.get = (m) => { t.equal(m(), 'readOne', 'get /:id readOne'); return forOne }
  forOne.patch = (m) => { t.equal(m(), 'update', 'patch /:id update'); return forOne }
  forOne.delete = (m) => { t.equal(m(), 'delete', 'delete /:id delete'); return forOne }

  wrapper.connect(routerMock, 'create read update delete')

  wrapper.readMany()
  wrapper.readOne()
  wrapper.create()
  wrapper.update()
  wrapper.delete()

  t.end()
})

test('apiWrapper.connect(router) by default connects only read methods', (t) => {
  t.plan(4)

  const { routerMock, wrapper, forMany, forOne } = getRouterMock(t)

  wrapper.readMany = () => 'readMany'
  wrapper.readOne = () => 'readOne'

  forMany.get = (m) => { t.equal(m(), 'readMany', 'get / readMany'); return forMany }
  forMany.post = (m) => { t.fail('post / create should not be connected'); return forMany }

  forOne.get = (m) => { t.equal(m(), 'readOne', 'get /:id readOne'); return forOne }
  forOne.patch = (m) => { t.fail('patch /:id update should not be connected'); return forOne }
  forOne.delete = (m) => { t.fail('delete /:id delete should not be connected'); return forOne }

  wrapper.connect(routerMock /* no options */)
  wrapper.readMany()
  wrapper.readOne()

  t.end()
})

test('apiWrapper.connect(router) "update" option', (t) => {
  t.plan(3)

  const { routerMock, wrapper, forMany, forOne } = getRouterMock(t)

  wrapper.update = () => 'update'

  forMany.get = (m) => { t.fail('get / readMany should not be connected'); return forMany }
  forMany.post = (m) => { t.fail('post / create should not be connected'); return forMany }

  forOne.get = (m) => { t.fail('get /:id readOne should not be connected'); return forOne }
  forOne.patch = (m) => { t.equal(m(), 'update', 'patch /:id update'); return forOne }
  forOne.delete = (m) => { t.fail('delete /:id delete should not be connected'); return forOne }

  wrapper.connect(routerMock, 'update')
  wrapper.update()

  t.end()
})

test('apiWrapper.connect(router) "create" option', (t) => {
  t.plan(3)

  const { routerMock, wrapper, forMany, forOne } = getRouterMock(t)

  wrapper.create = () => 'create'

  forMany.get = (m) => { t.fail('get / readMany should not be connected'); return forMany }
  forMany.post = (m) => { t.equal(m(), 'create', 'post / create'); return forMany }

  forOne.get = (m) => { t.fail('get /:id readOne should not be connected'); return forOne }
  forOne.patch = (m) => { t.fail('patch /:id update should not be connected'); return forOne }
  forOne.delete = (m) => { t.fail('delete /:id delete should not be connected'); return forOne }

  wrapper.connect(routerMock, 'create')
  wrapper.create()

  t.end()
})

test('apiWrapper.connect(router) "delete" option', (t) => {
  t.plan(3)

  const { routerMock, wrapper, forMany, forOne } = getRouterMock(t)

  wrapper.delete = () => 'delete'

  forMany.get = (m) => { t.fail('get / readMany should not be connected'); return forMany }
  forMany.post = (m) => { t.fail('post / create should not be connected'); return forMany }

  forOne.get = (m) => { t.fail('get /:id readOne should not be connected'); return forOne }
  forOne.patch = (m) => { t.fail('patch /:id update should not be connected'); return forOne }
  forOne.delete = (m) => { t.equal(m(), 'delete', 'delete /:id delete'); return forOne }

  wrapper.connect(routerMock, 'delete')
  wrapper.delete()

  t.end()
})

test('apiWrapper.connect(router) binds methods to wrapper', (t) => {
  t.plan(11)

  const { routerMock, wrapper, forMany, forOne } = getRouterMock(t)

  wrapper.readMany = function () { t.equal(this, wrapper, 'readMany.bind(this)'); return 'readMany' }
  wrapper.readOne = function () { t.equal(this, wrapper, 'readOne.bind(this)'); return 'readOne' }
  wrapper.create = function () { t.equal(this, wrapper, 'create.bind(this)'); return 'create' }
  wrapper.update = function () { t.equal(this, wrapper, 'update.bind(this)'); return 'update' }
  wrapper.delete = function () { t.equal(this, wrapper, 'delete.bind(this)'); return 'delete' }

  forMany.get = (m) => { t.equal(m(), 'readMany', 'get / readMany'); return forMany }
  forMany.post = (m) => { t.equal(m(), 'create', 'post / create'); return forMany }

  forOne.get = (m) => { t.equal(m(), 'readOne', 'get /:id readOne'); return forOne }
  forOne.patch = (m) => { t.equal(m(), 'update', 'patch /:id update'); return forOne }
  forOne.delete = (m) => { t.equal(m(), 'delete', 'delete /:id delete'); return forOne }

  wrapper.connect(routerMock, 'read')

  wrapper.readMany()
  wrapper.readOne()
  wrapper.create()
  wrapper.update()
  wrapper.delete()

  t.end()
})

/**
 * Integration testing
 */
const BaseModel = require('../models/base-model')

const dbMock = { exec () { return Promise.resolve() } }

test('I&T apiWrapper.apiCreate()', (t) => {
  t.plan(3)

  class UserModel extends BaseModel {
    create (deserializedNewData) {
      t.deepEqual(
        deserializedNewData,
        {
          name: 'John',
          rights: { id: '12' },
          userGroup: { id: '101' }
        },
      'create(newData) has been called'
      )

      return Promise.resolve({
        id: '1', // sql assigns an ID
        name: 'John',
        rightsId: '12',
        userGroupId: '101'
      })
    }
  }
  const userModel = new UserModel({
    db: dbMock, name: 'user',
    schema: {
      tableName: 'some',
      name: 'string',
      userGroup: { belongsTo: 'userGroup' },
      rights: { belongsTo: 'rights' }
    }
  })

  const apiWrappedUserModel = new ApiWrapper(userModel, registryMock)

  const newData = {
    data: {
      attributes: { name: 'John' },
      relationships: {
        userGroup: { data: { id: '101', type: 'user-groups' } },
        rights: { data: { id: '12', type: 'rights' } }
      },
      type: 'users'
    }
  }

  apiWrappedUserModel.apiCreate(newData)
  .then((savedSerialized) => {
    t.equal(savedSerialized.data.id, '1', 'returns with ID')

    t.deepEqual(
      savedSerialized,
      {
        data: {
          attributes: { name: 'John' },
          id: '1',
          relationships: {
            'user-group': { data: { id: '101', type: 'userGroups' } },
            rights: { data: { id: '12', type: 'rights' } }
          },
          type: 'users'
        }
      },
      'result of integration testing'
    )
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('I&T apiWrapper.apiUpdate()', (t) => {
  t.plan(3)

  class UserModel extends BaseModel {
    update (id, deserializedData) {
      t.pass('update(id, data) has been called')

      t.deepEqual(
        deserializedData,
        {
          id: '1', name: 'John',
          rights: { id: '12' },
          userGroup: { id: '101' }
        },
        'receives deserialized data'
      )

      const sqlResult = {
        id: '1', name: 'John',
        rightsId: '12',
        userGroupId: '101'
      }
      return Promise.resolve(sqlResult)
    }
  }

  const userModel = new UserModel({
    db: dbMock, name: 'user',
    schema: {
      tableName: 'some',
      name: 'string',
      userGroup: { belongsTo: 'userGroup' },
      rights: { belongsTo: 'rights' }
    }
  })

  const apiWrappedUserModel = new ApiWrapper(userModel, registryMock)

  const updatesData = {
    data: {
      attributes: { name: 'John' },
      id: '1',
      relationships: {
        'user-group': { data: { id: '101', type: 'user-groups' } },
        rights: { data: { id: '12', type: 'rights' } }
      },
      type: 'users'
    }
  }

  apiWrappedUserModel.apiUpdate(1, updatesData)
  .then((updatedSerialized) => {
    t.deepEqual(
      updatedSerialized,
      {
        data: {
          attributes: { name: 'John' },
          id: '1',
          relationships: {
            'user-group': { data: { id: '101', type: 'userGroups' } },
            rights: { data: { id: '12', type: 'rights' } }
          },
          type: 'users'
        }
      },
      'returns updated serialized row without relations included'
    )
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('I&T apiWrapper.apiFind()', (t) => {
  t.plan(1)

  class UserModel extends BaseModel {
    selectOne (options) {
      const rows = {
        1: {id: '1', name: 'John', userGroupId: '101', rightsId: '12'},
        2: {id: '2', name: 'Smith', userGroupId: '102', rightsId: '13'}
      }
      return Promise.resolve(rows[options.id])
    }
  }

  const userModel = new UserModel({
    db: dbMock, name: 'user',
    schema: {
      tableName: 'some',
      name: 'string',
      group: { belongsTo: 'userGroup' },
      rights: { belongsTo: 'rights' }
    }
  })

  const apiWrappedUserModel = new ApiWrapper(userModel, registryMock)

  apiWrappedUserModel.apiFind(1)
  .then((serialized) => {
    t.deepEqual(
      serialized,
      {
        data: {
          attributes: { name: 'John' },
          id: '1',
          relationships: {
            group: { data: { id: '101', type: 'groups' } },
            rights: { data: { id: '12', type: 'rights' } }
          },
          type: 'users'
        }
      },
      'returns serialized row without relations included'
    )
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('I&T apiWrapper.apiFetchMany({sideloadJoinedRelations: true})', (t) => {
  t.plan(1)

  class RightsModel extends BaseModel {
    selectMany () {
      return Promise.resolve([
        {id: '12', fullName: 'Full'},
        {id: '13', fullName: 'Part'}
      ])
    }
  }
  const rightsModel = new RightsModel({
    db: dbMock, name: 'rights',
    schema: {
      tableName: 'rights',
      fullName: 'string'
    }
  })

  class UserGroupModel extends BaseModel {
    selectMany () {
      return Promise.resolve([
        {id: '101', shortName: 'Admins'},
        {id: '102', shortName: 'Users'}
      ])
    }
  }
  const userGroupModel = new UserGroupModel({
    db: dbMock, name: 'userGroup',
    schema: {
      id: 'GrpID',
      tableName: 'sPepTree',
      shortName: 'string'
    }
  })

  class DivisionModel extends BaseModel {
    selectMany () {
      return Promise.resolve([
        { id: '23', name: 'Kitchen', hide: false, userId: '1' },
        { id: '24', name: 'Sad', hide: false, userId: '1' },
        { id: '25', name: 'Mangal', hide: false, userId: '2' },
        { id: '26', name: 'Tandyr', hide: false, userId: '2' }
      ])
    }
  }
  const divisionModel = new DivisionModel({
    db: dbMock, name: 'userGroup',
    schema: {
      id: 'DivID',
      tableName: 'sDivisions',
      name: 'string',
      hide: 'boolean',
      staff: { belongsTo: 'user' }
    }
  })

  class ClientModel extends BaseModel {
    selectMany () {
      return Promise.resolve([
        { id: '101', name: 'John', cardcode: '123', hide: false, userId: '1' },
        { id: '102', name: 'Simona', cardcode: '455', hide: false, userId: '1' },
        { id: '103', name: 'Whatson', cardcode: '', hide: false, userId: '2' },
        { id: '104', name: 'Vaschev', cardcode: '9022', hide: false, userId: '2' }
      ])
    }
  }
  const clientModel = new ClientModel({
    db: dbMock, name: 'userGroup',
    schema: {
      id: 'CliID',
      tableName: 'sClients',
      name: 'string',
      cardcode: 'string',
      hide: 'boolean',
      manager: { belongsTo: 'user' }
    }
  })

  // divisionModel.attributesSerialize = ['name', 'hide'] // , 'staff']
  // clientModel.attributesSerialize = ['name', 'cardcode', 'hide'] // , 'manager']

  const registryMock = {
    model (modelName) {
      const _models = {
        rights: rightsModel,
        userGroup: userGroupModel,
        division: divisionModel,
        client: clientModel
      }

      return _models[modelName]
    }
  }

  class UserModel extends BaseModel {
    selectMany () {
      return Promise.resolve([
        {id: '1', name: 'John', userGroupId: '101', rightsId: '12'},
        {id: '2', name: 'Smith', userGroupId: '102', rightsId: '13'}
      ])
    }
  }
  const userModel = new UserModel({
    db: dbMock, registry: registryMock, name: 'user',
    schema: {
      tableName: 'some',
      name: 'string',
      group: { belongsTo: 'userGroup' },
      rights: { belongsTo: 'rights' },
      divisions: { hasMany: 'division', fkField: 'UserID' },
      clients: { hasMany: 'client', fkField: 'UserID' }
    }
  })

  const apiWrappedUserModel = new ApiWrapper(userModel, registryMock)

  apiWrappedUserModel.apiFetchMany({sideloadJoinedRelations: true})
  .then((serialized) => {
    t.deepEqual(
      serialized,
      {
        data: [{
          attributes: { name: 'John' },
          id: '1',
          relationships: {
            group: { data: { id: '101', type: 'groups' } },
            rights: { data: { id: '12', type: 'rights' } },
            clients: { data: [ { id: '101', type: 'clients' }, { id: '102', type: 'clients' } ] },
            divisions: { data: [ { id: '23', type: 'divisions' }, { id: '24', type: 'divisions' } ] }
          },
          type: 'users'
        }, {
          attributes: { name: 'Smith' },
          id: '2',
          relationships: {
            group: { data: { id: '102', type: 'groups' } },
            rights: { data: { id: '13', type: 'rights' } },
            clients: { data: [ { id: '103', type: 'clients' }, { id: '104', type: 'clients' } ] },
            divisions: { data: [ { id: '25', type: 'divisions' }, { id: '26', type: 'divisions' } ] }
          },
          type: 'users'
        }],
        included: [{
          attributes: { 'short-name': 'Admins' },
          id: '101', type: 'groups'
        }, {
          attributes: { 'full-name': 'Full' },
          id: '12', type: 'rights'
        }, {
          // attributes: { hide: false, name: 'Kitchen', staff: { id: '1' } },
          attributes: { hide: false, name: 'Kitchen' },
          id: '23', type: 'divisions'
        }, {
          // attributes: { hide: false, name: 'Sad', staff: { id: '1' } },
          attributes: { hide: false, name: 'Sad' },
          id: '24', type: 'divisions'
        }, {
          // attributes: { cardcode: '123', hide: false, manager: { id: '1' }, name: 'John' },
          attributes: { cardcode: '123', hide: false, name: 'John' },
          id: '101', type: 'clients'
        }, {
          // attributes: { cardcode: '455', hide: false, manager: { id: '1' }, name: 'Simona' },
          attributes: { cardcode: '455', hide: false, name: 'Simona' },
          id: '102', type: 'clients'
        }, {
          attributes: { 'short-name': 'Users' },
          id: '102', type: 'groups'
        }, {
          attributes: { 'full-name': 'Part' },
          id: '13', type: 'rights'
        }, {
          // attributes: { hide: false, name: 'Mangal', staff: { id: '2' } },
          attributes: { hide: false, name: 'Mangal' },
          id: '25', type: 'divisions'
        }, {
          // attributes: { hide: false, name: 'Tandyr', staff: { id: '2' } },
          attributes: { hide: false, name: 'Tandyr' },
          id: '26', type: 'divisions'
        }, {
          // attributes: { cardcode: '', hide: false, manager: { id: '2' }, name: 'Whatson' },
          attributes: { cardcode: '', hide: false, name: 'Whatson' },
          id: '103', type: 'clients'
        }, {
          // attributes: { cardcode: '9022', hide: false, manager: { id: '2' }, name: 'Vaschev' },
          attributes: { cardcode: '9022', hide: false, name: 'Vaschev' },
          id: '104', type: 'clients'
        }]
      },
      'returns serialized rows with relations data included'
    )
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('I&T apiWrapper.apiFetchMany() with options for relations', (t) => {
  t.plan(4)

  class RightsModel extends BaseModel {}
  const rightsModel = new RightsModel({
    db: dbMock, name: 'rights',
    schema: {
      tableName: 'rights',
      fullName: 'string'
    }
  })

  class UserGroupModel extends BaseModel {}
  const userGroupModel = new UserGroupModel({
    db: dbMock, name: 'userGroup',
    schema: {
      id: 'GrpID',
      tableName: 'sPepTree',
      shortName: 'string'
    }
  })

  class DivisionModel extends BaseModel {
    selectMany (opts) {
      t.equal(opts.fieldsOnly, 'idAndRelations', 'it needs only hasMany IDs')

      t.deepEqual(
        opts,
        {
          fieldsOnly: 'idAndRelations',

          where: { hide: false }, // passes relation's model constraints

          whereIn: {
            parentIdFieldName: 'id',
            parentTableName: 'some',
            relationFkName: 'UserID',

            parentWhere: { hide: false } // passes parent's 'where'
          }
        },
        'passes relations` constraints'
      )

      return Promise.resolve([
        { id: '23', userId: '1' },
        { id: '24', userId: '1' },
        { id: '25', userId: '2' },
        { id: '26', userId: '2' }
      ])
    }
  }
  const divisionModel = new DivisionModel({
    db: dbMock, name: 'userGroup',
    schema: {
      id: 'DivID',
      tableName: 'sDivisions',
      name: 'string',
      hide: 'boolean',
      staff: { belongsTo: 'user' }
    }
  })

  class ClientModel extends BaseModel {
    selectMany (opts) {
      t.equal(opts.fieldsOnly, 'idAndRelations', 'it needs only hasMany IDs')
      return Promise.resolve([
        { id: '101', userId: '1' },
        { id: '102', userId: '1' },
        { id: '103', userId: '2' },
        { id: '104', userId: '2' }
      ])
    }
  }
  const clientModel = new ClientModel({
    db: dbMock, name: 'userGroup',
    schema: {
      id: 'CliID',
      tableName: 'sClients',
      name: 'string',
      cardcode: 'string',
      hide: 'boolean',
      manager: { belongsTo: 'user' }
    }
  })

  const registryMock = {
    model (modelName) {
      const _models = {
        rights: rightsModel,
        userGroup: userGroupModel,
        division: divisionModel,
        client: clientModel
      }

      return _models[modelName]
    }
  }

  class UserModel extends BaseModel {
    selectMany () {
      return Promise.resolve([
        {id: '1', name: 'John', userGroupId: '101', rightsId: '12'},
        {id: '2', name: 'Smith', userGroupId: '102', rightsId: '13'}
      ])
    }
  }
  const userModel = new UserModel({
    db: dbMock, registry: registryMock, name: 'user',
    schema: {
      tableName: 'some',
      name: 'string',
      group: { belongsTo: 'userGroup' },
      rights: { belongsTo: 'rights' },
      divisions: { hasMany: 'division', fkField: 'UserID' },
      clients: { hasMany: 'client', fkField: 'UserID' }
    }
  })

  const apiWrappedUserModel = new ApiWrapper(userModel, registryMock)

  const options = {
    sideloadJoinedRelations: false,

    fieldsOnly: ['id', 'name', 'group', 'rights'],
    where: {hide: false},
    orderBy: 'name',

    relationsOptions: {
      division: {
        where: {hide: false}
      }
    }
  }

  apiWrappedUserModel.apiFetchMany(options)
  .then((serialized) => {
    t.deepEqual(
      serialized,
      {
        data: [{
          attributes: { name: 'John' },
          id: '1',
          relationships: {
            group: { data: { id: '101', type: 'groups' } },
            rights: { data: { id: '12', type: 'rights' } },
            clients: { data: [ { id: '101', type: 'clients' }, { id: '102', type: 'clients' } ] },
            divisions: { data: [ { id: '23', type: 'divisions' }, { id: '24', type: 'divisions' } ] }
          },
          type: 'users'
        }, {
          attributes: { name: 'Smith' },
          id: '2',
          relationships: {
            group: { data: { id: '102', type: 'groups' } },
            rights: { data: { id: '13', type: 'rights' } },
            clients: { data: [ { id: '103', type: 'clients' }, { id: '104', type: 'clients' } ] },
            divisions: { data: [ { id: '25', type: 'divisions' }, { id: '26', type: 'divisions' } ] }
          },
          type: 'users'
        }]
      },
      'returns serialized rows without relations included'
    )
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})
