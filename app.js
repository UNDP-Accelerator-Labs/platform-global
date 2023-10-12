// INSPIRED BY https://coderwall.com/p/th6ssq/absolute-paths-require
global.include = path => require(`${__dirname}/${path}`)
global.rootpath = __dirname

const { csp_links, app_suite, app_suite_secret, DB } = include('config/')
const { loginRateLimiterMiddleware } = include('routes/helpers/');
const express = require('express')
const path = require('path')
const bodyparser = require('body-parser')
const session = require('express-session')
const pgSession = require('connect-pg-simple')(session)

const fs = require('fs')

const { spawn } = require('child_process')

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
		'frame-src': ['https://youtube.com']
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

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', 'same-origin');
  next();
});

app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, './public')))
app.use('/scripts', express.static(path.join(__dirname, './node_modules')))
app.use('/config', express.static(path.join(__dirname, './config')))
app.use(bodyparser.json({ limit: '50mb' }))
app.use(bodyparser.urlencoded({ limit: '50mb', extended: true }))
app.use(xss());

if (process.env.NODE_ENV === 'production') {
	app.set('trust proxy', 1) // trust first proxy
}

const sessionMiddleware = session({
	name: `${app_suite}-session`,
	// secret: 'acclabspadspass',
	secret: `${app_suite}-${app_suite_secret}-pass`,
	store: new pgSession({ pgPromise: DB.general }),
	resave: false,
	saveUninitialized: false,
	cookie: {
		httpOnly: true, // THIS IS ACTUALLY DEFAULT
		secure: process.env.NODE_ENV === 'production',
		maxAge: 1000 * 60 * 60 * 24 * 1, // 1 DAY
		sameSite: 'lax',
		// domain: process.env.NODE_ENV === 'production' ? '.azurewebsites.net' : 'localhost'
	}
})

app.use(sessionMiddleware)
app.use(cookieParser(`${app_suite}-${app_suite_secret}-pass`));

const routes = require('./routes/')

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
					'name': 'no version available',
					'commit': 'unknown',
					'app': `global`,
				};
			} else {
				const lines = data.toString().split(/[\r\n]+/);
				versionObj = {
					'name': lines[0] || 'no version available',
					'commit': lines[1] || 'unknown',
					'app': `global`,
				};
			}
			resolve(versionObj);
		});
	});
}

app.get('/version/', (req, res) => {
	getVersionString().then(vo => res.send(vo)).catch(err => {
		console.log(err);
		res.status(500).send({
			'name': 'error while reading version',
			'commit': 'unknown',
			'app': `global`,
		})
	});
});

// app.get('/', routes.redirect.home, routes.render.login)

app.get('/', routes.redirect.home, routes.check.login, routes.redirect.public)

// PUBLIC VIEWS
app.get('/public/', routes.dispatch.public) // THIS COULD BE DEPRECATED
app.get('/:language/public/', routes.dispatch.public) // THIS COULD BE DEPRECATED

app.route('/login')
	.get(routes.redirect.home, routes.render.login)
	.post(loginRateLimiterMiddleware, routes.process.login)
app.route('/logout/:session')
	.get(routes.process.logout)
	.post(routes.process.logout);

app.route('/reset/:token')
	.get(routes.redirect.browse, routes.render.login)

app.route('/forget-password')
	.get(routes.redirect.browse, routes.render.login)
	.post(routes.process.forgetPassword)

app.route('/reset-password')
	.get(routes.redirect.browse, routes.render.login)
	.post(routes.process.updatePassword)

app.route('/confirm-email/:token').get(routes.update.email);

app
  .route('/confirm-device')
  .get(routes.confirmdevice)
  .post(routes.process.confirmDevice);

app.route('/resend-otp-code').get(routes.process.resendCode);

app.route('/remove-trusted-device').post(routes.check.login, routes.process.removeDevice);

app.route('/:language/contribute/:object')
	.get(routes.render.login, routes.check.login, routes.dispatch.contribute)
app.route('/:language/edit/:object')
	.get(routes.render.login, routes.check.login, routes.dispatch.edit)
app.route('/:language/view/:object')
	.get(routes.render.login, routes.check.login, routes.dispatch.view)
// app.route('/:language/import/:object')
// 	.get(routes.render.login, routes.dispatch.import)
// app.route('/:language/mobilize/:object')
// 	.get(routes.render.login, routes.dispatch.mobilize)

app.route('/:language/browse/:object/:space')
	.get(routes.render.login, routes.dispatch.browse)
	.post(routes.render.login, routes.check.login, routes.dispatch.browse)

app.route('/:language/preview/:object/:space')
	.get(routes.render.login, routes.check.login, routes.dispatch.browse)

app.route('/:language/print/:object/:space')
	.get(routes.render.login, routes.check.login, routes.dispatch.print)

app.get('/:language/analyse/:object', routes.check.login, routes.dispatch.analyse) // TO DO

app.post('/check/:object', routes.check.login, routes.process.check)

app.post('/save/:object', routes.check.login, routes.process.save)
app.post('/generate/:format', routes.check.login, routes.process.generate)
app.post('/pin', routes.check.login, routes.process.pin)
app.post('/engage', routes.check.login, routes.process.engage)
app.post('/comment', routes.check.login, routes.process.comment)

app.route('/publish/:object')
	.get(routes.check.login, routes.process.publish)
	.post(routes.check.login, routes.check.login, routes.process.publish)
app.get('/unpublish/:object', routes.check.login, routes.process.unpublish)
app.post('/share/:object', routes.check.login, routes.process.share)
app.get('/forward/:object', routes.check.login, routes.process.forward)
app.get('/delete/:object',routes.check.login,  routes.process.delete)

app.route('/request/:object')
	.get(routes.check.login, routes.process.request)
	.post(routes.check.login, routes.process.request)
app.get('/accept/:object', routes.check.login, routes.process.accept)
app.get('/decline/:object', routes.check.login, routes.process.decline)


// app.post('/deploy', routes.process.deploy)
// app.get('/demobilize', routes.process.demobilize)

// app.post('/intercept/:method', routes.process.intercept)
app.post('/call/api', routes.process.callapi)

// app.post('/:language/:activity/:object/save', routes.process.save) // THIS PATH SHOULD NOT BE SO COMPLEX


// app.post('/upload/img', upload.array('img'), routes.process.upload)
// app.post('/upload/video', upload.array('video'), routes.process.upload)
// app.post('/upload/pdf', upload.array('pdf'), routes.process.upload)

// app.post('/screenshot', routes.process.screenshot)


// TO DO: UPDATE SCHEMA BELOW
// app.post('/storeImport', routes.render.login, routes.storeImport) // UPDATE DO save/import
app.post('/forwardGeocoding', routes.forwardGeocoding) // UPDATE TO geocode/forward
app.post('/reverseGeocoding', routes.reverseGeocoding) // UPDATE TO geocode/forward


// API
app.route('/apis/:action/:object')
	.get(routes.check.login, routes.dispatch.apis)
	.post(routes.check.login, routes.dispatch.apis)

app.get('/api/skills', routes.check.login, routes.api.skills) // TO DO: THIS SHOULD BE DEPRECATED
app.get('/api/methods', routes.check.login, routes.api.methods) // TO DO: THIS SHOULD BE DEPRECATED
app.route('/api/datasources')
	.get(routes.check.login, routes.api.datasources)
	.post(routes.check.login, routes.api.datasources)

// INSTANCES
app.route('/:language/:instance')
	.get(routes.render.login, routes.check.login, routes.dispatch.browse)

app.get('/module-error', routes.error);
app.get('*', routes.notfound)

app.use((err, req, res, next) => {
	res.status(500).redirect('/module-error');
});
// RUN THE SERVER
const server = app.listen(process.env.PORT || 2000, _ => console.log(`the app is running on port ${process.env.PORT || 2000}`))
