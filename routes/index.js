const { app_title, DB } = include('config/')
const helpers = include('routes/helpers/')
// const request = require('request')
const format = require('./formatting.js')
const path = require('path')
const fs = require('fs')
// const mime = require('mime')
const Jimp = require('jimp')
const { execFile } = require('child_process')
const fetch = require('node-fetch')
const Pageres = require('pageres') // THIS IS FOR SCREENSHOTS
const turf = require('@turf/turf')
const archiver = require('archiver')


if (!exports.redirect) { exports.redirect = {} }
if (!exports.render) { exports.render = {} }
if (!exports.process) { exports.process = {} }
if (!exports.public) { exports.public = {} }
if (!exports.private) { exports.private = {} }
if (!exports.dispatch) { exports.dispatch = {} }
if (!exports.update) { exports.update = {} }
if (!exports.check) { exports.check = {} }

exports.forwardGeocoding = require('./helpers/geo/').forwardcode.render
// (req, res) => {
// 	const { locations, list } = req.body || {}
// 	const { country } = req.session || {}

// 	const promises = geocode(locations, country.lnglat, list, 'forward')
// 	Promise.all(promises)
// 	.then(data => res.json(data))
// 	.catch(err => {
// 		console.log(err)
// 		res.json({ status: 500, message: 'Oops! Something went wrong while searching for locations.' })
// 	})
// }
exports.reverseGeocoding = require('./helpers/geo/').reversecode.render

// (req, res) => {
// 	const { locations, list } = req.body || {}
// 	const { country } = req.session || {}

// 	const promises = geocode(locations, country.lnglat, list, 'reverse')
// 	Promise.all(promises)
// 	.then(data => res.json(data))
// 	.catch(err => {
// 		console.log(err)
// 		res.json({ status: 500, message: 'Oops! Something went wrong while searching for locations.' })
// 	})
// }
// function geocode (locations, centerpoint, list = false, dir = 'forward') { // FOR NOW WE ONLY DO FORWARD GEOCODING
// 	console.log('pay attention to geocode')
// 	return locations.map(l => {
// 		return new Promise(resolve => {
// 			if (dir === 'forward') {
// 				if (!l || typeof l !== 'string') {
// 					const obj = {}
// 					obj.input = l
// 					obj.found = false
// 					obj.centerpoint = centerpoint
// 					obj.caption = `No location was found for <strong>${l}</strong>.` // TO DO: TRANSLATE
// 					resolve(obj)
// 				} else {
// 					setTimeout(_ => {
// 						l_formatted = l.removeAccents().replacePunctuation(', ').trim()

// 						fetch(`https://api.opencagedata.com/geocode/v1/json?q=${l_formatted}&key=${process.env.OPENCAGE_API}`)
// 						.then(response => response.json())
// 						.then(data => {
// 							const obj = {}
// 							obj.input = l
// 							if (data.results.length) {
// 								if (!list) {
// 									const location = data.results[0] // NOTE CONFIDENCE IS SOMETHING ELSE: https://opencagedata.com/api#ranking
// 									obj.centerpoint = { lat: +location.geometry.lat, lng: +location.geometry.lng }
// 								} else {
// 									obj.locations = data.results
// 								}
// 								obj.found = true
// 								obj.caption = `<strong>${l.trim().capitalize()}</strong> found using <a href='https://opencagedata.com/credits' target='_blank'>OpenCage Geocoder</a> | &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap contributors</a>` // TO DO: TRANSLATE
// 							} else {
// 								obj.found = false
// 								obj.centerpoint = centerpoint
// 								obj.caption = `No location was found for <strong>${l.trim().capitalize()}</strong>.` // TO DO: TRANSLATE
// 							}
// 							resolve(obj)
// 						}).catch(err => console.log(err))
// 					}, 1000)
// 				}
// 			} else if (dir === 'reverse') {
// 				if (!l || !Array.isArray(l) || l.length !== 2 || !l.every(d => !isNaN(d))) {
// 					console.log('does not meet requirements')
// 					const obj = {}
// 					obj.input = l
// 					obj.found = false
// 					obj.caption = `No location was found for <strong>${l}</strong>.` // TO DO: TRANSLATE
// 					resolve(obj)
// 				} else {
// 					setTimeout(_ => {
// 						l_formatted = l.join('+')

// 						fetch(`https://api.opencagedata.com/geocode/v1/json?q=${l_formatted}&key=${process.env.OPENCAGE_API}`)
// 						.then(response => response.json())
// 						.then(data => {
// 							const obj = {}
// 							obj.input = l
// 							if (data.results.length) {
// 								if (!list) {
// 									const location = data.results[0] // NOTE CONFIDENCE IS SOMETHING ELSE: https://opencagedata.com/api#ranking
// 									obj.formatted = location.formatted
// 								} else {
// 									obj.locations = data.results
// 									obj.formatted = data.results.map(d => d.formatted)
// 								}
// 								obj.found = true
// 								obj.caption = `Location name${locations.length !== 1 ? 's' : ''} found using <a href='https://opencagedata.com/credits' target='_blank'>OpenCage Geocoder</a> | &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap contributors</a>` // TO DO: TRANSLATE
// 							} else {
// 								obj.found = false
// 								obj.caption = `No location was found for <strong>${l}</strong>.` // TO DO: TRANSLATE
// 							}
// 							resolve(obj)
// 						}).catch(err => console.log(err))
// 					}, 1000)
// 				}
// 			}
// 		})
// 	})
// }




exports.process.callapi = (req, res) => {
	const { uri, method, key, expect } = req.body || {}
	const headers = {
		'Accept': 'application/*',
		'Content-Type': 'application/*',
		'X-Requested-With': 'XMLHttpRequest',
		'x-access-token': process.env[key]
	}

	fetch(uri, { method: method, headers: headers })
		.then(response => {
			if (expect === 'json') return response.json()
			else if (['blob', 'image', 'file'].includes(expect)) return response.blob()
			else return response
		}).then(result => {
			if (expect === 'json') res.json(result)
			else if (['blob', 'image', 'file'].includes(expect)) {
				// BASED ON https://stackoverflow.com/questions/52665103/using-express-how-to-send-blob-object-as-response
				res.type(result.type)
				result.arrayBuffer().then(buf => {
					res.send(Buffer.from(buf))
				})
			}
			else res.send(result)
		}).catch(err => console.log(err))
}

/* =============================================================== */
/* =========================== LOGIN ============================= */
/* =============================================================== */
exports.check.login = require('./login/').check
exports.render.login = require('./login/').render
exports.process.login = require('./login/').process
exports.process.logout = require('./logout/')
// exports.redirect.home = require('./redirect/').home
exports.redirect.home = require('./login/').redirect
exports.redirect.browse = require('./redirect/').browse

exports.redirect.public = (req, res) => res.redirect('/public')
exports.dispatch.public = require('./login/').public

exports.process.forgetPassword = require('./login/').forgetPassword
exports.process.getResetToken = require('./login/').getResetToken
exports.process.updatePassword = require('./login/').updatePassword

exports.process.confirmDevice = require('./login').confirmDevice
exports.process.resendCode = require('./login').resendCode
exports.process.removeDevice = require('./login').removeDevice

/* =============================================================== */
/* =========================== BROWSE ============================ */
/* =============================================================== */
exports.dispatch.browse = require('./browse/')

exports.dispatch.print = require('./print/')

/* =============================================================== */
/* ========================= MOBILIZE ============================ */
/* =============================================================== */
// THIS DOES NOT SEEM TO RETURN ANYTHING
exports.dispatch.analyse = (req, res) => {
	const { uuid, rights } = req.session || {}
	const { object } = req.params || {}
	const language = helpers.checklanguage(req.params?.language || req.session.language)

	if (object === 'mobilization') {
		compileMobilization(req, res)
	}
}
function compileMobilization (req, res) {
	const { id } =  req.query || {}

	Promise.all(DB.conns.map(conn => {
		conn.tx(t => {
			const batch = []
			batch.push(t.one(`
				SELECT t.sections FROM mobilizations m
				INNER JOIN templates t
					ON m.template = t.id
				WHERE m.id = $1
			;`, [id]))
			// batch.push(t.any(`
			// 	SELECT p.id, p.title, p.sections FROM mobilization_contributions mc
			// 	INNER JOIN pads p
			// 		ON mc.pad = p.id
			// 	WHERE mc.id = $1
			// ;`, [id]))
			batch.push(t.any(`
				SELECT p.id, p.title, p.sections FROM pads p
				WHERE p.id = 134
			;`))
			return t.batch(batch)
		}).then(results => {
			const [ template, pads ] = results

			console.log(template.sections)
			pads.forEach(d => console.log(d.id, d.title, d.sections))
			pads.forEach(d => console.log(d.id, d.title, d.sections.map(c => c.structure)))
			pads.forEach(d => console.log(d.id, d.title, d.sections.map(c => c.items)))
		}).catch(err => console.log(err))
	})).then(_ => console.log('returned all promises'))
	.catch(err => console.log(err))
}
/* =============================================================== */
/* ============================ PADS ============================= */
/* =============================================================== */
exports.dispatch.contribute = require('./contribute/').main // THIS SHOULD NOT BE NEEDED
exports.dispatch.edit = require('./edit/').main
exports.dispatch.view = require('./view/').main


/* =============================================================== */
/* ====================== SAVING MECHANISMS ====================== */
/* =============================================================== */
exports.update.email = require('./save/contributor/services').updateNewEmail
exports.process.check = require('./check/').main
exports.process.save = require('./save/').main
exports.process.generate = require('./generate/').main
exports.process.delete = require('./delete/').main

exports.process.publish = require('./publish/').publish
exports.process.unpublish = require('./publish/').unpublish

exports.process.share = require('./share/').share

exports.process.forward = require('./forward/').main

exports.process.pin = require('./engage/').pin
// exports.process.unpin = require('./engage/').unpin

exports.process.engage = require('./engage/').engage
exports.process.comment = require('./engage/').comment

exports.process.request = require('./request/').main
exports.process.accept = require('./accept/').accept
exports.process.decline = require('./accept/').decline


/* =============================================================== */
/* ============================= API ============================= */
/* =============================================================== */
exports.dispatch.apis = require('./apis/')

if (!exports.api) exports.api = {}
// THE TAGS APIS SHOULD BE DEPRECATED FOR NOW
exports.api.skills = (req, res) => {
	DB.general.any(`
		SELECT id, category, name FROM skills ORDER BY category, name
	;`).then(results => res.status(200).json(results))
	.catch(err => res.status(500).send(err))
}
exports.api.methods = (req, res) => {
	DB.general.any(`
		SELECT id, name FROM methods ORDER BY name
	;`).then(results => res.status(200).json(results))
	.catch(err => res.status(500).send(err))
}
exports.api.datasources = (req, res) => {
	if (req.method === 'GET') {
		DB.general.any(`
			SELECT d.id, d.name, d.description, u.iso3 FROM datasources d
			LEFT JOIN users u
				ON u.uuid = d.contributor
		;`).then(results => res.status(200).json(results))
		.catch(err => res.status(500).send(err))
	} else if (req.method === 'POST') {
		const { uuid } = req.session || {}
		const { tag } = req.body || {}

		DB.general.one(`
			INSERT INTO datasources (name, contributor)
			VALUES ($1, $2)
				ON CONFLICT ON CONSTRAINT datasources_name_key
				DO NOTHING
			RETURNING uuid, name
		;`, [ tag.toLowerCase(), uuid || null ])
		.then(result => res.status(200).json(result))
		.catch(err => res.status(500).send(err))
	}
}



exports.notfound = async(req, res) => {
	const metadata = await helpers.datastructures.pagemetadata({ req, res })
	res.render('error-404', metadata)
}

exports.error = async(req, res) => {
	const metadata = await helpers.datastructures.pagemetadata({ req, res })
	res.render('error-500', metadata)
}

exports.confirmdevice = async(req, res) => {
	const { originalUrl } = req || {}
	const { errormessage, successmessage, page_message } = req.session || {}

	const metadata = await helpers.datastructures.pagemetadata({ req, res })
	const data = Object.assign(metadata, { originalUrl, errormessage, successmessage, page_message })
console.log('data ', data)
	return res.render('confirm-device', data)
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
