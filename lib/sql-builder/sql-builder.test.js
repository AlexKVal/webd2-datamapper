'use strict'
const test = require('tape')

const SqlBuilder = require('./sql-builder')

test('sqlBuilder.columns holds only columns` schemaObject', (t) => {
  const sqlBuilder = new SqlBuilder({
    name: 'string',
    hide: 'boolean',
    group: {
      belongsTo: 'userGroup'
    }
  })

  t.equal(Object.keys(sqlBuilder.columns).length, 2)
  t.equal(sqlBuilder.columns.name, 'string')
  t.equal(sqlBuilder.columns.hide, 'boolean')
  t.end()
})

test('sqlBuilder.columnsNames holds columns` names', (t) => {
  const sqlBuilder = new SqlBuilder({
    name: 'string',
    hide: 'boolean',
    group: {
      belongsTo: 'userGroup'
    }
  })

  t.equal(sqlBuilder.columnsNames.length, 2)
  t.equal(sqlBuilder.columnsNames[0], 'name')
  t.equal(sqlBuilder.columnsNames[1], 'hide')
  t.end()
})

test('sqlBuilder.generateFieldEqualsDataLines() with full data', (t) => {
  const sqlBuilder = new SqlBuilder({
    hide: 'boolean',
    someNumber: 'integer',
    name: 'string',
    quotedString: 'string',
    shouldBeString: 'string',
    shouldBeString2: 'string',

    userGroup: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    }
  })

  const fullData = {
    hide: false,
    someNumber: 33,
    name: 'some name',
    quotedString: 'input with \'quotes\'',
    shouldBeString: 123,
    shouldBeString2: false,

    userGroup: {id: '13'},
    rights: {id: '101'}
  }

  const lines = sqlBuilder.generateFieldEqualsDataLines(fullData)
  t.equal(lines[0], 'hide=false', 'boolean values')
  t.equal(lines[1], 'someNumber=33', 'integer values')
  t.equal(lines[2], "name='some name'", 'quotes strings')
  t.equal(lines[3], "quotedString='input with  quotes '", 'strips single quotes off strings')
  t.equal(lines[4], "shouldBeString='123'", 'quotes as string other data types')
  t.equal(lines[5], "shouldBeString2='false'", 'quotes as string other data types')

  t.equal(lines[6], 'GrpID=13', 'handles relations too')
  t.equal(lines[7], 'rights=101', 'handles relations too')

  const emptySqlBuilder = new SqlBuilder({})
  const emptyLines = emptySqlBuilder.generateFieldEqualsDataLines(fullData)

  t.ok(Array.isArray(emptyLines))
  t.equal(emptyLines.length, 0, 'empty result with empty schema')

  t.end()
})

test('sqlBuilder.generateFieldEqualsDataLines() with partial data', (t) => {
  const sqlBuilder = new SqlBuilder({
    hide: 'boolean',
    someNumber: 'integer',
    name: 'string',
    quotedString: 'string',
    shouldBeString: 'string',
    shouldBeString2: 'string',

    userGroup: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    }
  })

  const partialData = {
    shouldBeString: 123,
    hide: false,
    rights: {id: '101'},
    quotedString: 'input with \'quotes\''
  }

  const partialDataLines = sqlBuilder.generateFieldEqualsDataLines(partialData)
  t.deepEqual(partialDataLines, [
    'hide=false',
    "quotedString='input with  quotes '",
    "shouldBeString='123'",
    'rights=101'
  ])

  t.end()
})

test('sqlBuilder._generateForeignKeysLines()', (t) => {
  const sqlBuilder = new SqlBuilder({
    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },

    posts: {
      hasMany: 'user-post', fkField: 'UserId'
    },
    divisions: {
      hasMany: 'division', fkField: 'UserId'
    }
  })

  const lines = sqlBuilder._generateForeignKeysLines()
  t.equal(lines.length, 2, 'hasMany have no meaning here')
  t.equal(lines[0], 'GrpID as userGroupId')
  t.equal(lines[1], 'rights as rightsId', 'uses foreign table name if no fkField provided')

  t.deepEqual(
    sqlBuilder._generateForeignKeysLines(['id', 'group']),
    ['GrpID as userGroupId'],
    'is able to filter belongsTo relations too'
  )

  t.deepEqual(
    sqlBuilder._generateForeignKeysLines('rights'),
    ['rights as rightsId'],
    'is OK with a string parameter'
  )

  t.deepEqual(
    sqlBuilder._generateForeignKeysLines('id'),
    [],
    'returns empty if we need only "id" field'
  )

  t.end()
})

test('sqlBuilder.generateSelectFieldsPart()', (t) => {
  const sbDefaultId = new SqlBuilder({
    /* no custom id provided */
    name: 'string'
  })
  t.equal(
    sbDefaultId.generateSelectFieldsPart(),
    'id, name',
    'default `id`'
  )

  const sbCustomId = new SqlBuilder({
    id: 'UserID',
    name: 'string'
  })
  t.equal(
    sbCustomId.generateSelectFieldsPart(),
    'UserID as id, name',
    'custom `id`'
  )

  const sbFieldsOnly = new SqlBuilder({
    id: 'UserID',
    name: 'string',
    hide: 'boolean',
    counter: 'integer',
    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    }
  })

  t.equal(
    sbFieldsOnly.generateSelectFieldsPart(/* w/o fieldsOnly */),
    'UserID as id, name, hide, counter, GrpID as userGroupId',
    'without `fieldsOnly`'
  )

  t.equal(
    sbFieldsOnly.generateSelectFieldsPart(['id', 'hide', 'counter']),
    'UserID as id, hide, counter',
    'with `fieldsOnly` provided'
  )

  t.equal(
    sbFieldsOnly.generateSelectFieldsPart(['hide', 'counter']),
    'hide, counter',
    'with `fieldsOnly` provided. w/o `id`'
  )

  t.equal(
    sbFieldsOnly.generateSelectFieldsPart('hide'),
    'hide',
    'fieldsOnly as a string option'
  )

  t.equal(
    sbFieldsOnly.generateSelectFieldsPart('id'),
    'UserID as id',
    'only `id`'
  )

  t.equal(
    sbFieldsOnly.generateSelectFieldsPart(['id', 'group']),
    'UserID as id, GrpID as userGroupId',
    'filters relations` fields too'
  )

  t.equal(
    sbFieldsOnly.generateSelectFieldsPart('idAndRelations'),
    'UserID as id, GrpID as userGroupId',
    'idAndRelations special case: returns `id` and relations'
  )

  t.equal(
    sbFieldsOnly.generateSelectFieldsPart('group'),
    'GrpID as userGroupId',
    'filters relations` fields too. w/o `id`'
  )

  t.end()
})

test('sqlBuilder.idFieldClause', (t) => {
  const sqlBuilderDefaultId = new SqlBuilder({
    name: 'string'
  })
  t.equal(sqlBuilderDefaultId.idFieldClause, 'id', 'default "id"')

  const sqlBuilderCustomId = new SqlBuilder({
    id: 'UserID',
    name: 'string'
  })
  t.equal(sqlBuilderCustomId.idFieldClause, 'UserID as id', 'custom "id"')

  t.end()
})

test('sqlBuilder.idFieldName', (t) => {
  const sqlBuilderDefaultId = new SqlBuilder({
    name: 'string'
  })
  t.equal(sqlBuilderDefaultId.idFieldName, 'id', 'default "id"')

  const sqlBuilderCustomId = new SqlBuilder({
    id: 'PersID',
    name: 'string'
  })
  t.equal(sqlBuilderCustomId.idFieldName, 'PersID', 'custom "id"')

  t.end()
})

test('sqlBuilder.getTableName() throws if no tableName provided', (t) => {
  const sqlBuilder = new SqlBuilder({
    /* tableName: 'is not provided', */
    name: 'string'
  })

  const fn0 = function () {
    sqlBuilder.getTableName()
  }

  t.throws(fn0, /tableName is not provided/)
  t.end()
})

test('sqlBuilder.getTableName() returns tableName', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'whatever',
    name: 'string'
  })

  t.equal(sqlBuilder.getTableName(), 'whatever')
  t.end()
})

test('sqlBuilder._schema contains all fields but "tableName" and "id"', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'whatever',
    id: 'customId',
    name: 'string',
    boolFlag: 'boolean',
    someNumber: 'integer'
  })

  t.equal(Object.keys(sqlBuilder._schema).length, 3)
  t.deepEqual(sqlBuilder._schema, {
    name: 'string',
    boolFlag: 'boolean',
    someNumber: 'integer'
  })
  t.end()
})

test('sqlBuilder.tableName', (t) => {
  const sqlBuilder1 = new SqlBuilder({ tableName: 'whatever' })
  t.equal(sqlBuilder1.tableName, 'whatever')

  const sqlBuilder2 = new SqlBuilder({})
  t.equal(sqlBuilder2.tableName, undefined)
  t.end()
})

test('sqlBuilder.sqlIsRowExist(id) returns sql query for checking row existence by "id"', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',
    name: 'string',
    rights: { belongsTo: 'rights' }
  })

  t.equal(
    sqlBuilder.sqlIsRowExist(202),
    'SELECT PersID as id FROM sPersonal WHERE PersID=202'
  )
  t.end()
})

test('sqlBuilder._getRelationsLinesForUpdate() with full data', (t) => {
  const sqlBuilder = new SqlBuilder({
    userGroup: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    }
  })

  const data = {
    name: 'some',
    hide: false,
    userGroup: {id: '13'},
    rights: {id: '101'}
  }

  const relationsLines = sqlBuilder._getRelationsLinesForUpdate(data)
  t.deepEqual(relationsLines, [
    'GrpID=13',
    'rights=101'
  ])
  t.end()
})

test('sqlBuilder._getRelationsLinesForUpdate() with partial data', (t) => {
  const sqlBuilder = new SqlBuilder({
    userGroup: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },
    post: {
      belongsTo: 'user-post',
      fkField: 'PostID'
    }
  })

  const data = {
    post: {id: '2'},
    name: 'some',
    userGroup: {id: '13'}
  }

  const relationsLines = sqlBuilder._getRelationsLinesForUpdate(data)
  t.deepEqual(relationsLines, [ 'GrpID=13', 'PostID=2' ])
  t.end()
})

test('sqlBuilder.update(id, data) returns sql query for updating row', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',

    name: 'string',
    hide: 'boolean',
    counter: 'integer',

    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },
    post: {
      belongsTo: 'post',
      fkField: 'PostID'
    }
  })

  const updateData = {
    id: '33',
    name: 'new one',
    hide: false,
    counter: '445',
    group: {id: '12'},
    rights: {id: '101'},
    post: {id: '23'}
  }

  t.equal(
    sqlBuilder.update('33', updateData),
    'UPDATE sPersonal' +
    " SET name='new one', hide=false, counter=445, GrpID=12, rights=101, PostID=23" +
    ' WHERE PersID=33'
  )
  t.end()
})

test('sqlBuilder.update(id, data) can generate sql query with partial data', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',

    name: 'string',
    hide: 'boolean',
    counter: 'integer',

    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },
    post: {
      belongsTo: 'post',
      fkField: 'PostID'
    }
  })

  const partialUpdateData = {
    id: '33',
    hide: false,
    rights: {id: '101'}
  }

  t.equal(
    sqlBuilder.update('33', partialUpdateData),
    'UPDATE sPersonal' +
    ' SET hide=false, rights=101' +
    ' WHERE PersID=33',
    'query for partial update'
  )
  t.end()
})

const quoteValueIfString = SqlBuilder.quoteValueIfString

test('quoteValueIfString() returns as is "boolean" and "integer" types', (t) => {
  t.equal(quoteValueIfString('boolean', false), false)
  t.equal(quoteValueIfString('integer', 3), 3)
  t.end()
})

test('quoteValueIfString() strings are escaped and single-quoted', (t) => {
  t.equal(quoteValueIfString('string', 'some name'), "'some name'")
  t.equal(quoteValueIfString('string', 'input with \'quotes\''), "'input with  quotes '")
  t.end()
})

test('quoteValueIfString() other data types are converted to strings', (t) => {
  t.equal(quoteValueIfString('string', 123), "'123'")
  t.equal(quoteValueIfString('string', false), "'false'")
  t.end()
})

test('quoteValueIfString() treats unknown data as strings', (t) => {
  t.equal(quoteValueIfString(undefined, 123), "'123'")
  t.equal(quoteValueIfString(undefined, false), "'false'")
  t.equal(quoteValueIfString(undefined, 'some string'), "'some string'")
  t.end()
})

test('quoteValueIfString() throws if value is "null" or "undefined"', (t) => {
  const fn0 = function () {
    quoteValueIfString('string', null)
  }

  const fn1 = function () {
    quoteValueIfString('string', undefined)
  }

  t.throws(fn0, /string-type value for SQL query cannot be null/)
  t.throws(fn1, /string-type value for SQL query cannot be undefined/)

  t.end()
})

test('sqlBuilder._fieldsNamesForInsert() only intersection of data and schema fields', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',

    name: 'string',
    hide: 'boolean',
    counter: 'integer',

    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },
    post: {
      belongsTo: 'post',
      fkField: 'PostID'
    }
  })

  const fullData = {
    /* no id because the row is new */
    name: 'new one',
    hide: false,
    counter: '445',
    group: {id: '12'},
    rights: {id: '101'},
    post: {id: '23'}
  }

  t.deepEqual(
    sqlBuilder._fieldsNamesForInsert(fullData),
    ['name', 'hide', 'counter', 'GrpID', 'rights', 'PostID'],
    'full data'
  )

  const partialData = {
    /* no id because the row is new */
    name: 'new one',
    group: {id: '12'},
    post: {id: '23'}
  }

  t.deepEqual(
    sqlBuilder._fieldsNamesForInsert(partialData),
    ['name', 'GrpID', 'PostID'],
    'partial data'
  )

  const extraDataFields = {
    /* no id because the row is new */
    name: 'new one',
    extraField1: 'extra-data',
    hide: false,
    counter: '445',
    group: {id: '12'},
    rights: {id: '101'},
    post: {id: '23'},
    extraField2: 'extra-data'
  }

  t.deepEqual(
    sqlBuilder._fieldsNamesForInsert(extraDataFields),
    ['name', 'hide', 'counter', 'GrpID', 'rights', 'PostID'],
    'extra data fields got cut'
  )

  const privateFields = {
    /* no id because the row is new */
    name: 'new one'
  }

  /* additional data are mixed in on the server */
  /* these fields are not public */
  privateFields.private1 = 'extra-data'
  privateFields.parentid = 1

  /* for those private fields to be written schemaMixin has to be provided */
  const localSchemaMixin = {
    private1: 'string',
    parentid: 'integer'
  }

  t.deepEqual(
    sqlBuilder._fieldsNamesForInsert(privateFields, localSchemaMixin),
    ['name', 'private1', 'parentid'],
    'schemaMixin extends schema and it allows for additional data fields'
  )

  t.end()
})

test('sqlBuilder._fieldsValuesForInsert()', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',

    name: 'string',
    hide: 'boolean',
    counter: 'integer',

    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },
    post: {
      belongsTo: 'post',
      fkField: 'PostID'
    }
  })

  const fullData = {
    /* no id because the row is new */
    name: 'new one',
    hide: false,
    counter: 445,
    group: {id: '12'},
    rights: {id: '101'},
    post: {id: '23'}
  }

  t.deepEqual(
    sqlBuilder._fieldsValuesForInsert(fullData),
    ["'new one'", false, 445, '12', '101', '23'],
    'full data'
  )

  const partialData = {
    /* no id because the row is new */
    name: 'new one',
    group: {id: '12'},
    post: {id: '23'}
  }

  t.deepEqual(
    sqlBuilder._fieldsValuesForInsert(partialData),
    ["'new one'", '12', '23'],
    'partial data'
  )

  const extraDataFields = {
    /* no id because the row is new */
    name: 'new one',
    extraField1: 'extra-data',
    hide: false,
    counter: 445,
    group: {id: '12'},
    rights: {id: '101'},
    post: {id: '23'},
    extraField2: 'extra-data'
  }

  t.deepEqual(
    sqlBuilder._fieldsValuesForInsert(extraDataFields),
    ["'new one'", false, 445, '12', '101', '23'],
    'extra data fields got cut'
  )

  const privateFields = {
    /* no id because the row is new */
    name: 'new one'
  }

  /* additional data are mixed in on the server */
  /* these fields are not public */
  privateFields.private1 = 'extra-data'
  privateFields.parentid = 1

  /* for those private fields to be written schemaMixin has to be provided */
  const localSchemaMixin = {
    private1: 'string',
    parentid: 'integer'
  }

  t.deepEqual(
    sqlBuilder._fieldsValuesForInsert(privateFields, localSchemaMixin),
    ["'new one'", "'extra-data'", 1],
    'schemaMixin extends schema and it allows for additional data fields'
  )

  t.end()
})

test('sqlBuilder.create(data) returns sql query for INSERT-ing new row', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',

    name: 'string',
    hide: 'boolean',
    counter: 'integer',

    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },
    post: {
      belongsTo: 'post',
      fkField: 'PostID'
    }
  })

  const fullData = {
    /* no id because the row is new */
    name: 'new one',
    hide: false,
    counter: '445',
    group: {id: '12'},
    rights: {id: '101'},
    post: {id: '23'}
  }

  t.equal(
    sqlBuilder.create(fullData),
    'INSERT INTO sPersonal' +
    ' (name, hide, counter, GrpID, rights, PostID)' +
    " VALUES ('new one', false, 445, 12, 101, 23)",
    'w/ full data: generates INSERT with all data fields provided'
  )

  const partialData = {
    /* no id because the row is new */
    name: 'new one',
    group: {id: '12'},
    post: {id: '23'}
  }

  t.deepEqual(
    sqlBuilder.create(partialData),
    'INSERT INTO sPersonal' +
    ' (name, GrpID, PostID)' +
    " VALUES ('new one', 12, 23)",
    'w/ partial data: generates INSERT with all data fields provided'
  )

  const extraDataFields = {
    /* no id because the row is new */
    name: 'new one',
    extraField1: 'extra-data',
    hide: false,
    counter: '445',
    group: {id: '12'},
    rights: {id: '101'},
    post: {id: '23'},
    extraField2: 'extra-data'
  }

  t.deepEqual(
    sqlBuilder.create(extraDataFields),
    'INSERT INTO sPersonal' +
    ' (name, hide, counter, GrpID, rights, PostID)' +
    " VALUES ('new one', false, 445, 12, 101, 23)",
    'w/ extra data: generates INSERT with only schema fields provided; extra fields are ignored'
  )

  const privateFields = {
    /* no id because the row is new */
    name: 'new one'
  }

  /* additional data are mixed in on the server */
  /* these fields are not public */
  privateFields.private1 = 'extra-data'
  privateFields.parentid = 1

  /* for those private fields to be written schemaMixin has to be provided */
  const localSchemaMixin = {
    private1: 'string',
    parentid: 'integer'
  }

  t.deepEqual(
    sqlBuilder.create(privateFields, localSchemaMixin),
    'INSERT INTO sPersonal' +
    ' (name, private1, parentid)' +
    " VALUES ('new one', 'extra-data', 1)",
    'schemaMixin extends schema and it allows for additional data fields'
  )

  t.end()
})

test('sqlBuilder._wherePart() generates clauses for WHERE part', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',
    name: 'string',
    hide: 'boolean',
    /* password field is not described in the schema to prevent accidental leaking */
    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    }
  })

  const options = {
    where: {hide: false, password: '123'}
  }

  t.deepEqual(
    sqlBuilder._wherePart(options.where),
    [
      'hide=false',
      "password='123'"
    ]
  )

  t.throws(
    () => sqlBuilder._wherePart({GrpID: undefined}),
    /value of 'GrpID' key is undefined/,
    'throws if any value in constraints is undefined'
  )

  t.end()
})

test('sqlBuilder.selectMany() generates SELECT query for fetching many rows', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',
    name: 'string',
    hide: 'boolean',
    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },
    divisions: {
      hasMany: 'division', fkField: 'UserID'
    }
  })

  t.equal(
    sqlBuilder.selectMany(/* no options */),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal',
    'with empty options'
  )

  t.throws(
    () => sqlBuilder.selectMany({id: '1'}),
    /it is wrong to pass the `id` option to selectMany/
  )

  t.equal(
    sqlBuilder.selectMany({orderBy: 'name DESC'}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    ' ORDER BY name DESC',
    'orderBy with a single string value'
  )

  t.equal(
    sqlBuilder.selectMany({orderBy: 'name, rights DESC'}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    ' ORDER BY name, rights DESC',
    'orderBy with some fields as a string'
  )

  t.equal(
    sqlBuilder.selectMany({orderBy: ['name', 'rights DESC']}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    ' ORDER BY name, rights DESC',
    'orderBy with some fields as an Array'
  )

  t.equal(
    sqlBuilder.selectMany({fieldsOnly: ['name']}),
    'SELECT name' +
    ' FROM sPersonal',
    'fieldsOnly filters out data fields'
  )

  t.equal(
    sqlBuilder.selectMany({fieldsOnly: 'id'}),
    'SELECT PersID as id' +
    ' FROM sPersonal',
    'fieldsOnly: `id` special case'
  )

  t.equal(
    sqlBuilder.selectMany({fieldsOnly: ['id', 'group', 'divisions']}),
    'SELECT PersID as id, GrpID as userGroupId' +
    ' FROM sPersonal',
    'fieldsOnly filters out relations too. hasMany are ignored'
  )

  t.equal(
    sqlBuilder.selectMany({fieldsOnly: 'idAndRelations'}),
    'SELECT PersID as id, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal',
    '`idAndRelations` special case: ID and belongsTo relations'
  )

  t.equal(
    sqlBuilder.selectMany({where: {hide: false}}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    ' WHERE hide=false',
    'where option with one constraint'
  )

  t.equal(
    sqlBuilder.selectMany({where: {hide: false, name: 'Vasya'}}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    " WHERE hide=false AND name='Vasya'",
    'where option with some constraints'
  )

  t.equal(
    sqlBuilder.selectMany({
      fieldsOnly: ['id', 'name', 'group'],
      where: {hide: false, name: 'Vasya'},
      orderBy: 'name DESC'
    }),
    'SELECT PersID as id, name, GrpID as userGroupId' +
    ' FROM sPersonal' +
    " WHERE hide=false AND name='Vasya'" +
    ' ORDER BY name DESC',
    'kinda integration test for options'
  )

  t.end()
})

test('relationModel.sqlBuilder.selectMany({ whereIn }) general part', (t) => {
  const relationModelSqlBuilder = new SqlBuilder({
    tableName: 'some',
    id: 'some',
    name: 'string'
  })

  t.throws(
    () => relationModelSqlBuilder.selectMany({
      whereIn: {
        /* parentTableName: undefined */
      }
    }),
    /parentTableName is undefined/,
    'parentTableName cannot be undefined'
  )

  t.throws(
    () => relationModelSqlBuilder.selectMany({
      whereIn: {
        parentTableName: 'some',

        relationFkName: 'name1',
        parentFkName: 'name2'
      }
    }),
    /ambiguous relationFkName and parentFkName/,
    'relationFkName and parentFkName cannot be used together'
  )

  t.end()
})

test('relationModel.sqlBuilder.selectMany({ whereIn }) belongsTo / many-to-one', (t) => {
  const parent = {
    name: 'user',
    tableName: 'sPersonal',
    relFkName: 'GrpID',
    where: {hide: false}
  }

  const relationModelSqlBuilder = new SqlBuilder({
    tableName: 'sPepTree',
    id: 'GrpID',
    name: 'string',
    hide: 'boolean'
  })

  t.equal(
    relationModelSqlBuilder.selectMany({
      whereIn: {
        parentFkName: parent.relFkName,
        parentTableName: parent.tableName,
        parentWhere: parent.where
      }
    }),
    'SELECT GrpID as id, name, hide' +
    ' FROM sPepTree' +
    ' WHERE id IN (SELECT DISTINCT GrpID FROM sPersonal WHERE hide=false)',
    'if parentFkName => belongsTo / many-to-one'
  )

  t.equal(
    relationModelSqlBuilder.selectMany({
      where: {hide: false},
      whereIn: {
        parentFkName: parent.relFkName,
        parentTableName: parent.tableName,
        parentWhere: parent.where
      }
    }),
    'SELECT GrpID as id, name, hide' +
    ' FROM sPepTree' +
    ' WHERE hide=false AND id IN (SELECT DISTINCT GrpID FROM sPersonal WHERE hide=false)',
    'belongsTo: where and whereIn'
  )

  t.equal(
    relationModelSqlBuilder.selectMany({
      whereIn: {
        parentFkName: parent.relFkName,
        parentTableName: parent.tableName,
        parentWhere: undefined
      }
    }),
    'SELECT GrpID as id, name, hide' +
    ' FROM sPepTree' +
    ' WHERE id IN (SELECT DISTINCT GrpID FROM sPersonal)',
    'the case without parent`s {where} constraints'
  )

  t.end()
})

test('relationModel.sqlBuilder.selectMany({ whereIn }) hasMany / one-to-many', (t) => {
  const parent = {
    name: 'userGroup',
    tableName: 'sPepTree',
    idFieldName: 'GrpID',
    where: {hide: false}
  }

  const relationModelSqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',
    name: 'string',
    cardcode: 'string',
    hide: 'boolean'
  })

  const relationFkName = 'GrpID'

  t.equal(
    relationModelSqlBuilder.selectMany({
      whereIn: {
        relationFkName,
        parentIdFieldName: parent.idFieldName,
        parentTableName: parent.tableName,
        parentWhere: parent.where
      }
    }),
    'SELECT PersID as id, name, cardcode, hide' +
    ' FROM sPersonal' +
    ' WHERE GrpID IN (SELECT GrpID FROM sPepTree WHERE hide=false)',
    'if relationFkName => hasMany / one-to-many'
  )

  t.equal(
    relationModelSqlBuilder.selectMany({
      whereIn: {
        relationFkName,
        parentIdFieldName: parent.idFieldName,
        parentTableName: parent.tableName
      }
    }),
    'SELECT PersID as id, name, cardcode, hide' +
    ' FROM sPersonal' +
    ' WHERE GrpID IN (SELECT GrpID FROM sPepTree)',
    'the case without parent`s {where} constraints'
  )

  t.equal(
    relationModelSqlBuilder.selectMany({
      where: {hide: false}, orderBy: 'name',
      whereIn: {
        relationFkName,
        parentIdFieldName: parent.idFieldName,
        parentTableName: parent.tableName,
        parentWhere: parent.where
      }
    }),
    'SELECT PersID as id, name, cardcode, hide' +
    ' FROM sPersonal' +
    ' WHERE hide=false AND GrpID IN (SELECT GrpID FROM sPepTree WHERE hide=false)' +
    ' ORDER BY name',
    'the case with where and whereIn'
  )

  t.throws(
    () => relationModelSqlBuilder.selectMany({
      whereIn: {
        parentTableName: 'some',

        relationFkName: 'name1'
        /* parentIdFieldName: undefined */
      }
    }),
    /parentIdFieldName is undefined/,
    'with relationFkName parentIdFieldName should be defined'
  )

  t.end()
})

test('sqlBuilder.selectOne() generates SELECT query for fetching one row', (t) => {
  const sqlBuilder = new SqlBuilder({
    tableName: 'sPersonal',
    id: 'PersID',
    name: 'string',
    hide: 'boolean',
    group: {
      belongsTo: 'userGroup',
      fkField: 'GrpID'
    },
    rights: {
      belongsTo: 'rights'
    },
    divisions: {
      hasMany: 'division', fkField: 'UserID'
    }
  })

  t.throws(
    () => sqlBuilder.selectOne(/* no options at all */),
    /either `id` or `data` option should be provided/
  )

  t.throws(
    () => sqlBuilder.selectOne({id: '1', data: {name: 'new'}}),
    /both `id` and `data` options are provided/
  )

  t.throws(
    () => sqlBuilder.selectOne({data: {name: 'new'}, where: {hide: false}}),
    /`where` can be used only with `id` option/
  )

  t.equal(
    sqlBuilder.selectOne({id: '134'}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    ' WHERE PersID=134',
    'with `id` option selects all described by schema fields'
  )

  const fullNewData = {
    /* no id because the row is just INSERTed and we want to know it's new ID */
    name: 'new one',
    hide: false,
    counter: '445', // extra data field. should be ignored
    group: {id: '12'},
    rights: {id: '101'},
    post: {id: '23'} // extra relation field. should be ignored
  }

  t.equal(
    sqlBuilder.selectOne({data: fullNewData}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    " WHERE name='new one' AND hide=false AND GrpID=12 AND rights=101",
    'uses `data` option for constraint clauses'
  )

  const partialNewData = {
    /* no id because the row is just INSERTed and we want to know it's new ID */
    name: 'new one',
    group: {id: '12'}
  }

  t.equal(
    sqlBuilder.selectOne({data: partialNewData}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    " WHERE name='new one' AND GrpID=12",
    'can work with partial `data`'
  )

  t.equal(
    sqlBuilder.selectOne({id: '134', fieldsOnly: 'name'}),
    'SELECT name' +
    ' FROM sPersonal' +
    ' WHERE PersID=134',
    'fieldsOnly filters out data fields'
  )

  t.equal(
    sqlBuilder.selectOne({id: '134', fieldsOnly: 'id'}),
    'SELECT PersID as id' +
    ' FROM sPersonal' +
    ' WHERE PersID=134',
    'fieldsOnly: `id` special case'
  )

  t.equal(
    sqlBuilder.selectOne({id: '134', fieldsOnly: ['id', 'group']}),
    'SELECT PersID as id, GrpID as userGroupId' +
    ' FROM sPersonal' +
    ' WHERE PersID=134',
    'fieldsOnly filters out relations too'
  )

  t.equal(
    sqlBuilder.selectOne({id: '134', where: {hide: false, password: '123'}}),
    'SELECT PersID as id, name, hide, GrpID as userGroupId, rights as rightsId' +
    ' FROM sPersonal' +
    " WHERE PersID=134 AND hide=false AND password='123'",
    'accepts `where` option for custom checks by sql-engine. e.g. passwords'
  )

  t.end()
})
