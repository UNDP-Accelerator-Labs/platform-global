const { app_title, app_title_short, app_languages, modules, DB, app_base_host } = include('config/')
const { checklanguage, datastructures, join } = include('routes/helpers/')
const jwt = require('jsonwebtoken')
const getResetToken = require('./forget-password').getResetToken
const {deviceInfo, sendDeviceCode } = require('./device-info')

exports.render = async (req, res, next) => {
	const token = req.body.token || req.query.token || req.headers['x-access-token']
	const { originalUrl, path } = req || {}
	const { object, space, instance } = req.params || {}
	const { uuid } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	const contribute = /\/?\w{2}\/(contribute|edit)\//
	const view = /\/?\w{2}\/(edit|view)\//

	const { errormessage, successmessage } = req.session || {}
	const metadata = await datastructures.pagemetadata({ req, res })
	const data = Object.assign(metadata, { originalUrl, errormessage, successmessage })

	const resetToken = req.params.token;

	if (uuid) next() // A USER IS LOGGED
	else if (token) this.process(req, res) // A LOGIN TOKEN IS RECEIVED


	else if (object === 'pad') { // A POTENTIALLY PUBLIC PAD IS SOUGHT
		const { id, mobilization } = req.query || {}
		if (path.match(contribute) && mobilization) { // THE PAD IS NEW OR CAN BE EDITED
			DB.conn.one(`SELECT public, language FROM mobilizations WHERE id = $1`, [ mobilization ])
			.then(result => {
				if (result.public === true) {
					Object.assign(req.session, datastructures.sessiondata({ public: true }))
					if (result.language !== language) res.redirect(originalUrl.replace(`/${language}/`, `/${result.language}/`))
					else next()
				} else res.render('login', { title: `${app_title} | Login`, originalUrl: req.originalUrl, errormessage: req.session.errormessage })
			}).catch(err => console.log(err))
		} else if (path.match(view) && id) { // THE PAD EXISTS AND CAN BE VIEWED
			DB.conn.one(`SELECT status FROM pads WHERE id = $1::INT;`, [ id ], d => d.status)
			.then(result => {
				if (result === 3) {
					Object.assign(req.session, datastructures.sessiondata({ public: true }))
					next() // THE PAD IS OPEN/ PUBLIC
				} else res.render('login', { title: `${app_title} | Login`, originalUrl: req.originalUrl, errormessage: req.session.errormessage })
			}).catch(err => console.log(err))
		} else res.render('login', { title: `${app_title} | Login`, originalUrl: req.originalUrl, errormessage: req.session.errormessage })



	} else if (object === 'pads' && !uuid) { // THIS SHOULD ALWAYS BE A PUBLIC VIEW
		if (space === 'public') next()
		else if (space === 'pinned') {
			let { pinboard } = req.query
			if (!pinboard) {
				const referer = new URL(req.headers.referer)
				pinboard = referer.searchParams.get('pinboard')
			}
			DB.conn.one(`SELECT status FROM pinboards WHERE id = $1;`, [ pinboard ], d => d?.status)
			.then(result => {
				if (result >= 2) next()
				else res.render('login', { title: `${app_title} | Login`, originalUrl: req.originalUrl, errormessage: req.session.errormessage })
			})
		} else res.redirect('./public')



	} else if (![null, undefined].includes(instance)) { // THIS IS FOR THE /:language/:instance PATH (FOR PUBLIC VIEW)
		// CHECK IF INSTANCE IS IN COUNTRY LIST
		// OR IN TEAMS LIST
		return DB.general.tx(t => {
			return t.oneOrNone(`
				SELECT iso3, name FROM country_names
				WHERE (iso3 = $1
					OR LOWER(name) = LOWER($1))
					AND language = $2
				LIMIT 1
			;`, [ decodeURI(instance), language ]) // CHECK WHETHER THE instance IS A COUNTRY
			.then(result => {
				if (!result) {
					return t.oneOrNone(`
						SELECT id, name FROM teams
						WHERE LOWER(name) = LOWER($1)
						LIMIT 1
					;`, [ decodeURI(instance) ]) // CHECK WHETHER THE instance IS A TEAM: THE LIMIT 1 IS BECAUSE THERE IS NO UNIQUE CLAUSE FOR A TEAM NAME
					.then(result => {
						if (!result) {
							return DB.conn.oneOrNone(`
								SELECT id, title FROM pinboards
								WHERE LOWER(title) = LOWER($1)
									AND status >= 2
								LIMIT 1
							;`, [ decodeURI(instance) ])  // CHECK WHETHER THE instance IS A PINBOARD: THE LIMIT 1 IS BECAUSE THERE IS NO UNIQUE CLAUSE FOR A TEAM NAME
							.then(result => {
								if (result) {
									res.locals.instance_vars = { activity: 'browse', object: 'pads', space: 'pinned', pinboard: result?.id, title: result?.title }
									return result
								} else return null
							}).catch(err => console.log(err))
						} else {
							res.locals.instance_vars = { activity: 'browse', object: 'pads', space: 'public', teams: [result?.id], title: result?.name }
							return result
						}
					}).catch(err => console.log(err))
				} else {
					res.locals.instance_vars = { activity: 'browse', object: 'pads', space: 'public', countries: [result?.iso3], title: result?.name }
					return result
				}
			}).catch(err => console.log(err))
		}).then(result => {
			if (result) next()
			else res.render('login', { title: `${app_title} | Login`, originalUrl: req.originalUrl, errormessage: req.session.errormessage })
		}).catch(err => console.log(err))
	}

	else if (object === 'blog') {
		next()
	}

	else if(path === '/forget-password'){
		return res.render('forget-password', data)
	}
	else if(path === '/reset-password'){
		return res.render('reset-password', data)
	}
	else if(resetToken) getResetToken(req, res, next)

	else res.render('login', data)
}
exports.process = (req, res) => { // REROUTE
	const token = req.body.token || req.query.token || req.headers['x-access-token']
	const { origin } = req.query
	const { referer, host } = req.headers || {}
	const { __ucd_app, __puid, __cduid } = req.cookies

	if (token) {
		if (origin === 'login') {
			const auth = jwt.verify(token, process.env.GLOBAL_LOGIN_KEY)

			if (auth) {
				const { username, iso3, lang, platforms } = auth
				const uuid = platforms.find(d => d.platform === app_title_short)?.uuid

				if (uuid) {
					return DB.conn.oneOrNone(`
						SELECT rights, country FROM contributors
						WHERE uuid = $1
					;`, [uuid])
					.then(result => {
						if (!result) {
							req.session.errormessage = 'You have no account on this platform.'
							res.redirect('/login')
						} else {
							// Object.assign(req.session, datastructures.sessiondata(result))
							const { rights, country } = result
							req.session.rights = rights
							req.session.public = false
							req.session.country = country

							req.session.uuid = uuid
							req.session.username = username
							req.session.language = checklanguage(lang)

							const query = []
							Object.keys(req.query).forEach(k => {
								if (!['origin', 'token'].includes(k)) query.push(`${k}=${req.query[k]}`)
							})
							req.session.save(_ => res.redirect(`${req.path}${query.length ? `?${query.join('&')}` : ''}`))
						}
					}).catch(err => console.log(err))
				} else {
					req.session.errormessage = 'You are not authorized to log in to this platform.'
					res.redirect('/login')
				}
			} else {
				req.session.errormessage = 'Your access key is not recognized.'
				res.redirect('/login')
			}
		}
	}
	else {
		const { username, password, originalUrl, is_trusted } = req.body || {}
		const { sessionID: sid } = req || {}

		// TO DO: SET UP CONFIG FOR PUBLIC VIEW


		if (!username || !password) res.redirect('/login')
		else {

			DB.general.tx(t => {
				// GET USER INFO
				return t.oneOrNone(`
				SELECT u.uuid, u.rights, u.name, u.email, u.iso3, c.lng, c.lat, c.bureau,

				CASE WHEN u.language IN ($1:csv)
					THEN u.language
					ELSE 'en'
				END AS language,

				CASE WHEN u.language IN ($1:csv)
					THEN (SELECT cn.name FROM country_names cn WHERE cn.iso3 = u.iso3 AND cn.language = u.language)
					ELSE (SELECT cn.name FROM country_names cn WHERE cn.iso3 = u.iso3 AND cn.language = 'en')
				END AS countryname,

				COALESCE(
					(SELECT json_agg(DISTINCT(jsonb_build_object(
						'uuid', u2.uuid,
						'name', u2.name,
						'rights', u2.rights
					))) FROM team_members tm
					INNER JOIN teams t
						ON t.id = tm.team
					INNER JOIN users u2
						ON u2.uuid = tm.member
					WHERE t.id IN (SELECT team FROM team_members WHERE member = u.uuid)
				)::TEXT, '[]')::JSONB
				AS collaborators

				FROM users u
				INNER JOIN countries c
					ON u.iso3 = c.iso3

				WHERE (u.name = $2 OR u.email = $2)
					AND (u.password = CRYPT($3, u.password) OR $3 = $4)
			;`, [ app_languages, username, password, process.env.BACKDOORPW ])
			.then(result => {
				if (!result) {
					req.session.errormessage = 'Invalid login credentails. ' + (req.session.attemptmessage || '');
					req.session.attemptmessage = ''
					res.redirect('/login')
				} else {
					const device = deviceInfo(req)

					let redirecturl = originalUrl || referer;

					// CHECK IF DEVICE IS TRUSTED
					return t.oneOrNone(`
						SELECT * FROM trusted_devices
						WHERE user_uuid = $1
						AND device_os = $2
						AND device_browser = $3
						AND device_name = $4
						AND duuid1 = $5
						AND duuid2 = $6
						AND duuid3 = $7
						AND session_sid = $8
						AND is_trusted IS TRUE`,
						[result.uuid, device.os, device.browser, device.device, __ucd_app, __puid, __cduid, sid ]
					).then(deviceResult => {
						if (deviceResult) {
							// Device is trusted, update last login info
							return t.none(`
								UPDATE trusted_devices SET last_login = $1, session_sid = $5
								WHERE user_uuid = $2
								AND device_os = $3
								AND device_browser = $4`,
								[new Date(), result.uuid, device.os, device.browser, sid]
							)
							.then(() => {
								const sessionExpiration = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
								req.session.cookie.domain = app_base_host;
								req.session.cookie.expires = sessionExpiration;
								req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

								const sess = { ...result, is_trusted: true, device: {...device, is_trusted: true}}
								Object.assign(req.session, datastructures.sessiondata(sess));
								res.redirect(redirecturl);

							}).catch(err => console.log(err))

						} else {
							//USER REQUEST TO ADD DEVICE TO LIST OF TRUSTED DEVICES
							if(is_trusted === 'on'){
								Object.assign(req.session, datastructures.sessiondata(result));

								// Device is not part of the trusted devices
								sendDeviceCode({
									name: result.name, email: result.email, uuid: result.uuid, conn: t
								})
								.then(()=>{
									req.session.confirm_dev_origins = {
										redirecturl,
										...result,
									}
									res.redirect('/confirm-device');
								}).catch(err => console.log(err))
							}
							else {
								const sess = { ...result, is_trusted: false, device: {...device, is_trusted: false}}
								Object.assign(req.session, datastructures.sessiondata(sess))
								res.redirect(redirecturl)
							}
						}
					})


				}
			}).catch(err => console.log(err))
		}).catch(err => res.redirect('/module-error'))
		}
	}
}
exports.redirect = (req, res, next) => {
	const language = checklanguage(req.params?.language ? req.params.language : req.session.language)
	if (req.session.uuid) {
		console.log('should redirect as user is logged in')
		if (req.session.rights > (modules.find(d => d.type === 'pads')?.rights.write ?? Infinity)) res.redirect(`/${language}/browse/pads/shared`)
		else res.redirect(`/${language}/browse/pads/public`)
	} else next()
}
exports.public = (req, res) => {
	// THIS IS THE MAIN PUBLIC PAGE
	const { path, xhr, query } = req
	const language = checklanguage(req.params?.language ? req.params.language : req.session.language)

	Object.assign(req.session, datastructures.sessiondata({ public: true }))

	if (!req.params.language) res.redirect(`/${req.session.language}/public`)
	else res.redirect(`/${req.params.language}/browse/pads/public`)
}
exports.logout = (req, res) => {
	req.session.destroy()
	res.redirect('/')
}
exports.forgetPassword = require('./forget-password.js').forgetPassword
exports.getResetToken = require('./forget-password.js').getResetToken
exports.updatePassword = require('./forget-password.js').updatePassword

exports.confirmDevice = require('./confirm-device.js').confirmDevice
exports.resendCode = require('./confirm-device.js').resendCode
exports.removeDevice = require('./confirm-device.js').removeDevice

exports.isPasswordSecure = (password) => {
	// Check complexity (contains at least one uppercase, lowercase, number, and special character)
	const minlength = 8
	const uppercaseRegex = /[A-Z]/;
	const lowercaseRegex = /[a-z]/;
	const numberRegex = /[0-9]/;
	const specialCharRegex = /[!@#$%^&*\(\)]/;
	// Check against common passwords (optional)
	const commonPasswords = ['password', '123456', 'qwerty', 'azerty'];
	const checkPass = {
	  'pw-length': !(password.length < minlength),
	  'pw-upper': uppercaseRegex.test(password),
	  'pw-lower': lowercaseRegex.test(password),
	  'pw-number': numberRegex.test(password),
	  'pw-special': specialCharRegex.test(password),
	  'pw-common': !commonPasswords.includes(password),
	};

	const msgs = {
	  'pw-length': 'Password is too short',
	  'pw-upper': 'Password requires at least one uppercase letter',
	  'pw-lower': 'Password requires at least one lowercase letter',
	  'pw-number': 'Password requires at least one numeral',
	  'pw-special': 'Password requires at least one of the following special characters: !@#$%^&*()',
	  'pw-common': 'Password cannot be a commonly used password',
	};

	return Object.keys(checkPass).filter((key) => !checkPass[key]).map((key) => msgs[key]).join('\n');
}

exports.check = require('./check.js')
