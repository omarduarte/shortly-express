var db = require('../config');
var Link = require('./link');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  links: function() {
    return this.hasMany(Link);
  },
  hash: function(callback) {
    var self = this;
    bcrypt.genSalt(10, function(err, salt) {
      bcrypt.hash(self.get('password'), salt, null, function(err, hash) {
        self.set('password', hash);
        callback();
      });
    });
  },
  initialize: function(){
  }
});

module.exports = User;
