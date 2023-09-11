const fs = require('fs')
const { datastructures } = include('routes/helpers/')

if (!exports.redirect) { exports.redirect = {} }
if (!exports.render) { exports.render = {} }
if (!exports.process) { exports.process = {} }
if (!exports.public) { exports.public = {} }
if (!exports.private) { exports.private = {} }
if (!exports.dispatch) { exports.dispatch = {} }

/* =============================================================== */
/* =========================== LOGIN ============================= */
/* =============================================================== */
exports.render.login = require('./login/').render
exports.process.login = require('./login/').process
exports.process.logout = require('./login/').logout
exports.dispatch.home = require('./login/').home
exports.redirect.home = require('./login/').redirect
exports.redirect.browse = require('./redirect/').browse

exports.redirect.public = (req, res) => res.redirect('/home')
exports.dispatch.public = require('./login/').public

exports.process.forgetPassword = require('./login/').forgetPassword
exports.process.getResetToken = require('./login/').getResetToken
exports.process.updatePassword = require('./login/').updatePassword

/* =============================================================== */
/* =========================== BROWSE ============================ */
/* =============================================================== */
exports.dispatch.browse = require('./browse/')
exports.dispatch.print = require('./print/')

/* =============================================================== */
/* ====================== SAVING MECHANISMS ====================== */
/* =============================================================== */
exports.process.check = require('./check/').main
exports.process.save = require('./save/').main

exports.process.pin = require('./engage/').pin
exports.process.engage = require('./engage/').engage

exports.dispatch.edit = require('./edit/').main


/* =============================================================== */
/* ============================= API ============================= */
/* =============================================================== */
exports.dispatch.apis = require('./apis/')

if (!exports.api) exports.api = {}

exports.notfound = async(req, res) => {
	const metadata = await datastructures.pagemetadata({ req, res })
	res.render('error-404', metadata)
}

exports.error = async(req, res) => {
	const metadata = await datastructures.pagemetadata({ req, res })
	res.render('error-500', metadata)
}

exports.getVersionString = (req, res) => {
	fs.readFile('version.txt', (err, data) => {
		if (err) {
			return res.status(500).send({
				'name': 'error while reading version',
				'commit': 'unknown',
				'app': `global`,
			})
		} else {
			const lines = data.toString().split(/[\r\n]+/);
			return res.status(200).send({
				'name': lines[0] || 'no version available',
				'commit': lines[1] || 'unknown',
				'app': `global`,
			})
		}
	});
}

String.prototype.simplify = function () {
	return this.valueOf().replace(/[^\w\s]/gi, '').replace(/\s/g, '').toLowerCase()
}
String.prototype.capitalize = function () {
	return this.valueOf().charAt(0).toUpperCase() + this.valueOf().slice(1)
}
String.prototype.removeAccents = function () {
	// CREDIT TO https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
	return this.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
String.prototype.replacePunctuation = function (replacement) {
	return this.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, replacement).replace(/\s{2,}/g, ' ') // THIS KEEPS COMMAS
}
