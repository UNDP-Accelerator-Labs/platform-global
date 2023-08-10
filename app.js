// INSPIRED BY https://coderwall.com/p/th6ssq/absolute-paths-require
global.include = path => require(`${__dirname}/${path}`)
global.rootpath = __dirname

const { app_title_short, app_suite, app_suite_secret, DB } = include('config/')
const express = require('express')
const path = require('path')
const bodyparser = require('body-parser')
const session = require('express-session')
const pgSession = require('connect-pg-simple')(session)

const multer = require('multer')
const upload = multer({ dest: './tmp' })
const fs = require('fs')
const cors = require('cors');

const { spawn } = require('child_process')

const app = express()

// Enable CORS for all routes
app.use(cors());

app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, './public')))
app.use('/scripts', express.static(path.join(__dirname, './node_modules')))
app.use('/config', express.static(path.join(__dirname, './config')))
app.use(bodyparser.json({ limit: '50mb' }))
app.use(bodyparser.urlencoded({ limit: '50mb', extended: true }))

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

const routes = require('./routes/')

app.get('/version/', routes.getVersionString )

app.get('/', routes.redirect.home, routes.redirect.public)

// PUBLIC VIEWS
app.get('/public/', routes.dispatch.public) // THIS COULD BE DEPRECATED
app.get('/:language/public/', routes.dispatch.public) // THIS COULD BE DEPRECATED

app.route('/login')
	.get(routes.redirect.home, routes.render.login)
	.post(routes.process.login)
app.get('/logout', routes.process.logout)

app.route('/reset/:token')
	.get(routes.redirect.browse, routes.render.login)

app.route('/forget-password')
	.get(routes.redirect.browse, routes.render.login)
	.post(routes.process.forgetPassword)

app.route('/reset-password')
	.get(routes.redirect.browse, routes.render.login)
	.post(routes.process.updatePassword)

app.route('/:language/contribute/:object')
	.get(routes.render.login, routes.dispatch.contribute)
app.route('/:language/edit/:object')
	.get(routes.render.login, routes.dispatch.edit)
app.route('/:language/view/:object')
	.get(routes.render.login, routes.dispatch.view)
// app.route('/:language/import/:object')
// 	.get(routes.render.login, routes.dispatch.import)
// app.route('/:language/mobilize/:object')
// 	.get(routes.render.login, routes.dispatch.mobilize)

app.route('/:language/browse/:object/:space')
	.get(routes.render.login, routes.dispatch.browse)
	.post(routes.render.login, routes.dispatch.browse)

app.route('/:language/preview/:object/:space')
	.get(routes.render.login, routes.dispatch.browse)

app.route('/:language/print/:object/:space')
	.get(routes.render.login, routes.dispatch.print)

app.get('/:language/analyse/:object', routes.dispatch.analyse) // TO DO

app.post('/check/:object', routes.process.check)

app.post('/save/:object', routes.process.save)
app.post('/generate/:format', routes.process.generate)
app.post('/pin', routes.process.pin)
app.post('/engage', routes.process.engage)
app.post('/comment', routes.process.comment)

app.route('/publish/:object')
	.get(routes.process.publish)
	.post(routes.process.publish)
app.get('/unpublish/:object', routes.process.unpublish)
app.post('/share/:object', routes.process.share)
app.get('/forward/:object', routes.process.forward)
app.get('/delete/:object', routes.process.delete)

app.route('/request/:object')
	.get(routes.process.request)
	.post(routes.process.request)
app.get('/accept/:object', routes.process.accept)
app.get('/decline/:object', routes.process.decline)


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
	.get(routes.dispatch.apis)
	.post(routes.dispatch.apis)

app.get('/api/skills', routes.api.skills) // TO DO: THIS SHOULD BE DEPRECATED
app.get('/api/methods', routes.api.methods) // TO DO: THIS SHOULD BE DEPRECATED
app.route('/api/datasources')
	.get(routes.api.datasources)
	.post(routes.api.datasources)

// INSTANCES
app.route('/:language/:instance')
	.get(routes.render.login, routes.dispatch.browse)

app.get('*', routes.notfound)

// RUN THE SERVER
const server = app.listen(process.env.PORT || 2000, _ => console.log(`the app is running on port ${process.env.PORT || 2000}`))
