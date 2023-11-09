// INSPIRED BY https://coderwall.com/p/th6ssq/absolute-paths-require
global.include = (path) => require(`${__dirname}/${path}`);
global.rootpath = __dirname;

const { app_id, app_suite, app_suite_secret, DB, csp_links } =
  include('config/');
const express = require('express');
const path = require('path');
const bodyparser = require('body-parser');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const PgSession = require('connect-pg-simple')(session);

const fs = require('fs');

const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const cookieParser = require('cookie-parser');

const app = express();
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': csp_links,
        'script-src': csp_links,
        'script-src-attr': ["'unsafe-inline'"],
        'style-src': csp_links,
        'connect-src': csp_links,
      },
    },
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin', 'same-origin'],
    },
    xPoweredBy: false,
    strictTransportSecurity: {
      maxAge: 123456,
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'same-origin');
  next();
});

app.set('view engine', 'ejs');
app.set('trust proxy', true); // trust leftmost proxy
app.use(express.static(path.join(__dirname, './public')));
app.use('/scripts', express.static(path.join(__dirname, './node_modules')));
app.use('/config', express.static(path.join(__dirname, './config')));
app.use(bodyparser.json({ limit: '50mb' }));
app.use(bodyparser.urlencoded({ limit: '50mb', extended: true }));
app.use(xss());

const cookie = {
  domain:
    process.env.NODE_ENV === 'production'
      ? 'sdg-innovation-commons.org'
      : undefined,
  httpOnly: true, // THIS IS ACTUALLY DEFAULT
  secure: process.env.NODE_ENV === 'production',
  maxAge: 1 * 1000 * 60 * 60 * 24 * 1, // DEFAULT TO 1 DAY. UPDATE TO 1 YEAR FOR TRUSTED DEVICES
  sameSite: 'lax',
};

const sessionMiddleware = session({
  name: `${app_suite}-session`,
  // secret: 'acclabspadspass',
  secret: `${app_suite}-${app_suite_secret}-pass`,
  store: new PgSession({ pgPromise: DB.general }),
  resave: false,
  saveUninitialized: false,
  cookie,
});

app.use(sessionMiddleware);
app.use(cookieParser(`${app_suite}-${app_suite_secret}-pass`));

function redirectOldUrl(req, res, next) {
  const base = 'sdg-innovation-commons.org';
  const full = `www.${base}`;
  const newHost = `https://${full}/`;
  const hostname = req.get('host');
  if (hostname === full) {
    return next();
  }
  if (hostname === base) {
    return res.redirect(307, `${newHost}${req.originalUrl}`);
  }
  const { session, ip } = req;
  const { uuid, rights } = session;
  const origUrl = encodeURIComponent(req.originalUrl);
  if (uuid) {
    const token = jwt.sign({ uuid, rights, ip }, process.env.APP_SECRET, {
      audience: 'user:known',
      issuer: newHost,
      expiresIn: '1h',
    });
    console.log(`WRAPPING USER uuid:${uuid} rights:${rights} ip:${ip}`);
    return res.redirect(
      307,
      `${newHost}transfer?path=${origUrl}&token=${token}`,
    );
  }
  return res.redirect(307, `https://${full}/${req.originalUrl}`);
}

app.use(redirectOldUrl);

function setAccessControlAllowOrigin(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}

const routes = require('./routes/');

// HEALTH-CHECK + INFO
let versionObj = null;

function getVersionString() {
  return new Promise((resolve) => {
    if (versionObj !== null) {
      resolve(versionObj);
      return;
    }
    fs.readFile('version.txt', (err, data) => {
      if (err) {
        versionObj = {
          name: 'no version available',
          commit: 'unknown',
          date: 'unknown',
          app: `global`,
        };
      } else {
        const lines = data.toString().split(/[\r\n]+/);
        versionObj = {
          name: lines[0] || 'no version available',
          commit: lines[1] || 'unknown',
          date: lines[2] || 'unknown',
          app: `global`,
        };
      }
      resolve(versionObj);
    });
  });
}

app.get('/version/', (req, res) => {
  getVersionString()
    .then((vo) => res.send(vo))
    .catch((err) => {
      console.log(err);
      res.status(500).send({
        name: 'error while reading version',
        commit: 'unknown',
        date: 'unknown',
        app: `global`,
      });
    });
});

// app.get('/', routes.redirect.home, routes.render.login)

app.get('/', routes.redirect.home, routes.redirect.public);

// PUBLIC VIEWS
app.get('/public/', routes.dispatch.public); // THIS COULD BE DEPRECATED
app.get('/:language/public/', routes.dispatch.public); // THIS COULD BE DEPRECATED

app
  .route('/login')
  .get(routes.redirect.home, routes.render.login)
  .post(routes.process.login);
app.get('/logout', routes.process.logout);
app.get('/transfer', routes.process.login);

app.route('/reset/:token').get(routes.redirect.browse, routes.render.login);

app
  .route('/forget-password')
  .get(routes.redirect.browse, routes.render.login)
  .post(routes.process.forgetPassword);

app
  .route('/reset-password')
  .get(routes.redirect.browse, routes.render.login)
  .post(routes.process.updatePassword);

app
  .route('/:language/contribute/:object')
  .get(routes.render.login, routes.dispatch.contribute);
app
  .route('/:language/edit/:object')
  .get(routes.render.login, routes.dispatch.edit);
app
  .route('/:language/view/:object')
  .get(routes.render.login, routes.dispatch.view);
// app.route('/:language/import/:object')
// 	.get(routes.render.login, routes.dispatch.import)
// app.route('/:language/mobilize/:object')
// 	.get(routes.render.login, routes.dispatch.mobilize)

app
  .route('/:language/browse/:object/:space')
  .get(routes.render.login, routes.dispatch.browse)
  .post(routes.render.login, routes.dispatch.browse);

app
  .route('/:language/preview/:object/:space')
  .get(routes.render.login, routes.dispatch.browse);

app
  .route('/:language/print/:object/:space')
  .get(routes.render.login, routes.dispatch.print);

app.get('/:language/analyse/:object', routes.dispatch.analyse); // TO DO

app.post('/check/:object', routes.process.check);

app.post('/save/:object', routes.process.save);
app.post('/generate/:format', routes.process.generate);
app.post('/pin', routes.process.pin);
app.post('/engage', routes.process.engage);
app.post('/comment', routes.process.comment);

app
  .route('/publish/:object')
  .get(routes.process.publish)
  .post(routes.process.publish);
app.get('/unpublish/:object', routes.process.unpublish);
app.post('/share/:object', routes.process.share);
app.get('/forward/:object', routes.process.forward);
app.get('/delete/:object', routes.process.delete);

app
  .route('/request/:object')
  .get(routes.process.request)
  .post(routes.process.request);
app.get('/accept/:object', routes.process.accept);
app.get('/decline/:object', routes.process.decline);

// app.post('/deploy', routes.process.deploy)
// app.get('/demobilize', routes.process.demobilize)

// app.post('/intercept/:method', routes.process.intercept)
app.post('/call/api', routes.process.callapi);

// app.post('/:language/:activity/:object/save', routes.process.save) // THIS PATH SHOULD NOT BE SO COMPLEX

// app.post('/upload/img', upload.array('img'), routes.process.upload)
// app.post('/upload/video', upload.array('video'), routes.process.upload)
// app.post('/upload/pdf', upload.array('pdf'), routes.process.upload)

// app.post('/screenshot', routes.process.screenshot)

// TO DO: UPDATE SCHEMA BELOW
// app.post('/storeImport', routes.render.login, routes.storeImport) // UPDATE DO save/import
app.post('/forwardGeocoding', routes.forwardGeocoding); // UPDATE TO geocode/forward
app.post('/reverseGeocoding', routes.reverseGeocoding); // UPDATE TO geocode/forward

// API
app
  .route('/apis/:action/:object')
  .get(setAccessControlAllowOrigin, routes.dispatch.apis)
  .post(setAccessControlAllowOrigin, routes.dispatch.apis);

app.get('/api/skills', routes.api.skills); // TO DO: THIS SHOULD BE DEPRECATED
app.get('/api/methods', routes.api.methods); // TO DO: THIS SHOULD BE DEPRECATED
app
  .route('/api/datasources')
  .get(routes.api.datasources)
  .post(routes.api.datasources);

// INSTANCES
app
  .route('/:language/:instance')
  .get(routes.render.login, routes.dispatch.browse);

app.get('*', routes.notfound);

// RUN THE SERVER
app.listen(process.env.PORT || 2000, (_) => {
  console.log(`the app is running on port ${process.env.PORT || 2000}`);
  getVersionString()
    .then((vo) => {
      console.log('name', vo.name);
      console.log('commit', vo.commit);
      console.log('deployed', vo.date);
      console.log('app_id', app_id);
    })
    .catch((err) => console.log(err));
});
