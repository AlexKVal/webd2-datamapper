'use strict'
const debug = require('debug')('webd2-api:relations')
const { find, filter } = require('lodash')

const registry = require('../models/registry')
const foreignKey = require('../sql-builder/foreign-key')
const {
  getHasManyDescriptors,
  getBelongsToDescriptors
} = require('./get-descriptors')

class Relations {
  constructor (modelName, modelSchema, registryMock) {
    if (modelName == null) throw new TypeError('modelName is undefined')
    if (modelSchema == null) throw new TypeError('modelSchema is undefined')
    if (typeof modelSchema !== 'object') throw new TypeError('modelSchema should be an object')
    if (modelSchema.tableName == null) throw new TypeError('modelSchema tableName is undefined')

    debug(`Relations for '${modelName}' model`)

    this.modelName = modelName
    this.modelSchema = modelSchema

    this.registry = registryMock || registry

    this.fkAsForHasMany = foreignKey(modelName)

    this.belongsToDescriptors = getBelongsToDescriptors(modelSchema)
    this.hasManyDescriptors = getHasManyDescriptors(modelSchema)
  }

  getAttributesOfRelations () {
    const result = {}

    this.belongsToDescriptors.forEach((rel) => {
      const relationModel = this.registry.model(rel.relationModelName)
      if (!relationModel) throw new Error(`there is no registered '${rel.relationModelName}' model`)
      result[rel.modelFieldName] = relationModel.asRelationAttributesSerialize
    })

    this.hasManyDescriptors.forEach((rel) => {
      const relationModel = this.registry.model(rel.relationModelName)
      if (!relationModel) throw new Error(`there is no registered '${rel.relationModelName}' model`)
      result[rel.modelFieldName] = relationModel.asRelationAttributesSerialize
    })

    return result
  }

  _embedHasMany (parentRows, relationsData) {
    debug(`${this.modelName}:_embedHasMany`)

    return parentRows.map((parentRow) => {
      relationsData.forEach((rel) => {
        parentRow[rel.modelFieldName] = filter(rel.rows, [this.fkAsForHasMany, parentRow.id])
        .map((relRow) => {
          relRow[rel.parentModelFieldName] = { id: parentRow.id } // reverse connection
          delete relRow[this.fkAsForHasMany]
          return relRow
        })
      })
      return parentRow
    })
  }

  _embedBelongsTo (parentRows, relationsData) {
    debug(`${this.modelName}:_embedBelongsTo`)

    return parentRows.map((parentRow) => {
      relationsData.forEach((rel) => {
        if (rel.rows) {
          parentRow[rel.modelFieldName] = find(rel.rows, { id: parentRow[rel.fkAs] })
        } else {
          parentRow[rel.modelFieldName] = { id: parentRow[rel.fkAs] }
        }
        delete parentRow[rel.fkAs]
      })
      return parentRow
    })
  }

  transformBelongsToIDs (parentRows) {
    debug(`${this.modelName}:transformBelongsToIDs`)

    return parentRows.map((parentRow) => {
      this.belongsToDescriptors.forEach((rel) => {
        parentRow[rel.modelFieldName] = { id: parentRow[rel.fkAs] }
        delete parentRow[rel.fkAs]
      })
      return parentRow
    })
  }

  /**
   * _fetchBelongsTo, _fetchHasMany, fetchAndEmbedJoined, justEmbedJoinedIds
   * options format
   * {
   *   parentWhere,
   *
   *   // additional constraints for 'rights' relation
   *   rights: {
   *     where: {hide: false}
   *   },
   *
   *   // additional constraints for 'userGroup' relation
   *   userGroup: {
   *     where: {hide: false},
   *     orderBy: 'shortName'
   *   }
   * }
   */

  _fetchHasMany (options) {
    debug(`${this.modelName}:_fetchHasMany`)

    options = options || {}

    return Promise.all(this.hasManyDescriptors.map((descr) => {
      const relationModel = this.registry.model(descr.relationModelName)

      if (!relationModel) {
        return Promise.reject(
          new Error(`_fetchHasMany: there is no registered '${descr.relationModelName}' model`)
        )
      }

      const parentModelFieldName = findModelFieldName(this.modelName, relationModel.schema)

      const optionsForRelation = Object.assign({}, options[descr.relationModelName], {
        whereIn: {
          relationFkName: descr.fkField,
          parentIdFieldName: this.modelSchema.id || 'id',
          parentTableName: this.modelSchema.tableName,
          parentWhere: options.parentWhere
        }
      })
      if (options.onlyIDs) optionsForRelation.fieldsOnly = 'idAndRelations'

      return relationModel.selectMany(optionsForRelation)
      .then((castRows) => {
        return {
          modelFieldName: descr.modelFieldName,
          parentModelFieldName,
          rows: castRows
        }
      })
    }))
  }

  _fetchBelongsTo (options) {
    debug(`${this.modelName}:_fetchBelongsTo`)

    options = options || {}

    return Promise.all(this.belongsToDescriptors.map((descr) => {
      const relationModel = this.registry.model(descr.relationModelName)

      if (!relationModel) {
        return Promise.reject(
          new Error(`_fetchBelongsTo: there is no registered '${descr.relationModelName}' model`)
        )
      }

      const optionsForRelation = Object.assign({}, options[descr.relationModelName], {
        whereIn: {
          parentFkName: descr.fkField,
          parentTableName: this.modelSchema.tableName,
          parentWhere: options.parentWhere
        }
      })

      return relationModel.selectMany(optionsForRelation)
      .then((castRows) => {
        return {
          modelFieldName: descr.modelFieldName,
          fkAs: descr.fkAs,
          rows: castRows
        }
      })
    }))
  }

  fetchAndEmbedJoined (parentRows, options) {
    return this._fetchBelongsTo(options)
    .then((relationsData) => this._embedBelongsTo(parentRows, relationsData))
    .then(
      (partialResult) => this._fetchHasMany(options)
      .then((relationsData) => [partialResult, relationsData])
    )
    .then(([partialResult, relationsData]) => this._embedHasMany(partialResult, relationsData))
  }

  justEmbedJoinedIds (parentRows, options) {
    debug(`${this.modelName}:justEmbedJoinedIds`)

    return this._fetchHasMany(Object.assign({}, options, {onlyIDs: true}))
    .then((relationsData) => this._embedHasMany(parentRows, relationsData))
    .then((partialResult) => this.transformBelongsToIDs(partialResult))
  }
}

function findModelFieldName (modelName, relModelSchema) {
  const belongsToDescriptors = getBelongsToDescriptors(relModelSchema)
  const descr = find(belongsToDescriptors, ['relationModelName', modelName])

  if (!descr) throw new Error(`there is no belongsTo descriptor for '${modelName}'`)

  return descr.modelFieldName
}

Relations.findModelFieldName = findModelFieldName

module.exports = Relations
