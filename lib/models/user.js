'use strict'

const debug = require('debug')('webd2-api:model')
const {
  BadRequestError,
  UnauthorizedError
} = require('jsonapi-errors/lib/errors')

require('./user-group')
const registry = require('./registry')
const BaseModel = require('./base-model')

class User extends BaseModel {
  /**
   * override for some default constraints
   * they can be overriden by /?user=constraints
   */
  selectMany (options) {
    const defaults = {
      where: {hide: false},
      orderBy: 'name'
    }

    return super.selectMany(Object.assign(defaults, options))
  }

  passwordVerify (id, password) {
    debug(`${this.name}#passwordVerify`)

    if (!id || !password) return Promise.reject(new BadRequestError('submit id and password'))

    return this.selectOne({
      id: id,
      where: { hide: false, password: password }
    })
    .catch((error) => {
      if (error.code === 'ENOTFOUND') throw new UnauthorizedError('wrong credentials')

      throw error
    })
  }
}

User.schemaObject = {
  tableName: 'sPersonal',
  id: 'PersID',
  name: 'string',

  userGroup: {
    belongsTo: 'userGroup',
    fkField: 'GrpID'
  }
}

module.exports = registry.model('user', User)
