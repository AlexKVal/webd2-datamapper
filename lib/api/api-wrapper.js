'use strict'
const debug = require('debug')('webd2-api:apiWrapper')

const Serializer = require('../utils/serializer')
const Deserializer = require('../utils/deserializer')
const Relations = require('../relations/relations')
const parseQueryParams = require('../utils/parse-query-params')

const idParamParser = require('./id-param-parser')

/**
 * REST Api wrapper
 *
 * Usage:
 *
 * const userModel = require('../models/user')
 * const userApi = new ApiWrapper(userModel)
 *
 * userApi.apiFetchMany({sideloadJoinedRelations: true, where: {hide:false}, orderBy: 'name'})
 * .then((usersJson) => { ... req.send(usersJson) })
 */
class ApiWrapper {
  constructor (attrs, registryMock) {
    let {model, serializer, deserializer} = attrs
    if (attrs && attrs.name) {
      model = attrs
      serializer = deserializer = undefined
    }

    if (!model || !model.name || !model.schema) {
      throw new TypeError("ApiWrapper needs a model with 'name' and 'schema' fields")
    }
    debug(`wrapping of '${model.name}' model`)

    this.model = model

    this.relations = new Relations(model.name, model.schema, registryMock)

    if (serializer) {
      this.serializer = serializer // for testing
    } else {
      this.serializer = new Serializer({
        modelName: model.name,
        attributes: model.attributesSerialize,
        attributesOfRelations: this.relations.getAttributesOfRelations()
      })
    }

    if (deserializer) {
      this.deserializer = deserializer // for testing
    } else {
      const modelNamesOfRelations = this.relations.belongsToDescriptors
      .map((rel) => rel.relationModelName)
      this.deserializer = new Deserializer(modelNamesOfRelations)
    }
  }

  apiCreate (newData) {
    debug(`${this.model.name}:apiCreate`)

    if (!newData) {
      throw new TypeError(`${this.model.name}.apiCreate(newData) newData cannot be undefined`)
    }

    return this.deserializer.deserialize(newData)
    .then((deserializedData) => this.model.create(deserializedData))
    .then((record) => this._joinRelationsAndSerialize(record))
  }

  apiUpdate (id, updates) {
    debug(`${this.model.name}:apiUpdate(${id})`)

    if (!id || !updates) {
      throw new TypeError(`${this.model.name}.apiUpdate(id, updates) id and updates cannot be undefined`)
    }

    return this.deserializer.deserialize(updates)
    .then((deserializedData) => this.model.update(id, deserializedData))
    .then((record) => this._joinRelationsAndSerialize(record))
  }

  apiFind (id) {
    debug(`${this.model.name}:apiFind(${id})`)

    if (!id) {
      throw new TypeError(`${this.model.name}.apiFind(id) id cannot be undefined`)
    }

    return this.model.selectOne({id})
    .then((record) => this._joinRelationsAndSerialize(record))
  }

  /**
   * options format
   * {
   *   sideloadJoinedRelations: true or false, fetch or no JOIN-ed relation's data too
   *
   *   fieldsOnly
   *   where
   *   orderBy
   *   <etc> constraints go to parent model
   *
   *   relationsOptions: {
   *     parentWhere - contains parent's 'where' contraint
   *
   *     user: { where: {hide: false}, orderBy: 'name' },
   *     divisions: {where: {hide: false}}
   *   } these options go each one to correspondent relation's model
   * }
   */
  apiFetchMany (options) {
    debug(`${this.model.name}:apiFetchMany`)

    options = options || {}
    const relationsOptions = options.relationsOptions || {}
    relationsOptions.parentWhere = options.where
    delete options.relationsOptions // to prevent passing it to parent model

    return this.model.selectMany(options)
    .then((parentRows) => {
      if (options.sideloadJoinedRelations) {
        return this.relations.fetchAndEmbedJoined(parentRows, relationsOptions)
      } else {
        return this.relations.justEmbedJoinedIds(parentRows, relationsOptions)
      }
    })
    .then((dataSet) => {
      if (options.sideloadJoinedRelations) {
        return this.serializer.withRelated(dataSet)
      } else {
        return this.serializer.withoutRelated(dataSet)
      }
    })
  }

  /**
   * handles one row
   * thus used in apiMethods that return only one row
   */
  _joinRelationsAndSerialize (row) {
    debug(`${this.model.name}:_joinRelationsAndSerialize`)

    const dataSet = this.relations.transformBelongsToIDs([row])[0]
    return this.serializer.withoutRelated(dataSet)
  }

  /**
   * REST Api methods (CRUD)
   */
  create (req, res, next) {
    debug(`${this.model.name}:create`)

    this.apiCreate(req.body)
    .then((serialized) => res.status(201).json(serialized))
    .catch((err) => next(err))
  }

  readMany (req, res, next) {
    debug(`${this.model.name}:readMany`)
    debug(`query ${JSON.stringify(req.query)}`)

    const parsedOptions = parseQueryParams(req.query || {})
    debug(`query ${JSON.stringify(parsedOptions)}`)

    this.apiFetchMany(parsedOptions)
    .then((serialized) => res.json(serialized))
    .catch((err) => next(err))
  }

  readOne (req, res, next) {
    debug(`${this.model.name}:readOne`)

    this.apiFind(req.id)
    .then((serialized) => res.json(serialized))
    .catch((err) => next(err))
  }

  update (req, res, next) {
    debug(`${this.model.name}:update`)

    this.apiUpdate(req.id, req.body)
    .then((serialized) => res.status(201).json(serialized))
    .catch((err) => next(err))
  }

  delete (req, res, next) {
    debug(`${this.model.name}:delete`)

    next(new Error('REST delete() is not implemented'))
    // this.apiDelete(req.id)
    // .then(() => res.status(201))
    // .catch((err) => next(err))
  }

  /**
   * connects REST api to provided router
   *
   * options 'create read update delete'
   * options 'create update'
   * by default with no options provided only 'read'
   */
  connect (router, options) {
    router.param('id', idParamParser)

    options = options || 'read'

    const opts = options.split(' ')
    .reduce((acc, curr) => { acc[curr] = true; return acc }, {})

    const forMany = router.route('/')
    const forOne = router.route('/:id')

    if (opts.read) {
      forMany.get(this.readMany.bind(this))
      forOne.get(this.readOne.bind(this))
    }

    if (opts.create) forMany.post(this.create.bind(this))
    if (opts.update) forOne.patch(this.update.bind(this))
    if (opts.delete) forOne.delete(this.delete.bind(this))

    return router
  }
}

module.exports = ApiWrapper
