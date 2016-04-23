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
      const user = {
        username: `__github_${profile.username}`,
        source: 'github',
        accessToken,
        refreshToken,
        profile,
      };
      db.put(`users/${user.username}`, user, (err) => {
        done(err, err ? null : user);
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
      db.put(`users/${username}`, user, (err) => {
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


// End of login crap


// app.get('/me', (req, res) => res.json(req.user));

app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/public/browse.html`);
});

app.post('/world', checkLoggedIn, (req, res, next) => {
  const world = {
    v: 0,
    owner: req.user.username,
    createdAt: +new Date(),
    data: null
  }
  aan().then((worldId) => {
    db.put(`worlds/${worldId}`, world, (err) => {
      if (err) return next(err);
      res.json({id: worldId})
      res.end()
    })
  })
});

app.put('/world/:id.json', checkLoggedIn, (req, res, next) => {
  const worldId = req.params.id;
  if (!req.body.data) return next(new Error('no data'));

  db.get(`worlds/${worldId}`, (err, world) => {
    if (err) return next(err);
    if (world.owner !== req.user.username) {
      return res.sendStatus(403);
    }
    world.data = req.body.data;
    if (req.body.name) world.name = req.body.name;
    world.modifiedAt = +new Date();
    db.put(
      `worlds/${worldId}`,
      world,
      (err) => {
        if (err) return next(err)
        console.log(`saved ${worldId}`);
        res.end()
      }
    )
  })
});

app.get('/world/:id.json', (req, res, next) => {
  const worldId = req.params.id;
  db.get(`worlds/${worldId}`, (err, world) => {
    if (err) return next(err); // or iuno maybe it's a different error
    if (world.owner !== req.user.username) {
      world.readonly = true;
    }
    res.json(world);
    res.end();
  })
});

app.get('/world/:id', (req, res, next) => {
  res.sendFile(__dirname + '/public/editor.html', {
    headers: {
      'Content-Type': 'text/html'
    }
  });
});

app.get('/worlds', (req, res, next) => {
  const worlds = {};
  db.createReadStream({gte: 'worlds/', lt: 'worlds0'})
    .on('data', (data) => {
      worlds[data.key.replace(/^worlds\//,'')] = data.value;
    })
    .on('error', (err) => {
      next(err)
    })
    .on('end', () => {
      res.json(worlds)
      res.end()
    })
});


require('http').createServer(app).listen(4545);
console.log('listening on 4545');
