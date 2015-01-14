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
var GithubStrategy = require('passport-github').Strategy;
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

passport.use(new GithubStrategy({
    clientID: '63de983444e9cef7618c',
    clientSecret: '2d31645a65338d346498c9da5af0b140a920f397',
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log('github profile');
    console.log(profile);
    new User({githubId: profile.id }).fetch().then(function (found) {
      if (found) {
        console.log('user already exists');
        return done(null, found.attributes);
      } else {
        var user = new User({
          githubId: profile.id
        });

        user.save().then(function(newUser) {
          Users.add(newUser);
          done(null,newUser);
        });
      }
    });
  }
));


passport.use(new LocalStrategy(
  function(username, password, done) {
    console.log('this has been invoked');
    process.nextTick(function () {

      util.findByUsername(username).then(function (user) {
        if(user) {
          user.compare(password, function(isMatch) {
            if (isMatch) {
              return done(null, user.attributes);
            } else {
              //TODO: call a function that lets the user know the username/password combo they tried does note exist
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

app.get('/', util.restrict,
function(req, res) {
  res.render('index');
});

app.get('/create', util.restrict,
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
    req.logout();
    res.redirect('/');
});

app.get('/links',util.restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',util.restrict,
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch()
  .then(function(found) {
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
      console.log('user already exists');
    } else {
      var user = new User({
        username: username,
        password: password
      });

      user.save().then(function(newUser) {
        Users.add(newUser);
        res.redirect('/login');
      });
    }
  });
});


app.get('/auth/github',
  passport.authenticate('github'));

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.post('/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
  })
);

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
