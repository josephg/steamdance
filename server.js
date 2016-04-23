const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const phs = require('password-hash-and-salt');

const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser')
const LevelStore = require('level-session-store')(session);

const aan = require('adjective-adjective-animal');

const app = express();
const db = require('level')('db', {
  valueEncoding: 'json'
});

app.use(express.static(`${__dirname}/public`, {extensions:['html', '']}));
app.use(session({
  store: new LevelStore(db),
  secret: 'M2F6AquzZFtrLys6oCloBOFWPc/K',
  resave: false,
  saveUninitialized: false
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// ***** Template junk

app.set('views', './views')
app.set('view engine', 'ejs')

// ***** Passport login junk.

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => done(null, user.username));
passport.deserializeUser(getUser);

function getUser(username, callback) {
  db.get(`users/${username}`, (err, user) => {
    if (err && err.type == 'NotFoundError') {
      err = null; user = null;
    }
    callback(err, user);
  });
}

// Since worlds are just steam.dance/user/world we need to protect some
// usernames.
const reserved = ['user', 'users', 'login', 'logout', 'signup', 'signin', 'signout', 'new', 'delete', 'public', 'local', 'me', 'api'];
const validUsername = name => (
  name.match(/^[a-zA-Z0-9]{3,}$/) && reserved.indexOf(name) === -1
)

function setUser(user, callback) {
  if (!validUsername(user.username)) return callback(Error('invalid name'));
  db.put(`users/${user.username}`, user, callback);
}

passport.use(new LocalStrategy((username, password, done) => {
  getUser(username, (err, user) => {
    if (!user) return done(null, false, { message: 'Incorrect username.' });
    if (err) return done(err);

    phs(password).verifyAgainst(user.hash, (err, verified) => {
      if (err) return done(err);
      if (!verified) return done(null, false, { message: 'Invalid password' });
      return done(null, user);
    });
  });
}));

if (fs.existsSync('github_oauth.json')) {
  passport.use(new GitHubStrategy(require('./github_oauth.json'),
    (accessToken, refreshToken, profile, done) => {
      getUser(profile.username, (err, user) => {
        if (err) return done(err);
        if (user && user.source !== 'github') {
          return done(null, false, {message: 'You have a normal non-oauth account'});
        }

        user = {
          // Github users are in the same namespace.
          username: profile.username,
          source: 'github',
          accessToken,
          refreshToken,
          profile,
        };
        setUser(user, (err) => {
          done(err, err ? null : user);
        });
      });
    }
  ));

  app.get('/github_oauth', passport.authenticate('github', {})); // no scopes.

  app.get('/_github_callback', passport.authenticate('github', {
    failureRedirect: '/login'
  }), (req, res) => res.redirect('/'));
} else {
  console.warn('Could not find github_oauth.json tokens. OAuth login disabled');
}

app.post('/adduser', (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;
  // console.log('adduser', req.body);
  getUser(username, (err, user) => {
    // console.log('user', user);
    if (user) {
      // console.log('already exists');
      return res.redirect('/login');
    }
    phs(password).hash((err, hash) => {
      if (err) return next(err);
      const user = {
        username,
        hash: hash
      };
      setUser(user, (err) => {
        if (err) return next(err);
        req.login(user, (err) => {
          if (err) return next(err);
          res.redirect('/');
        });
      });
    });
  });
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
}));

const checkLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) return res.redirect('/login');
  // if (!req.user) return res.redirect('/login');
  next();
};

app.get('/logout', checkLoggedIn, (req, res, next) => {
  req.logout()
  res.redirect('/')
})

// End of login crap

if (process.env.NODE_ENV !== 'production') {
  app.get('/me', (req, res) => res.json(req.user));
}

app.get('/', (req, res) => {
  res.render('browse', {user: req.user});
});

// Worlds are created on first write by the client. If they're empty they get
// deleted automatically.

const worldKey = params => `worlds/${params.user}/${params.key}`;

function getWorld(params, callback) {
  // if (!params.key.match(/^[a-zA-Z0-9 _\-]+$/)) return callback(Error('invalid world name'));
  db.get(worldKey(params), (err, world) => {
    if (err && err.type == 'NotFoundError') {
      err = null;
      world = {
        v: 0,
        createdAt: Date.now(),
        data: null,
      };
    }

    callback(err, world);
  });
}

app.put('/:user/:key.json', checkLoggedIn, (req, res, next) => {
  if (req.user.username !== req.params.user) return res.sendStatus(403);

  // if (!req.body.data) return next(new Error('no data'));

  getWorld(req.params, (err, world) => {
    if (err) return next(err);
    world.modifiedAt = Date.now();
    world.data = req.body.data;

    db.put(worldKey(req.params), world, err => {
      if (err) return next(err)
      console.log('saved', req.params);
      res.end()
    });
  });
});

app.delete('/:user/:key.json', checkLoggedIn, (req, res, next) => {
  if (req.user.username !== req.params.user) return res.sendStatus(403);
  db.del(worldKey(req.params), err => {
    if (err) return next(err);
    res.sendStatus(200);
  });
});

app.get('/:user/:key.json', (req, res, next) => {
  getWorld(req.params, (err, world) => {
    if (err) return next(err);

    if (!req.user || req.params.user !== req.user.username) {
      world.readonly = true;
    }
    res.json(world);
    res.end();
  })
});

app.get('/:user/:key', (req, res, next) => {
  res.render('editor', {user: req.user})
});

app.get('/worlds', (req, res, next) => {
  const worlds = {};
  db.createReadStream({gte: 'worlds/', lt: 'worlds/~'})
    .on('data', (data) => {
      worlds[data.key.replace(/^worlds\//,'')] = data.value;
      // console.log(worlds);
    })
    .on('error', err => next(err))
    .on('end', () => {
      res.json(worlds)
      res.end()
    });
});

app.get('/new', checkLoggedIn, (req, res) => {
  aan().then(name => res.redirect(`${req.user.username}/${name}`));
});

require('http').createServer(app).listen(4545);
console.log('listening on 4545');
