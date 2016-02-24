"use strict";

var util = require('util');

function TitleError(options) {
    Error.call(this);
    Error.captureStackTrace(this, TitleError);
    this.name = this.constructor.name;
    this.message = options.type;
    Object.assign(this, options);
}
util.inherits(TitleError, Error);
module.exports = TitleError;
