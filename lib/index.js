'use strict'

const app = require('express')()
const logger = require('morgan')
const bodyParser = require('body-parser')
const cors = require('cors')
const jsonApiErrors = require('jsonapi-errors')

const apiV1 = require('./routes/api-v1')

app.set('jwtSecret', process.env['JWT-SECRET'] || 'webd2')

app.use(logger('dev'))

app.options('*', cors())
app.use(cors())
app.use(function (req, res, next) {
  res.set({
    'Content-Type': 'application/vnd.api+json',
    'Cache-Control': 'private, must-revalidate, max-age=0',
    'Expires': 'Thu, 01 Jan 1970 00:00:00'
  })

  return next()
})

app.use(bodyParser.json()) // httpie
app.use(bodyParser.json({ type: 'application/vnd.api+json' })) // ember-data
app.disable('x-powered-by')
app.disable('etag')

app.use('/api/v1', apiV1)
// send proper json-api formatted errors
app.use(jsonApiErrors)

module.exports = app
