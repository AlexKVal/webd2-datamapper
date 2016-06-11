'use strict'

const _ = require('lodash')
const Adapter = require('../adapter')
const validateSchemaLinks = require('./validate-schema-links')
const validateTransforms = require('./validate-transforms')
const {validateRecordTypes} = require('./validate-record-rypes')
const Context = require('./context')
const {BadRequestError, NotFoundError, MethodError} = require('./errors')
const getLinks = require('./get-links')

/**
 * The only required input is record type definitions.
 * The first argument must be an object keyed by name, valued by definition
 * objects. Here are some example field definitions:
 *
 * Schema / recordTypes
 * {
 *   sUser: {
 *     $id: 'PersID',
 *     $table: 'sPersonal',
 *     name: { type: String },
 *     deleted: { type: Boolean, $fname: 'hide' },
 *     somePrivateField: { type: Number, private: true },
 *
 *     // One-to-many
 *     group: { link: 'sGroup', $fname: 'GrpID', inverse: 'users' },
 *     rights: { link: 'rights', $fname: 'rights' } // $fname: 'rights' here is unnecessary
 *   },
 *
 *   sGroup: {
 *     $id: 'GrpID',
 *     $table: 'sPepTree',
 *     name: { type: String },
 *     deleted: { type: Boolean, $fname: 'hide' },
 *
 *     // Many-to-one
 *     users: { link: 'sUser', inverse: 'group', isArray: true } // fk = sUser.group.$fname
 *   },
 *
 *   rights: {
 *     // $id: 'id' - is unnecessary
 *     $table: 'rights',
 *     name: { type: String }
 *   }
 * }
 *
 * `inverse` keyword should be used for 'hasMany' relations disambiguation
 *
 * recordTypes = {
 *   person: {
 *     ownPets: { link: 'pet', isArray: true, inverse: 'owner' },
 *     groomingPets: { link: 'pet', isArray: true, inverse: 'groomer' }
 *   },
 *   pet: {
 *     owner: { link: 'user' },
 *     groomer: { link: 'user' }
 *   }
 * }
 * or
 * recordTypes = {
 *   person: {
 *     ownPets: { link: 'pet', isArray: true },
 *     groomingPets: { link: 'pet', isArray: true }
 *   },
 *   pet: {
 *     owner: { link: 'user', inverse: 'ownPets' },
 *     groomer: { link: 'user', inverse: 'groomingPets' }
 *   }
 * }
 *
 * The allowed native types are `String`, `Number`, `Boolean`, `Date`
 *
 * The options object may contain the following keys:
 * - `dsn`: for odbc
 *
 * - `transforms`: keyed by type name, valued by object with `input`
 *   and `output` keys respectively. Both are optional.
 *
 *   `input` contains object keyed by `create`, `update`, and `delete`
 *     which contain a transform function respectively. (all are optional)
 *   `output` directly contains a transform function.
 *
 *   A transform function takes at least two arguments, the internal `context`
 *   object and a single `record`.
 *   A special case is the `update` argument for the `update` method.
 *
 *   There are two kinds of transforms, before a record is written to transform
 *   input, and after it is read to transform output, both are optional.
 *
 *   For a create request, the input transform must return the second argument
 *   `record` either synchronously, or asynchronously as a Promise. The return
 *   value of a delete request is inconsequential, but it may return a value or
 *   a Promise. There is a special case of the `update` method accepting an
 *   `update` object as a third parameter, which must be returned synchronously
 *   or as a Promise.
 *
 *   An example transform to apply a timestamp on a record before creation,
 *   and displaying the timestamp in the server's locale:
 *
 *   user: {
 *     input: {
 *       // return value of the delete method doesn't matter.
 *       delete (context, record) { ...here goes some logic... return null },
 *       create (context, record) { record.timestamp = new Date(); return record },
 *       update (context, record, update) { return update }
 *     },
 *     output (context, record) {
 *       record.timestamp = record.timestamp.toLocaleString()
 *       return record
 *     }
 *   }
 *
 *   Requests to update a record will **NOT** have the updates already applied
 *   to the record.
 *
 *   Another feature of the input transform is that it will have access to a
 *   temporary field `context.transaction`. This is useful for ensuring that
 *   bulk write operations are all or nothing. Each request is treated as a
 *   single transaction.
 *
 * The DataMapper is heavily influenced by the `Fortune.js` project.
 */
class DataMapper {
  constructor (recordTypes, options) {
    if (typeof recordTypes !== 'object') throw new TypeError('First argument must be an object.')
    if (!Object.keys(recordTypes).length) throw new Error('At least one type must be specified.')

    this.recordTypes = recordTypes

    options = options || {}

    this.transforms = options.transforms || {}

    validateTransforms(this.transforms, this.recordTypes)
    this.transforms = validateRecordTypes(this.transforms, this.recordTypes)
    validateSchemaLinks(this.recordTypes)

    this.adapter = new Adapter({
      options: {dsn: options.dsn},
      recordTypes: recordTypes
    })
  }

  /**
   * This is the primary method for initiating a request.
   * The options object may contain the following keys:
   *
   * - `method`: The method is either a function or a constant,
   *   which may be one of `find`, `create`, `update`, or `delete`.
   *   To implement a custom method, pass a function that accepts
   *   one argument, the context. It may return the context synchronously or
   *   as a Promise. Default: `find`.
   *
   * - `type`: Name of a type. Required.
   *
   * - `ids`: An array of IDs. Used for `find` and `delete` methods only.
   *
   * - `include`: For example:
   *   `[['comments'], ['comments', { ... }]]`. The last item within
   *   the list may be an `options` object, useful for specifying how the
   *   included records should appear. Optional.
   *
   * - `options`: Exactly the same as the adapter's `find` method options. The
   *   options apply only to the primary type on `find` requests. Optional.
   *
   * - `payload`: Payload of the request. Used for `create` and `update` methods
   *   only, and must be an array of objects. The objects must be the records
   *   to create, or update objects as expected by the Adapter.
   *
   * The response object may contain the following keys:
   *
   * - `payload`: An object containing the following keys:
   *   - `records`: An array of records returned.
   *   - `include`: An object keyed by type, valued by arrays of included records.
   *
   * The resolved response object should always be an instance of a response type.
   */
  request (options) {
    return Promise.resolve(new Context(options))

    .then((context) => {
      const req = context.request

      if (req.type == null) throw new BadRequestError('UnspecifiedType')

      if (!this.recordTypes[req.type]) throw new NotFoundError(`InvalidType: "${req.type}"`)

      if (!~['find', 'create', 'update', 'delete'].indexOf(req.method)) {
        throw new MethodError(`InvalidMethod: "${req.method}"`)
      }

      if (req.ids) req.ids = _.uniq(req.ids) // ensure

      return this[req.method](context)
    })

    .then((context) => {
      const response = context.response

      response.status = 'ok'
      if (!response.payload) response.status = 'empty'
      if (context.request.method === 'create') response.status = 'created'

      return response
    })
  }

  // middleware methods: find, create, update, delete

  /**
   * Fetch the primary records.
   *
   * It fetches only belongsTo fields data.
   * 'hasMany' ids are fetched by 'include()'.
   *
   * It mutates `context.response`.
   */
  find (context) {
    const request = context.request

    this._ensureIncludeFields(request)

    const options = request.options
    options.ids = request.ids

    return this.adapter.connect()

    .then(() => this.adapter.find(request.type, options))
    .then((records) => {
      if (records && records.length) context.response.records = records
    })

    .then(() => this.include(context)) // next 'include'

    .then(() => this.adapter.disconnect())

    // This makes sure to call `adapter.disconnect` before re-throwing the error.
    .catch((error) => this.adapter.disconnect().then(() => { throw error }))

    .then(() => this.end(context)) // next 'end'
  }

  /**
   * Runs incoming records through 'create' transformer.
   * Starts transaction.
   * Creates them in db in one transaction.
   * Closes transaction.
   * Gets from db created records with their newly assigned IDs (by db).
   * Runs created records through output transformer.
   */
  create (context) {
    const request = context.request

    if (!request.payload || !request.payload.length) {
      return Promise.reject(new BadRequestError('CreateRecordsInvalid'))
    }

    let transaction

    return this.adapter.beginTransaction()
    .then((newTransaction) => { context.transaction = transaction = newTransaction })

    .then(() => {
      const transformers = this.transforms[request.type]
      const transformer = transformers && transformers.input && transformers.input.create

      const records = request.payload

      if (!transformer) return records

      // `create` transformer has access to context.transaction to make additional db-requests
      return Promise.all(records.map((record) => transformer(context, record)))
    })

    .then((records) => {
      const links = getLinks(this.recordTypes[request.type])

      return Promise.all(
        records.map((record) => this._ensureReferentialIntegrity(record, links))
      )
    })

    .then((records) => transaction.create(request.type, records))
    .then((createdRecords) => { context.response.records = createdRecords })

    .then(() => transaction.endTransaction())

    // This makes sure to call `endTransaction` before re-throwing the error.
    .catch((error) => {
      if (!transaction) throw error
      return transaction.endTransaction(error).then(() => { throw error })
    })

    .then(() => this.end(context))
  }

  /**
   * Do updates.
   * First off it finds the records to update.
   * Then run update-transform and validation.
   * Then apply the update as well as links on related records.
   */
  update (context) {
    return Promise.resolve(context)
  }

  /**
   * Delete records by IDs.
   * context.type = 'aType'
   * context.ids = [1, 2, 3]
   * delete(context) // deletes only rows with 'id' IN (1, 2, 3)
   *
   * Or delete the entire collection if IDs are undefined.
   * context.type = 'aType'
   * delete(context) // deletes all rows
   *
   * It does not mutate context.
   */
  delete (context) {
    const request = context.request
    const ids = request.ids
    let transaction
    let recordsFound

    return this.adapter.connect()
    .then(() => this.adapter.find(request.type, ids ? {ids} : undefined))
    .then((records) => {
      if (ids && !records.length) {
        throw new NotFoundError('DeleteRecordsInvalid')
      }
      recordsFound = records
    })
    .catch((error) => this.adapter.disconnect().then(() => { throw error }))
    .then(() => this.adapter.disconnect())

    .then(() => this.adapter.beginTransaction())
    .then((newTransaction) => { context.transaction = transaction = newTransaction })

    .then(() => { // run some business logic before delete them
      const transformers = this.transforms[request.type]
      const transformer = transformers && transformers.input && transformers.input.delete

      if (!transformer) return // nothing to do

      // `delete` transformer has access to context.transaction to make additional db-requests
      return Promise.all(recordsFound.map((record) => transformer(context, record)))
    })

    .then(() => transaction.delete(request.type, request.ids))

    // referential integrity
    .then(() => {
      const primaryIds = recordsFound.map((record) => record.id)

      const nullify = (relationType, linkName) => {
        const options = {fieldsOnly: ['id'], match: {}}
        options.match[linkName] = primaryIds

        return transaction.find(relationType, options)
        .then((records) => records.map((record) => {
          record[linkName] = null
          return record // {id: 1, postTag: null}
        }))
        .then((updates) => transaction.update(relationType, updates))
      }

      const typesLinks = this._getRelationTypesLinks(request.type)

      return Promise.all(Object.keys(typesLinks).map((relationType) => { // for all type
        return Promise.all(typesLinks[relationType].map((linkName) => { // for all links in type
          return nullify(relationType, linkName)
        }))
      }))
      .then(() => 'ok')
    })

    .then(() => transaction.endTransaction())

    // This makes sure to call `endTransaction` before re-throwing the error.
    .catch((error) => {
      if (!transaction) throw error
      return transaction.endTransaction(error).then(() => { throw error })
    })

    .then(() => this.end(context))
  }

  // it mutates 'request'
  _ensureIncludeFields (request) {
    const options = request.options
    const includeOption = request.include

    this._validateIncludeOption(request.type, includeOption)

    const fieldsOnly = options.fieldsOnly

    if (includeOption && includeOption.length && fieldsOnly && fieldsOnly.length) {
      const descriptors = this.recordTypes[request.type]

      includeOption.map((linkFieldDescriptor) => {
        const linkField = linkFieldDescriptor[0]
        const isArray = descriptors[linkField].isArray

        // only belongsTo
        if (!isArray && !~fieldsOnly.indexOf(linkField)) fieldsOnly.push(linkField)
      })
    }

    return request
  }

  // general middleware: include, end

  /**
   * Fetch included records. It mutates `context.response`.
   *
   * Given:
   * user: {
   *   group: { link: 'group' },
   *   rights: { link: 'rights' },
   *   posts: { link: 'post', isArray: true },
   * }
   *
   * find's option
   * include: [
   *   ['group'],
   *   ['rights', {match: {deleted: false}}],
   *   ['posts', {fields: ['name'], match: {deleted: false}}]
   * ]
   *
   * 'group', 'rights', and 'post' should be fetched and included
   *
   * 'post' records should contain only 'name'-field
   * 'post' and 'rights' both should be filtered by {deleted: false}
   *
   * "adapter's" connection has to be opened already
   */
  include (context) {
    const request = context.request
    const response = context.response
    const primaryType = request.type
    const primaryRecords = response.records
    const includeOption = request.include

    if (!primaryRecords || !primaryRecords.length) return context

    // includeOption is validated in 'find()' at this moment
    const includeFields = this._mergeIncludeWithArrayLinks(primaryType, includeOption)
    if (!includeFields.length) return context

    const primaryModelDescriptors = this.recordTypes[primaryType]

    return Promise.all(includeFields.map((linkFieldDescriptor) => {
      const [linkField, fieldOptions] = linkFieldDescriptor
      const fieldDescriptor = primaryModelDescriptors[linkField]
      const relationType = fieldDescriptor.link

      if (fieldDescriptor.isArray) { // hasMany
        // for now only one inverse relation TODO
        const relationModelFields = this.recordTypes[relationType]
        const foreignKeyField = _.findKey(relationModelFields, { link: primaryType })

        // fetch foreign relation's records by primary IDs
        const primaryIDs = primaryRecords.map((record) => record.id)
        const options = Object.assign({match: {}}, fieldOptions)
        options.match[foreignKeyField] = primaryIDs

        return this.adapter.find(relationType, options)
        .then((relationRecords) => {
          if (!relationRecords || !relationRecords.length) return // nothing to do

          // embed hasMany IDs to primaryRecords
          primaryRecords.forEach((primaryRecord) => {
            primaryRecord[linkField] = relationRecords.reduce((acc, relationRecord) => {
              if (relationRecord[foreignKeyField] === primaryRecord.id) acc.push(relationRecord.id)
              return acc
            }, [])
          })

          const includeOptionFieldsNameArray = includeOption ? includeOption.map((el) => el[0]) : []
          if (~includeOptionFieldsNameArray.indexOf(linkField)) {
            response.include = response.include || {}
            response.include[relationType] = relationRecords
          }
        })
      } else { // belongsTo
        // record[linkField] is already loaded in find()
        const ids = primaryRecords.map((record) => record[linkField]).filter((id) => !!id)
        if (!ids || !ids.length) return // nothing to do

        const options = Object.assign({}, fieldOptions, {ids: _.uniq(ids)}) // ensure unique

        return this.adapter.find(relationType, options)
        .then((relationRecords) => {
          if (relationRecords && relationRecords.length) {
            response.include = response.include || {}
            response.include[relationType] = relationRecords
          }
        })
      }
    }))

    .then(() => context)
  }

  /**
   * `inverse` keyword should be used for 'hasMany' relations disambiguation
   *
   * recordTypes = {
   *   person: {
   *     ownPets: { link: 'pet', isArray: true, inverse: 'owner' },
   *     groomingPets: { link: 'pet', isArray: true, inverse: 'groomer' }
   *   },
   *   pet: {
   *     owner: { link: 'person' } // or inverse: 'ownPets'
   *     groomer: { link: 'person' } // or inverse: 'groomingPets'
   *   }
   * }
   *
   * _getInverseLink('person', 'ownPets') => 'owner'
   */
  _getInverseLink (primaryType, isArrayLinkName) {
    // schema links are already validated at this moment
    const primaryDescriptors = this.recordTypes[primaryType]
    const isArrayLinkDescriptor = primaryDescriptors[isArrayLinkName]
    const relationType = isArrayLinkDescriptor.link
    const relationDescriptors = this.recordTypes[relationType]

    return isArrayLinkDescriptor.inverse || // `inverse` in hasMany
    _.findKey(relationDescriptors, { inverse: isArrayLinkName }) || // `inverse` in belongsTo
    _.findKey(relationDescriptors, { link: primaryType }) // unambiguous inverse belongsTo link
  }

  /**
   * w/ empty `include` it generates (in include's format) options for hasMany fields
   * w/ `include` option present it merges them and their options
   *
   * recordTypes = {
   *   person: {
   *     ownPets: { link: 'pet', isArray: true },
   *     accounts: { link: 'account', isArray: true }
   *   },
   *   pet: {
   *     owner: { link: 'person', inverse: 'ownPets' }
   *   },
   *   account: {
   *     name: { type: String }, deleted: { type: Boolean },
   *     user: { link: 'person', inverse: 'accounts' }
   *   }
   * }
   *
   * type: 'person',
   * include: [
   *   ['accounts', {fieldsOnly: ['name'], match: {deleted: false}}]
   * ]
   *
   * it returns:
   * [
   *   ['ownPets', {fieldsOnly: ['id', 'owner']}],  // IDs will be embedded
   *   ['accounts', {fieldsOnly: ['name', 'id', 'user'], match: {deleted: false}}]
   * ]
   */
  _mergeIncludeWithArrayLinks (primaryType, includeOption) {
    const includeOptionFieldsNameArray = includeOption ? includeOption.map((el) => el[0]) : []

    const primaryModelDescriptors = this.recordTypes[primaryType]

    return _.reduce(
      primaryModelDescriptors,
      (result, desc, key) => {
        if (!desc.link || !desc.isArray) return result

        // is hasMany link
        const inverseLinkName = this._getInverseLink(primaryType, key)
        const defaultOptions = {fieldsOnly: ['id', inverseLinkName]}

        const index = includeOptionFieldsNameArray.indexOf(key)

        if (index !== -1) { // hasMany link is already present in "include" option
          const options = result[index][1]
          if (options && options.fieldsOnly) { // merge 'fieldsOnly' option
            options.fieldsOnly = _.union(options.fieldsOnly, defaultOptions.fieldsOnly)
          }
        } else {
          result.push([key, defaultOptions])
        }

        return result
      },
      includeOption ? includeOption.slice(0) : [] // start w/ includeOption by cloning it
    )
  }

  _validateIncludeOption (type, includeOption) {
    if (includeOption === undefined) return

    if (!Array.isArray(includeOption)) throw new TypeError('"include" option should be an array')

    const descriptors = this.recordTypes[type]

    includeOption.forEach((linkFieldDescriptor) => {
      if (!Array.isArray(linkFieldDescriptor)) {
        throw new TypeError(
          `"include" '${linkFieldDescriptor}' field descriptor should be an array` +
          " ['link field name', {optional options}]"
        )
      }

      const [linkField, fieldOptions] = linkFieldDescriptor

      const fieldDescriptor = descriptors[linkField]
      if (!fieldDescriptor) {
        throw new TypeError(`include: there is no '${linkField}' field in '${type}' type`)
      }

      const relationType = fieldDescriptor.link
      if (!relationType) {
        throw new TypeError(`include: '${linkField}' field is not a link`)
      }

      if (fieldOptions) {
        if (typeof fieldOptions !== 'object' || fieldOptions.constructor !== Object) {
          throw new TypeError(`include: options for '${linkField}' is not an object`)
        }
      }

      return {}
    })
  }

  /**
   * Apply `output` transform per record. It mutates `context.response`.
   */
  end (context) {
    const response = context.response

    return Promise.resolve(response.records) // start promises chain

    .then((records) => { // transform primary type records
      const transformers = this.transforms[context.request.type]
      const outputTransformer = transformers && transformers.output

      if (!records || !outputTransformer) return

      return Promise.all(records.map((record) => outputTransformer(context, record)))
      .then((transformed) => { response.records = transformed })
    })

    .then(() => { // transform records of 'included' types
      const includedTypesRecords = response.include

      if (!includedTypesRecords) return

      const types = Object.keys(includedTypesRecords)

      return Promise.all(types.map((type) => {
        const records = includedTypesRecords[type]

        const transformers = this.transforms[type]
        const outputTransformer = transformers && transformers.output

        if (!records || !outputTransformer) return // do nothing

        return Promise.all(records.map((record) => outputTransformer(context, record)))
        .then((transformed) => { response.include[type] = transformed })
      }))
    })

    .then(() => {
      if (response.records && response.records.length) {
        response.payload = { records: response.records }

        if (response.include) response.payload.include = response.include
      }

      delete response.records
      delete response.include
      delete context.transaction

      return context
    })
  }

  /**
   * with
   * recordTypes = {
   *   user: {
   *     group: { link: 'group' },
   *     rights: { link: 'rights' }
   *   },
   *   group: {
   *     users: { link: 'user', isArray: true }
   *   },
   *   rights: {
   *   }
   * }
   *
   * for user:
   * links = {
   *   group: { link: 'group' },
   *   rights: { link: 'rights' }
   * }
   */
  _ensureReferentialIntegrity (record, links) {
    return Promise.all(
      Object.keys(links).map((linkKey) => {
        const relationType = links[linkKey].link
        const relationIdToCheck = record[linkKey]

        if (relationIdToCheck == null) return // nothing to check

        // the connection is opened already by adapter.beginTransaction()
        return this.adapter.find(relationType, {ids: [relationIdToCheck], fieldsOnly: ['id']})
        .then((rows) => {
          if (!rows.length) {
            throw new BadRequestError('RelatedRecordNotFound: there is no record' +
              ` with id: '${relationIdToCheck}' in '${relationType}' type`)
          }
        })
      })
    )
    .then(() => record)
  }

  /**
   * returns types and their one-to-many links
   * relating to primary type
   *
   * for recordTypes = {
   *   post: {
   *     $id: 'PostID', text: { type: String },
   *     postTag: { link: 'tag' }
   *   },
   *   message: {
   *     $table: 'msg', text: { type: String },
   *     msgTag: { link: 'tag' }
   *   },
   *   tag: {
   *     $id: 'tagId', name: { type: String },
   *     posts: { link: 'post', isArray: true, inverse: 'postTag' },
   *     messages: { link: 'message', isArray: true, inverse: 'msgTag' }
   *   }
   * }
   *
   * returns:
   * {
   *   post: ['postTag'],
   *   message: ['msgTag']
   * }
   */
  _getRelationTypesLinks (primaryType) {
    let result = {}

    for (let type in this.recordTypes) {
      const fields = this.recordTypes[type]
      for (let field in fields) {
        if (/^\$/.test(field)) continue
        const descr = fields[field]
        if (descr.link === primaryType && !descr.isArray) {
          if (!result[type]) result[type] = []
          result[type].push(field)
        }
      }
    }

    return result
  }
}

module.exports = DataMapper
