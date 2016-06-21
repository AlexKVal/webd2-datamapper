'use strict'

const apiv1 = require('express').Router()

const api = require('../api')

/**
 * Public routes
 */
apiv1.use('/user-groups', api.userGroups)

// for hasMany apiFetchMany({withRelated: false}) testing
apiv1.use('/users', api.users)

// generate jwt-token
apiv1.post('/auth', require('../jwt/auth-route'))

/**
 ****************************************************************
 * All routes beneath are protected
 ****************************************************************
 */
apiv1.use(require('../jwt/middleware'))

/**
 * Here go all authenticated users' routes (waiters)
 */

 /**
  * Here go administrator' routes (bartenders and cachiers too)
  */
// apiv1.use(adminsMiddleware)

/**
 * And the last routes are only for super-admins
 */
apiv1.use(require('../middleware-rights/super-admins-only'))

apiv1.use('/user-accounts', api.userAccounts)

module.exports = apiv1
