'use strict'

require('./user')
const registry = require('./registry')
const BaseModel = require('./base-model')

class UserGroup extends BaseModel {
  create (data) {
    /**
     * create all new 1-lvl-groups under the root node
     * it is not public and always = 1
     */
    data.parentid = 1
    return super.create(data, { parentid: 'integer' })
  }

  validateBeforeUpdate (id, newData, prevData) {
    function isAttemptToDelete (newData, prevData) {
      return prevData.hide === false && newData.hide === true
    }

    if (isAttemptToDelete(newData, prevData)) {
      const userModel = registry.model('user')

      const where = { hide: false }
      where[this.schema.users.fkField] = newData.id

      return userModel.selectMany({ // get users(where group.id = id)
        fieldsOnly: 'id',
        where
      })
      .then((userIDs) => {
        if (userIDs.length > 0) { // TODO rewrite when select*() can SUM()
          throw new Error(`Cannot delete. There are (${userIDs.length}) users in the group`)
        }
      })
    }

    return true
  }
}

UserGroup.schemaObject = {
  tableName: 'sPepTree',
  id: 'GrpID',
  name: 'string',
  hide: 'boolean',
  info: 'string',

  users: {
    hasMany: 'user',
    fkField: 'GrpID'
  }
}

module.exports = registry.model('userGroup', UserGroup)
