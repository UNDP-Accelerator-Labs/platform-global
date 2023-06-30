const { app_title, apps_in_suite, DB, modules, engagementtypes, metafields } = include('config/')
const { checklanguage, datastructures, parsers } = include('routes/helpers/')

exports.main = async (req, res, kwargs = {}) => {
	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, country, rights, collaborators } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, country, rights, collaborators } = datastructures.sessiondata({ public: true }) || {}
	}

	let { space, object, instance } = req.params || {}
	if (!space) space = req.body?.space // THIS IS IN CASE OF POST REQUESTS (e.g. COMMING FROM DOWNLOAD)
	
	let { search, status, contributors, countries, teams, pads, templates, mobilizations, pinboard, methods, page } = Object.keys(req.query)?.length ? req.query : Object.keys(req.body)?.length ? req.body : {}
	let source = kwargs.source || req.query.source || req.body.source
	if (!source || !apps_in_suite.some(d => d.key === source)) source = apps_in_suite[0].key
	
	const language = checklanguage(req.params?.language || req.session.language)

	// MAKE SURE WE HAVE PAGINATION INFO
	if (!page) page = 1
	else page = +page

	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	if (instance) {
		const { instance_vars } = res.locals
		if (!instance_vars) {
			const vars = await DB.general.tx(t => {
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
									if (result) return { object: 'pads', space: 'pinned', pinboard: result?.id, title: result?.title }
									else return res.render('login', { title: `${app_title} | Login`, originalUrl: req.originalUrl, errormessage: req.session.errormessage })
								}).catch(err => console.log(err))
							} else return { object: 'pads', space: 'public', teams: [result?.id], title: result?.name }
						}).catch(err => console.log(err))
					} else return { object: 'pads', space: 'public', countries: [result?.iso3], title: result?.name }
				}).catch(err => console.log(err))
			}).catch(err => console.log(err))

			space = vars.space
			pinboard = vars.pinboard
			teams = vars.teams
			countries = vars.countries
			// MAKE SURE THE object AND space ARE SET
			res.locals.instance_vars = vars
		} else {
			space = instance_vars.space
			pinboard = instance_vars.pinboard
			teams = instance_vars.teams
			countries = instance_vars.countries
		}
	}


	// FILTERS
	return new Promise(async resolve => {
		// BASE FILTERS
		const base_filters = []
		if (search) base_filters.push(DB.pgp.as.format(`p.full_text ~* $1`, [ parsers.regexQuery(search) ]))
		if (status) base_filters.push(DB.pgp.as.format(`p.status IN ($1:csv)`, [ status ]))

		let f_space = null
		if (space === 'private') f_space = DB.pgp.as.format(`p.owner IN ($1:csv)`, [ collaborators_ids ])
		engagementtypes.forEach(e => {
			if (space === `${e}s`) f_space = DB.pgp.as.format(`p.id IN (SELECT docid FROM engagement WHERE user = $1 AND doctype = 'pad' AND type = $2)`, [ uuid, e ])
		})
		if (space === 'curated') f_space = DB.pgp.as.format(`(p.id IN (SELECT mc.pad FROM mobilization_contributions mc INNER JOIN mobilizations m ON m.id = mc.mobilization WHERE m.owner IN ($1:csv)) OR $2 > 2) AND (p.owner NOT IN ($1:csv) OR p.owner IS NULL) AND p.status < 2`, [ collaborators_ids, rights ])
		if (space === 'shared') f_space = DB.pgp.as.format(`p.status = 2`)
		if (space === 'reviewing') f_space = DB.pgp.as.format(`
			((p.id IN (SELECT mc.pad FROM mobilization_contributions mc INNER JOIN mobilizations m ON m.id = mc.mobilization WHERE m.owner IN ($1:csv)) OR $2 > 2) 
				OR (p.owner IN ($1:csv)))
			AND p.id IN (SELECT pad FROM review_requests)
		`, [ collaborators_ids, rights ])
		if (space === 'public' || !uuid) f_space = DB.pgp.as.format(`p.status = 3`) // THE !uuid IS FOR PUBLIC DISPLAYS
		if (space === 'pinned') {
			if (uuid) f_space = DB.pgp.as.format(`(p.owner IN ($1:csv) OR $2 > 2 OR p.status > 1)`, [ collaborators_ids, rights ])
			else f_space = DB.pgp.as.format(`(p.status > 2 OR (p.status > 1 AND p.owner IS NULL))`)
		}
		base_filters.push(f_space)

		// PLATFORM FILTERS
		const platform_filters = []
		if (pads) platform_filters.push(DB.pgp.as.format(`p.id IN ($1:csv)`, [ pads ]))
		if (contributors) platform_filters.push(DB.pgp.as.format(`p.owner IN ($1:csv)`, [ contributors ]))
		if (countries) {
			platform_filters.push(await DB.general.any(`
				SELECT uuid FROM users WHERE iso3 IN ($1:csv)
			;`, [ countries ])
			.then(results =>  DB.pgp.as.format(`p.owner IN ($1:csv)`, [ results.map(d => d.uuid) ]))
			.catch(err => console.log(err)))
			// platform_filters.push(f_countries)
		}
		if (teams) {
			platform_filters.push(await DB.general.any(`
				SELECT member FROM team_members WHERE team IN ($1:csv)
			;`, [ teams ])
			.then(results => DB.pgp.as.format(`p.owner IN ($1:csv)`, [ results.map(d => d.uuid) ]))
			.catch(err => console.log(err)))
		}
		if (templates) platform_filters.push(DB.pgp.as.format(`p.template IN ($1:csv)`, [ templates ]))
		if (mobilizations) platform_filters.push(DB.pgp.as.format(`p.id IN (SELECT pad FROM mobilization_contributions WHERE mobilization IN ($1:csv))`, [ mobilizations ]))

		if (pinboard) {
			platform_filters.push(await DB.conn.any(`
				SELECT pad FROM pinboard_contributions
				WHERE pinboard = $1::INT
					AND source = $2
			;`, [ pinboard, source ]).then(results => DB.pgp.as.format(`(p.id IN ($1:csv))`, [ results.map(d => d.pad) ]))
			.catch(err => console.log(err)))
		}
		// ADDITIONAL FILTER FOR SETTING UP THE "LINKED PADS" DISPLAY
		// if (sources) platform_filters.push(DB.pgp.as.format(`AND p.source IS NULL`))

		// CONTENT FILTERS
		const content_filters = []
		metafields.forEach(d => {
			// TO DO: FINSIH THIS FOR OTHER METAFIELDS
			if (Object.keys(req.query).includes(d.label) || Object.keys(req.body).includes(d.label)) {
				if (['tag', 'index'].includes(d.type)) {
					content_filters.push(DB.pgp.as.format(`p.id IN (SELECT pad FROM tagging WHERE type = $1 AND tag_id IN ($2:csv))`, [ d.label, req.query[d.label] || req.body[d.label] ]))
				} else if (!['tag', 'index', 'location', 'attachment'].includes(d.type)) {
					content_filters.push(DB.pgp.as.format(`p.id IN (SELECT pad FROM metafields WHERE type = $1 AND name = $2 AND key IN ($3:csv))`, [ d.type, d.label, req.query[d.label] || req.body[d.label] ]))
				}
			}
		})

		// ORDER
		const order = DB.pgp.as.format(`ORDER BY p.date DESC`)

		let filters = [ base_filters.filter(d => d).join(' AND '), platform_filters.filter(d => d).join(' OR '), content_filters.filter(d => d).join(' OR ') ]
			.filter(d => d?.length)
			.map(d => `(${d.trim()})`)
			.join(' AND ')
			.trim()

		if (filters.length && filters.slice(0, 3) !== 'AND') filters = `AND ${filters}`

		resolve([ `AND ${f_space}`, order, page, filters ])
	})
}