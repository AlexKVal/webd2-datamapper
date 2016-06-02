'use strict'

const _ = require('lodash')
const Adapter = require('../adapter')
const validateTransforms = require('./validate-transforms')
const {validateRecordTypes} = require('./validate-record-rypes')
const Context = require('./context')
const {BadRequestError, NotFoundError, MethodError} = require('./errors')

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
   * - `include`: A 2-dimensional array specifying links to include. The first
   *   dimension is a list, the second dimension is depth. For example:
   *   `[['comments'], ['comments', 'author', { ... }]]`. The last item within
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
   * It mutates `context.response`.
   */
  find (context) {
    const request = context.request

    this._ensureFieldsOnlyAndInclude(request)

    const options = request.options
    options.ids = request.ids

    return this.adapter.connect()

    .then(() => this.adapter.find(request.type, options))
    .then((records) => { context.response.records = records })

    .then(() => this.include(context)) // next 'include'

    .then((withIncluded) => {
      return this.adapter.disconnect()
      .catch((error) => {
        this.adapter.disconnect() // make sure disconnect db if error
        throw error
      })
      .then(() => withIncluded)
    })

    .then((withIncluded) => this.end(withIncluded)) // next 'end'
  }

  create (context) { return context }

  update (context) { return context }

  delete (context) { return context }

  _ensureFieldsOnlyAndInclude (context) {

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
    const primaryRecords = response.records
    const includeOption = request.include

    if (!primaryRecords || !includeOption || !includeOption.length) return context

    this._validateIncludeOption(request.type, includeOption)

    const descriptors = this.recordTypes[request.type]

    return Promise.all(includeOption.map((linkFieldDescriptor) => {
      const [linkField, fieldOptions] = linkFieldDescriptor
      const fieldDescriptor = descriptors[linkField]

      if (fieldDescriptor.isArray) {
        // hasMany
      } else { // belongsTo
        // record[linkField] is already loaded in find()
        const ids = primaryRecords.map((record) => record[linkField]).filter((id) => !!id)
        if (!ids || !ids.length) return // nothing to do

        const options = Object.assign({}, fieldOptions, {ids})
        const relationType = descriptors[linkField].link

        return this.adapter.find(relationType, options)
        .then((records) => {
          if (records && records.length) {
            response.include = response.include || {}
            response.include[relationType] = records
          }
        })
      }
    }))

    .then(() => context)
  }

  _validateIncludeOption (type, includeOption) {
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

      if (!descriptors[linkField]) {
        throw new TypeError(`include: there is no '${linkField}' field in '${type}' type`)
      }

      if (!descriptors[linkField].link) {
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
      if (response.records) {
        response.payload = { records: response.records }
        delete response.records

        if (response.include) {
          response.payload.include = response.include
          delete response.include
        }
      }

      delete context.transaction

      return context
    })
  }
}

module.exports = DataMapper
