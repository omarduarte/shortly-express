var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var flash = require('connect-flash');


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
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());



/*
 *
 *   PASSPORT STUFF (BEGIN)
 *
 */

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  util.findById(id).then(function (found) {
    if (found) {
      done(null, found.attributes);
    } else {
      done(new Error('User ' + id + ' does not exist'));
    }
  });
});


// Use the LocalStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a username and password), and invoke a callback
//   with a user object.  In the real world, this would query a database;
//   however, in this example we are using a baked-in set of users.
passport.use(new LocalStrategy(
  function(username, password, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // Find the user by username.  If there is no user with the given
      // username, or the password is not correct, set the user to `false` to
      // indicate failure and set a flash message.  Otherwise, return the
      // authenticated `user`.


      // findByUsername(username, function(err, user) {
      //   if (err) { return done(err); }
      //   if (!user) { return done(null, false, { message: 'Unknown user ' + username }); }
      //   if (user.password != password) { return done(null, false, { message: 'Invalid password' }); }
      //   return done(null, user);
      // });€€

      util.findByUsername(username).then(function (user) {
        if(user) {
          bcrypt.compare(password, user.get('password'), function(err, result) {
            if (result) {
              console.log('done inside of user:',done);
              console.log('user attributes', user.attributes);
              return done(null, user.attributes);
            } else {
              //call a function that lets the user know the username/password combo they tried does note exist
              console.log('wrong password or user does not exist');
              return done(null, false, { message: 'Invalid username or password' });
            }
          });
        } else {
          return done(null, false, { message: 'Invalid username or password' });
        }
      });

    });
  }
));

/*
 *
 *   PASSPORT STUFF (END)
 *
 */


function restrict(req, res, next) {
  console.log('inside of restrict');
  console.log('req', req.session);
  if (req.isAuthenticated()) {
    console.log('inside of true');
    next();
  } else {
    console.log('inside of false in restrict');
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

      user.hash(function() {
        user.save().then(function(newUser) {
          Users.add(newUser);
          res.redirect('/login');
        });
      });
    }
  });
});

app.post('/login',
  passport.authenticate('local', { successRedirect: '/',
                                   failureRedirect: '/login' }));

// app.post('/login',
//   passport.authenticate('local'),
//   function(req, res) {
//     res.redirect('/');
//   }
// );

// Define /login post route

/************************************************************/
// Write your authentication routes here
/************************************************************/
//talk through how we would implement everything in extra credit and nightmare modes
//1. Sessions manually
//2. database stuff- each user gets their own links
//3. oauth- log in with github credentials
//sessions:
  //time to live for tokens
  //saving tokens in database along with their expiration time
  //allowing a user to have multiple tokens (across multiple devices)



//** 1. store username and password in plain text
//** define user flow in terms of login page, signup page
//**2. sessions and tokens stored on the cookie
//**logout
//**tests
//**3. salting and hashing
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
