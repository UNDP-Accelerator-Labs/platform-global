// INSPIRED BY https://coderwall.com/p/th6ssq/absolute-paths-require
global.include = path => require(`${__dirname}/${path}`)
global.rootpath = __dirname

const { app_title_short, app_suite, app_suite_secret, DB } = include('config/')
const express = require('express')
const path = require('path')
const bodyparser = require('body-parser')
const session = require('express-session')
const pgSession = require('connect-pg-simple')(session)
const cors = require('cors');

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
		maxAge: 1000 * 60 * 60 * 24 * 5, // 5 DAY
		sameSite: 'lax',
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

app.route('/:language/browse/:object/:space')
	.get(routes.render.login, routes.dispatch.browse)
	.post(routes.render.login, routes.dispatch.browse)

app.route('/:language/preview/:object/:space')
	.get(routes.render.login, routes.dispatch.browse)

app.route('/:language/print/:object/:space')
	.get(routes.render.login, routes.dispatch.print)

app.post('/check/:object', routes.process.check) 

app.post('/save/:object', routes.process.save) 
app.post('/pin', routes.process.pin) 
app.post('/engage', routes.process.engage) 

// API
app.route('/apis/:action/:object')
	.get(routes.dispatch.apis)
	.post(routes.dispatch.apis)

app.get('/module-error', routes.error)
app.get('*', routes.notfound)

// RUN THE SERVER
const server = app.listen(process.env.PORT || 4000, _ => console.log(`the app is running on port ${process.env.PORT || 3000}`))
