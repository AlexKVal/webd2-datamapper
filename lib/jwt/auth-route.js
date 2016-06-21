'use strict'

const jwt = require('jsonwebtoken')

const user = require('../models/registry').model('user')

// TODO rights system
function getUserRole (user) {
  switch (user.name) {
    case 'D2Admin':
      return 'super'
    case 'Admin':
      return 'admin'
    default:
      return 'user'
  }
}

/**
 * POST route
 * id and password => { token: JWT-Token }
 */
module.exports = function authenticateRoute (req, res, next) {
  user.passwordVerify(req.body.id, req.body.password)
  .then((user) => {
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name
      },
      req.app.get('jwtSecret'),
      { expiresIn: 60 * 60 * 12 } // 12h
    )

    // Ember-client uses this as 'session.data.authenticated'
    // and gets all needed info from it
    const authenticated = {
      token,
      userId: user.id,
      name: user.name,
      role: getUserRole(user)
    }

    res.status(201).json(authenticated)
  })
  .catch((err) => next(err))
}
