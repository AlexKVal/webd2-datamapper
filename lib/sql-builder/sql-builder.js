'use strict'
const debug = require('debug')('webd2-api:sqlBuilder')
const {
  castArray, includes, intersection,
  isUndefined, omit, pickBy, transform
} = require('lodash')

const {
  getBelongsToDescriptors
} = require('../relations/get-descriptors')


function quoteValueIfString (fieldType, fieldValue) {
  if (fieldValue == null) {
    throw new Error(`string-type value for SQL query cannot be ${String(fieldValue)}`)
  }

  switch (fieldType) {
    case 'boolean':
    case 'integer':
      /**
       * boolean, integer etc.
       * pvsw accepts 'false' and '333' w/o problem
       */
      return fieldValue

    case 'string':
    default:
      /**
       * values from fields that are not described in the scheme
       * are treated as strings
       */
      return "'" + String(fieldValue).replace(/'/g, ' ') + "'"
  }
}

class SqlBuilder {
  constructor (schemaObject) {
    this.idFieldName = schemaObject.id || 'id'
    this.idFieldClause = schemaObject.id ? `${schemaObject.id} as id` : 'id'

    this.tableName = schemaObject.tableName

    this._schema = omit(schemaObject, ['id', 'tableName'])

    this.belongsToDescriptors = getBelongsToDescriptors(this._schema)

    this.columns = pickBy(this._schema, (columnDescriptor, columnName) => {
      return typeof columnDescriptor !== 'object'
    })

    this.columnsNames = Object.keys(this.columns)
  }

  _getRelationsLinesForUpdate (data) {
    return this.belongsToDescriptors
    .filter((rel) => !isUndefined(data[rel.modelFieldName]))
    .map((rel) => `${rel.fkField}=${data[rel.modelFieldName].id}`)
  }

  generateFieldEqualsDataLines (data) {
    return transform(this.columns, (linesArray, fieldDescriptor, fieldName) => {
      if (!isUndefined(data[fieldName])) {
        const fieldValue = quoteValueIfString(fieldDescriptor, data[fieldName])
        linesArray.push(`${fieldName}=${fieldValue}`)
      }
    }, [])
    .concat(this._getRelationsLinesForUpdate(data))
  }

  _generateForeignKeysLines (fieldsOnly) {
    let relations = this.belongsToDescriptors

    if (fieldsOnly) {
      relations = relations.filter((rel) => castArray(fieldsOnly).indexOf(rel.modelFieldName) > -1)
    }

    return relations.map((rel) => `${rel.fkField} as ${rel.fkAs}`)
  }

  /**
   * Lines of fields for SELECT queries
   *
   * SELECT PersID as id,
   * name, cardcode,       // columns
   * GrpID as userGroupId, // foreign key
   * rights as rightsId   // foreign key
   *
   * generateSelectFieldsPart() => '<all fields>'
   * generateSelectFieldsPart(['name', 'hide']) => 'name, hide'
   * generateSelectFieldsPart('name') => 'name'
   * special case when we need just 'id' value(s)
   * generateSelectFieldsPart('id') => 'PersID as id'
   * special case when we need just 'id' and belongsTo-relations value(s)
   * generateSelectFieldsPart('idAndRelations') => 'PersID as id, GrpID as id'
   */
  generateSelectFieldsPart (fieldsOnly) {
    if (fieldsOnly === 'id') {
      return this.idFieldClause
    }

    if (fieldsOnly === 'idAndRelations') {
      return [].concat(
        this.idFieldClause,
        this._generateForeignKeysLines()
      ).join(', ')
    }

    if (fieldsOnly) {
      fieldsOnly = castArray(fieldsOnly)

      return [].concat(
        includes(fieldsOnly, 'id') ? this.idFieldClause : [],
        intersection(this.columnsNames, fieldsOnly),
        this._generateForeignKeysLines(fieldsOnly)
      ).join(', ')
    }

    return [].concat(
      this.idFieldClause,
      this.columnsNames,
      this._generateForeignKeysLines()
    ).join(', ')
  }

  getTableName () {
    const tableName = this.tableName
    if (!tableName) throw new TypeError('tableName is not provided')
    return tableName
  }

  /**
   * underlying sql-engine doesn't throw any error if row doesn't exist
   * this method aimed to fix this
   */
  sqlIsRowExist (id) {
    return `SELECT ${this.idFieldClause}` +
    ` FROM ${this.getTableName()}` +
    ` WHERE ${this.idFieldName}=${id}`
  }

  _fieldsNamesForInsert (data, schemaMixin) {
    const dataFields = this.columnsNames
    .filter((fieldName) => !isUndefined(data[fieldName]))

    const mixinFields = Object.keys(schemaMixin || {})
    .filter((fieldName) => !isUndefined(data[fieldName]))

    const relationsFields = this.belongsToDescriptors
    .filter((rel) => !isUndefined(data[rel.modelFieldName])) // only fields present in data
    .map((rel) => rel.fkField)

    return dataFields.concat(mixinFields, relationsFields)
  }

  _fieldsValuesForInsert (data, schemaMixin) {
    const dataFieldsValues = this.columnsNames.reduce((memo, fieldName) => {
      if (!isUndefined(data[fieldName])) {
        memo.push(quoteValueIfString(this._schema[fieldName], data[fieldName]))
      }
      return memo
    }, [])

    const mixinFieldsValues = Object.keys(schemaMixin || {}).reduce((memo, fieldName) => {
      if (!isUndefined(data[fieldName])) {
        memo.push(quoteValueIfString(schemaMixin[fieldName], data[fieldName]))
      }
      return memo
    }, [])

    const relationsIds = this.belongsToDescriptors.reduce((memo, rel) => {
      const embeddedRelation = data[rel.modelFieldName]
      if (!isUndefined(embeddedRelation)) memo.push(embeddedRelation.id)
      return memo
    }, [])

    return dataFieldsValues.concat(mixinFieldsValues, relationsIds)
  }

  _wherePart (whereOptions) {
    return transform(whereOptions, (memo, value, fieldName) => {
      if (isUndefined(value)) throw new TypeError(`_wherePart(): value of '${fieldName}' key is undefined`)

      const fieldValue = quoteValueIfString(this._schema[fieldName], value)
      memo.push(`${fieldName}=${fieldValue}`)
    }, [])
  }

  /**
   * general options
   * {fieldsOnly: ['name', 'hide']}
   * {fieldsOnly: 'id'}
   * {fieldsOnly: 'idAndRelations'}
   *
   * selectMany(options)
   * {} => SELECT <all fields> FROM <tableName>
   * {id: '12'} throws
   * {where: {hide: false}} => WHERE hide=false
   * {where: {hide: false, name: 'Vasya'}} => WHERE hide=false AND name='Vasya'
   * {orderBy: 'name DESC'} => ORDER BY name
   * {orderBy: 'name, rights DESC'} => ORDER BY name, rights
   * {orderBy: ['name', 'rights DESC']} => ORDER BY name, rights
   *
   * relationModel.sqlBuilder.selectMany({ whereIn }) => WHERE id IN (SELECT ...)
   *
   * for belongsTo (many-to-one)
   * whereIn: {
   *   parentFkName: foreign key field from parent's schema (rel.fkName)
   *   parentTableName
   *   parentWhere: <parent_constraints> from parent's {where: {<parent_constraints>}}
   * }
   * => WHERE id IN (SELECT DISTINCT <parentFkName> FROM <parentTableName>
   *
   * or for hasMany (one-to-many)
   * whereIn: {
   *   relationFkName: foreign key field from parent's schema (rel.fkName)
   *   parentIdFieldName
   *   parentTableName
   *   parentWhere: <parent_constraints> from parent's {where: {<parent_constraints>}}
   * }
   * => WHERE <relationFkName> IN (SELECT <parentIdFieldName> FROM <parentTableName>
   */
  selectMany (options) {
    options = options || {}
    if (options.id) throw new Error('it is wrong to pass the `id` option to selectMany')

    let query = `SELECT ${this.generateSelectFieldsPart(options.fieldsOnly)}` +
    ` FROM ${this.getTableName()}`

    if (options.where || options.whereIn) {
      query += ' WHERE '
    }

    if (options.where) {
      query += `${this._wherePart(options.where).join(' AND ')}`
    }

    if (options.where && options.whereIn) {
      query += ' AND '
    }

    if (options.whereIn) {
      const {
        parentFkName,
        relationFkName, parentIdFieldName,
        parentTableName, parentWhere
      } = options.whereIn

      if (!parentTableName) throw new Error('parentTableName is undefined')
      if (parentFkName && relationFkName) throw new Error('ambiguous relationFkName and parentFkName')

      if (parentFkName) {
        query += 'id IN (' +
          `SELECT DISTINCT ${parentFkName}` +
          ` FROM ${parentTableName}`
      }

      if (relationFkName) {
        if (!parentIdFieldName) throw new Error('parentIdFieldName is undefined')

        query += `${relationFkName} IN (` +
          `SELECT ${parentIdFieldName}` +
          ` FROM ${parentTableName}`
      }

      if (parentWhere) {
        query += ` WHERE ${this._wherePart(parentWhere).join(' AND ')}`
      }

      query += ')'
    }

    if (options.orderBy) {
      const orderBy = Array.isArray(options.orderBy)
        ? options.orderBy.join(', ')
        : options.orderBy
      query += ` ORDER BY ${orderBy}`
    }

    debug(`selectMany:\n    ${query}`)
    return query
  }

  /**
   * selectOne(options)
   * {id: '12'} => WHERE PersID=12
   * {data: data} => WHERE name='admin' AND hide=false
   *
   * general options
   * {fieldsOnly: ['name', 'hide']}
   * {fieldsOnly: 'id'}
   * {fieldsOnly: 'idAndRelations'}
   *
   * {where: {hide: false, password: '123'}} - this is used when we need
   * additional checks by sql-engine (e.g. passwords)
   *   e.g. {id: '134', where: {hide: false, password: '123'}}
   */
  selectOne (options) {
    if (!options || !options.id && !options.data) {
      throw new Error('either `id` or `data` option should be provided')
    }

    if (options.id && options.data) {
      throw new Error('both `id` and `data` options are provided')
    }

    if (options.data && options.where) {
      throw new Error('`where` can be used only with `id` option')
    }

    let query = `SELECT ${this.generateSelectFieldsPart(options.fieldsOnly)}` +
    ` FROM ${this.getTableName()}`

    if (options.id) {
      query += ` WHERE ${this.idFieldName}=${options.id}`
    }

    if (options.where) {
      query += ` AND ${this._wherePart(options.where).join(' AND ')}`
    }

    if (options.data) {
      query += ` WHERE ${this.generateFieldEqualsDataLines(options.data).join(' AND ')}`
    }

    debug(`selectOne:\n    ${query}`)
    return query
  }

  /**
   * schemaMixin - is used when we need to provide additional fields/values
   * but do not want them to be public
   */
  create (data, schemaMixin) {
    const query = `INSERT INTO ${this.getTableName()}` +
    ` (${this._fieldsNamesForInsert(data, schemaMixin).join(', ')})` +
    ` VALUES (${this._fieldsValuesForInsert(data, schemaMixin).join(', ')})`

    debug(`create:\n    ${query}`)
    return query
  }

  update (id, data) {
    const query = `UPDATE ${this.getTableName()}` +
    ` SET ${this.generateFieldEqualsDataLines(data).join(', ')}` +
    ` WHERE ${this.idFieldName}=${id}`

    debug(`update:\n    ${query}`)
    return query
  }

}

SqlBuilder.quoteValueIfString = quoteValueIfString

module.exports = SqlBuilder
