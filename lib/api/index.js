'use strict'

const { Router } = require('express')

const ApiWrapper = require('./api-wrapper')

const user = require('../models/user')
const userGroup = require('../models/user-group')
const userAccount = require('../models/user-account')

module.exports = {
  users: new ApiWrapper(user).connect(Router()),
  userGroups: new ApiWrapper(userGroup).connect(Router(), 'read create update'),
  userAccounts: new ApiWrapper(userAccount).connect(Router(), 'read create update')
}
