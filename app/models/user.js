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

  initialize: function(){
    this.on('creating', this.hashPassword);
  },

  compare: function(password, callback) {
    bcrypt.compare(password, this.get('password'), function(err, isMatch) {
      if(err) {
        console.log('err inside of compare');
        throw err;
      } else {
        callback(isMatch);
      }
    });
  },

  hashPassword: function(){
    var cipher = Promise.promisify(bcrypt.hash);
    return cipher(this.get('password'), null, null).bind(this)
      .then(function(hash) {
        this.set('password', hash);
      }
    );
  }

});

module.exports = User;
