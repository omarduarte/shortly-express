var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser()); //this line may be redundant with the line below
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

//for creating sessions
app.use(cookieParser('this is our secret in cookieParser'));
app.use(session());


function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/logout', function(req, res){
    req.session.destroy(function(){
        res.redirect('/');
    });
});

app.get('/links',restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',restrict,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  var testLink = new Link({ url: uri });
  console.log(testLink);
  testLink.fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

app.post('/signup',
function(req, res) {

  var username = req.body.username;
  var password = req.body.password;

  new User({username: username }).fetch().then(function (found) {
    if (found) {
      // TODO: Let the client know that the username already exists
      console.log('found');
    } else {
      var user = new User({
        username: username,
        password: password
      });

      user.save().then(function(newUser) {
        Users.add(newUser);
        // TODO: Redirect to Login Page
        res.redirect('/login');
      });
    }
  });
});

app.post('/login', function(req, res) {

  var username = req.body.username;
  var password = req.body.password;

  new User({username: username }).fetch().then(function (found) {
    if(found) {
      if (found.attributes.password === password) {
        console.log('you passed!');
        req.session.regenerate(function(){
          req.session.user = username;
          res.redirect('/');
        });
      } else {
        //call a function that lets the user know the username/password combo they tried does note exist
        console.log('wrong password or user does not exist');
      }
    } else {
      console.log('wrong password or user does not exist');
    }
  });

});

// Define /login post route

/************************************************************/
// Write your authentication routes here
/************************************************************/
//tests
//3. salting and hashing
//sessions:
  //time to live for tokens
  //saving tokens in database along with their expiration time
  //allowing a user to have multiple tokens (across multiple devices)



//** 1. store username and password in plain text
//** define user flow in terms of login page, signup page
//**2. sessions and tokens stored on the cookie
//**logout
/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
