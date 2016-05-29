'use strict'

class Context {
  constructor (options) {
    const defaults = {
      method: 'find',
      type: null,
      ids: null,
      options: {},
      include: [],
      payload: null
    }

    this.request = Object.assign(defaults, options)

    this.response = {
      payload: null
    }
  }
}

module.exports = Context
