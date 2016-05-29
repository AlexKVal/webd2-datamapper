'use strict'

const Adapter = require('../adapter')
const validateTransforms = require('./validate-transforms')
const {validateRecordTypes} = require('./validate-record-rypes')

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
 * - `transforms`: keyed by type name, valued by an array containing an `input`
 *   and/or `output` function at indices `0` and `1` respectively.
 *
 *   A transform function takes at least two arguments, the internal `context`
 *   object and a single `record`. A special case is the `update` argument for
 *   the `update` method.
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
 *   [
 *     (context, record, update) => {
 *       const method = context.request.method
 *
 *       if (method === 'create') {
 *         record.timestamp = new Date()
 *         return record
 *       }
 *
 *       if (update) return update
 *
 *       // If we get here, return value of the delete method doesn't matter.
 *       return null
 *     },
 *     (context, record) => {
 *       record.timestamp = record.timestamp.toLocaleString()
 *       return record
 *     }
 *   ]
 *
 *   Requests to update a record will **NOT** have the updates already applied
 *   to the record.
 *
 *   Another feature of the input transform is that it will have access to a
 *   temporary field `context.transaction`. This is useful for ensuring that
 *   bulk write operations are all or nothing. Each request is treated as a
 *   single transaction.
 *
 * The DataMapper is heavily influenced by `Fortune.js` project.
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
    // return dispatch()
  }
}

module.exports = DataMapper
