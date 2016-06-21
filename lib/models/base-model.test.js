'use strict'
const test = require('tape')

const BaseModel = require('./base-model')

const dbMock = { exec () { return Promise.resolve() } }

class SomeModel extends BaseModel {}

test('BaseModel is abstract class', (t) => {
  t.throws(
    () => new BaseModel({db: dbMock, name: 'name', schema: {}}),
    /is abstract class/
  )

  t.doesNotThrow(
    () => new SomeModel({db: dbMock, name: 'name', schema: {}}),
    /is abstract class/
  )

  t.end()
})

test('BaseModel constructor requires parameters', (t) => {
  t.throws(
    () => new SomeModel({}),
    /database is undefined/,
    'throws when no "database" provided'
  )

  t.throws(
    () => new SomeModel({db: dbMock}),
    /name is undefined/,
    'throws when no "name" provided'
  )

  t.throws(
    () => new SomeModel({db: dbMock, name: 'model-name'}),
    /schema is not provided/,
    'throws when no "schema" provided'
  )

  t.throws(
    () => new SomeModel({db: dbMock, name: 'name', schema: 'any non object'}),
    /schema attribute should be an object/,
    'throws if "schema" is not an object'
  )

  t.end()
})

test('baseModel.attributesSerialize', (t) => {
  class CustomModel extends BaseModel {}
  const model = new CustomModel({db: dbMock, name: 'user', schema: {
    tableName: 'sPersonal',
    id: 'PersID',

    enabled: 'boolean',
    hide: 'boolean',
    counter: 'integer',

    group: {
      belongsTo: 'userGroup'
    },
    rights: {
      belongsTo: 'rights'
    },

    divisions: {
      hasMany: 'division',
      fkField: 'UserID'
    },
    clients: {
      hasMany: 'client',
      fkField: 'UsrID'
    }
  }})

  t.deepEqual(
    model.attributesSerialize,
    [
      'enabled', 'hide', 'counter',
      'group', 'rights',
      'divisions', 'clients'
    ],
    'returns data fields` names including all relations'
  )

  t.end()
})

test('baseModel.asRelationAttributesSerialize', (t) => {
  class CustomModel extends BaseModel {}
  const model = new CustomModel({db: dbMock, name: 'user', schema: {
    tableName: 'sPersonal',
    id: 'PersID',

    enabled: 'boolean',
    hide: 'boolean',
    counter: 'integer',

    group: {
      belongsTo: 'userGroup'
    },
    rights: {
      belongsTo: 'rights'
    },

    divisions: {
      hasMany: 'division',
      fkField: 'UserID'
    },
    clients: {
      hasMany: 'client',
      fkField: 'UsrID'
    }
  }})

  t.deepEqual(
    model.asRelationAttributesSerialize,
    [
      'enabled', 'hide', 'counter'
    ],
    'returns only data fields` names'
  )

  t.end()
})

/**
 * selectMany(options)
 */
test('BaseModel#selectMany calls db.exec() and returns cast types', (t) => {
  t.plan(4)

  const db = {
    exec (sql) {
      t.pass('db.exec() called')
      t.equal(sql, 'SELECT id, enabled, disabled, counter FROM some')
      return Promise.resolve([{
        enabled: '0',
        disabled: '1',
        counter: '123'
      }])
    }
  }

  class ModelForAll extends BaseModel {}
  const model = new ModelForAll({db, name: 'name', schema: {
    tableName: 'some',
    enabled: 'boolean',
    disabled: 'boolean',
    counter: 'integer'
  }})

  model.selectMany()
  .then((castData) => {
    t.pass('returns a Promise')
    t.deepEqual(castData, [{
      enabled: false,
      disabled: true,
      counter: 123
    }])
  })
  .catch((e) => t.fail(`should not be called ${e}`))
  .then(() => t.end())
})

test('BaseModel#selectMany(options) accepts `options` for sqlBuilder.selectMany()', (t) => {
  t.plan(3)

  const db = {
    exec (sql) {
      t.pass('db.exec() called')
      t.equal(
        sql,
        'SELECT id, name, hide, counter FROM sPersonal WHERE hide=false ORDER BY name',
        'sql query with regards to `options`'
      )
      return Promise.resolve([])
    }
  }

  class User extends BaseModel {}
  const model = new User({db, name: 'user', schema: {
    tableName: 'sPersonal',
    name: 'string',
    hide: 'boolean',
    counter: 'integer'
  }})

  model.selectMany({where: {hide: false}, orderBy: 'name'})
  .then(() => t.pass('returns a Promise'))
  .catch((e) => t.fail(`should not be called ${e}`))
  .then(() => t.end())
})

/**
 * selectOne(options)
 */
test('BaseModel#selectOne(options) accepts `options` for sqlBuilder.selectOne()', (t) => {
  t.plan(5)

  const db = {
    exec (sql) {
      t.pass('db.exec() called')
      t.equal(
        sql,
        'SELECT id, enabled FROM some WHERE id=1',
        'passes `options` to the underlying sqlBuilder'
      )
      return Promise.resolve([{
        enabled: '0',
        disabled: '1',
        counter: '123'
      }])
    }
  }

  class ModelForGet extends BaseModel {}
  const model = new ModelForGet({db, name: 'name', schema: {
    tableName: 'some',
    enabled: 'boolean',
    disabled: 'boolean',
    counter: 'integer'
  }})

  t.throws(() => model.selectOne(/* no id */), /either `id` or `data` option should be provided/)

  model.selectOne({id: 1, fieldsOnly: ['id', 'enabled']})
  .then((castData) => {
    t.pass('returns a Promise')
    t.deepEqual(
      castData,
      {
        enabled: false,
        disabled: true,
        counter: 123
      },
      'returns one row with cast-type values'
    )
  })
  .catch((e) => t.fail(`should not be called ${e}`))
  .then(() => t.end())
})

test('BaseModel#selectOne rejects with error if db returns no rows', (t) => {
  t.plan(3)

  const db = {
    exec () {
      t.pass('db.exec call')
      return Promise.resolve([/* no rows */])
    }
  }

  class ModelForGet extends BaseModel {}
  const model = new ModelForGet({db, name: 'name', schema: {tableName: 'some'}})
  model.selectOne({id: 1})
  .then(() => t.fail('should not be called'))
  .catch((e) => {
    t.pass('catch db error')
    t.assert(/db returned no data/.test(e.message), 'assert error message')
    t.end()
  })
})

/**
 * update(id, data)
 */
test('BaseModel#update throws error if no "id" or "data" provided', (t) => {
  class ModelForUpdate extends BaseModel {}
  const model = new ModelForUpdate({db: dbMock, name: 'name', schema: {}})
  t.throws(() => model.update(/* no id */), /no id has been provided/)
  t.throws(() => model.update(1 /* no data */), /no data has been provided/)
  t.end()
})

test('BaseModel#update rejects with error if no row with "id" exists', (t) => {
  t.plan(3)

  const db = {
    sqlQueryCounter: 0,
    exec (sql) {
      if (this.sqlQueryCounter === 0) {
        t.equal(
          sql,
          'SELECT id, name, hide, GrpID as userGroupId FROM some WHERE id=1',
          '"get previous data" query'
        )
        this.sqlQueryCounter += 1
        return Promise.resolve([/* no row with id has been found */])
      } else if (this.sqlQueryCounter === 1) {
        t.fail('if row with "id" not found it should not call update')
        this.sqlQueryCounter += 1
        return Promise.resolve()
      } else {
        t.fail('more db.exec() calls')
      }
    }
  }

  class ModelForUpdate extends BaseModel {}
  const model = new ModelForUpdate({db, name: 'name', schema: {
    tableName: 'some',
    name: 'string',
    hide: 'false',
    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    }
  }})

  model.update(1, {name: 'new', hide: false, group: 23})
  .catch((e) => {
    t.pass('catch error')
    t.assert(/row with id: 1 does not exist/.test(e.message), 'assert error message')
    t.end()
  })
})

test('BaseModel#update calls db.exec, calls selectOne(), and returns a result from it', (t) => {
  t.plan(6)

  const db = {
    sqlQueryCounter: 0,
    exec (sql) {
      if (this.sqlQueryCounter === 0) {
        t.equal(
          sql,
          'SELECT id, enabled, disabled, counter FROM some WHERE id=12',
          '"get previous data" query'
        )
        this.sqlQueryCounter += 1
        return Promise.resolve([{some: 'data exists'}])
      } else if (this.sqlQueryCounter === 1) {
        t.equal(sql, 'UPDATE some SET counter=0 WHERE id=12', 'sends sql-query to db layer')
        this.sqlQueryCounter += 1
        return Promise.resolve() // successful update
      } else {
        t.fail('more db.exec() calls')
      }
    }
  }

  class ModelForFullUpdate extends BaseModel {}
  const model = new ModelForFullUpdate({db, name: 'name', schema: {
    tableName: 'some',
    enabled: 'boolean',
    disabled: 'boolean',
    counter: 'integer'
  }})

  // mock
  model.selectOne = function selectOne (options) {
    t.pass('selectOne() has been called')
    t.equal(options.id, 12)
    return Promise.resolve([{
      enabled: false,
      disabled: true,
      counter: 0
    }])
  }

  model.update(12, {counter: 0})
  .then((castData) => {
    t.pass('returns a Promise')
    t.deepEqual(castData, [{
      enabled: false,
      disabled: true,
      counter: 0
    }])
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

/**
 * create(data, schemaMixin)
 */
test('BaseModel#create calls db.exec and returns saved model with cast types', (t) => {
  t.plan(4)

  const db = {
    sqlQueryCounter: 0,
    exec (sql) {
      if (this.sqlQueryCounter === 0) {
        t.equal(
          sql,
          'INSERT INTO some (enabled, disabled, counter) VALUES (false, true, 0)',
          'sends sql-query to db layer'
        )
        this.sqlQueryCounter += 1
        return Promise.resolve(/* OK */)
      } else if (this.sqlQueryCounter === 1) {
        t.equal(
          sql,
          'SELECT id, enabled, disabled, counter FROM some WHERE enabled=false' +
          ' AND disabled=true AND counter=0',
          'sends sql-query to db layer'
        )
        this.sqlQueryCounter += 1
        return Promise.resolve([{
          id: '1', // db-layer generates ID
          enabled: '0',
          disabled: '1',
          counter: '123'
        }])
      } else {
        t.fail('more db.exec() calls')
      }
    }
  }

  class ModelForFullCreate extends BaseModel {}
  const model = new ModelForFullCreate({db, name: 'name', schema: {
    tableName: 'some',
    enabled: 'boolean',
    disabled: 'boolean',
    counter: 'integer'
  }})

  model.create({
    enabled: false,
    disabled: true,
    counter: 0
  })
  .then((castData) => {
    t.pass('returns a Promise')
    t.deepEqual(castData, {
      id: '1',
      enabled: false,
      disabled: true,
      counter: 123
    })
  })
  .catch((e) => t.fail(`should not be called ${e}`))
  .then(() => t.end())
})

test('baseModel.create(data, schemaMixin) allows local schema extending', (t) => {
  t.plan(3)

  const db = {
    exec (sql) {
      return Promise.resolve([{
        id: '1',
        name: 'new name'

        /* selectOne() does not return these fields because they are private
        parentid: '1',
        enabled: '0',
        hide: '1'
        */
      }])
    }
  }

  class SomeModel extends BaseModel {}
  const model = new SomeModel({db, name: 'someModel', schema: {
    tableName: 'someTable',
    name: 'string'
  }})

  // mocks
  model.sqlBuilder = {
    create (data, schemaMixin) {
      t.deepEqual(
        schemaMixin,
        { parentid: 'integer', enabled: 'boolean', hide: 'boolean' },
        'passes schemaMixin to sqlBuilder.create()'
      )
      return Promise.resolve('sql query')
    },
    selectOne ({data}) {
      t.pass('selectOne() does not get schemaMixin so it returns only public schema`s fields')
      return Promise.resolve('sql query')
    }
  }

  const externalData = {
    name: 'new name'
  }

  // the field we don't want to be accessed from the outside
  const someSchemaMixin = { parentid: 'integer', enabled: 'boolean', hide: 'boolean' }
  externalData.parentid = 1

  model.create(externalData, someSchemaMixin)
  .then((castData) => {
    t.deepEqual(
      castData,
      {
        // main schema fields
        id: '1', name: 'new name'
        // schemaMixin fields are not returned because they are private
        // parentid: 1, enabled: false, hide: true
      },
      'at the end create() returns only public schema`s fields'
    )
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('baseModel.validateBeforeUpdate()', (t) => {
  t.plan(5)

  const prevUncastData = {hide: '0', counter: '123'}
  const prevCastData = {hide: false, counter: 123}
  const newData = {hide: true, counter: 455}

  class SomeModel extends BaseModel {}

  const db = { exec () { return Promise.resolve([prevUncastData]) } } // prev '0'/false
  const model = new SomeModel({db, name: 'name', schema: {
    tableName: 'some',
    hide: 'boolean',
    counter: 'integer'
  }})

  // mocks
  model.sqlBuilder = {
    selectOne () { return 'sql query' },
    update () { return 'sql query' }
  }
  model.selectOne = (options) => Promise.resolve(newData)

  model.validateBeforeUpdate = (id, newData, prevData) => {
    t.pass('update() calls validateBeforeUpdate()')

    t.equal(id, 12, 'passes id', 'update() passes id')
    t.deepEqual(newData, newData, 'update() passes new data')
    t.deepEqual(prevData, prevCastData, 'update() passes type-casted previous data')

    return true // OK
  }

  model.update(12, newData) // new 'true'
  .then((castData) => {
    t.deepEqual(castData, { hide: true, counter: 455 })
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('baseModel.validateBeforeUpdate() update() rejects if validation throws', (t) => {
  t.plan(3)

  class SomeModel extends BaseModel {}

  const db = { exec () { return Promise.resolve([{some: 'data'}]) } }
  const model = new SomeModel({db, name: 'name', schema: { tableName: 'some' }})

  // mocks
  model.sqlBuilder = {
    selectOne () {
      t.pass('selectOne() is used to retrieve previous data')
      return 'sql query'
    },
    update () { t.fail('sqlBuilder.update() should not be called') }
  }
  model.selectOne = (options) => t.fail('selectOne() should not be called')

  model.validateBeforeUpdate = (id, newData, prevData) => {
    t.pass('validateBeforeUpdate() is called')
    throw new Error('some validation error')
  }

  model.update(12, {name: 'new name'})
  .then((castData) => t.fail('result should not be OK'))
  .catch((e) => {
    t.equal(e.message, 'some validation error', 'it returns validation error')
  })
  .then(() => t.end())
})

test('baseModel.validateBeforeCreate()', (t) => {
  t.plan(4)

  class SomeModel extends BaseModel {}

  const db = {
    exec () { return Promise.resolve([{name: 'new name', privateField: 'private data'}]) }
  }

  const model = new SomeModel({db, name: 'name', schema: {
    tableName: 'some',
    name: 'string'
  }})

  // mocks
  model.sqlBuilder = {
    create () { return 'sql query' },
    selectOne () { return 'sql query' }
  }

  model.validateBeforeCreate = (data, schemaMixin) => {
    t.pass('create() calls validateBeforeCreate()')

    t.deepEqual(data, {name: 'new name', privateField: 'private data'})
    t.deepEqual(schemaMixin, {privateField: 'string'})

    return true // OK
  }

  model.create({name: 'new name', privateField: 'private data'}, {privateField: 'string'})
  .then((castData) => {
    t.deepEqual(castData, {name: 'new name', privateField: 'private data'})
  })
  .catch((e) => t.fail(e))
  .then(() => t.end())
})

test('baseModel.validateBeforeCreate() create() rejects if validation throws', (t) => {
  t.plan(4)

  class SomeModel extends BaseModel {}

  const db = {
    exec () { return Promise.resolve([{name: 'new name', privateField: 'private data'}]) }
  }

  const model = new SomeModel({db, name: 'name', schema: {
    tableName: 'some',
    name: 'string'
  }})

  // mocks
  model.sqlBuilder = {
    create () { t.fail('create() should not be called') },
    selectOne () { t.fail('selectOne() should not be called') }
  }

  model.validateBeforeCreate = (data, schemaMixin) => {
    t.pass('create() calls validateBeforeCreate()')

    t.deepEqual(data, {name: 'new name', privateField: 'private data'})
    t.deepEqual(schemaMixin, {privateField: 'string'})

    throw new Error('some validation error')
  }

  model.create({name: 'new name', privateField: 'private data'}, {privateField: 'string'})
  .then((castData) => t.fail('result should not be OK'))
  .catch((e) => t.equal(e.message, 'some validation error'))
  .then(() => t.end())
})
