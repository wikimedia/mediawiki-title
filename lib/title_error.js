"use strict";

var util = require('util');

function TitleError(options) {
    var self = this;
    Error.call(self);
    Error.captureStackTrace(self, TitleError);
    self.name = self.constructor.name;
    self.message = options.type;
    Object.keys(options).forEach(function(option) {
        self[option] = options[option];
    });
}
util.inherits(TitleError, Error);
module.exports = TitleError;
