const { app_title: title, app_description: description, app_languages, apps_in_suite, modules, metafields, media_value_keys, engagementtypes, lazyload, browse_display, welcome_module, page_content_limit, colors, DB } = include('config/')
const checklanguage = require('../language').main
const join = require('../joins')
const array = require('../array')
const jwt = require('jsonwebtoken')

if (!exports.legacy) exports.legacy = {}

exports.sessiondata = _data => {
	let { uuid, name, email, team, collaborators, rights, public, language, iso3, countryname, bureau, lng, lat } = _data || {}
	// GENERIC session INFO
	const obj = {}
	obj.uuid = uuid || null
	obj.username = name || 'Anonymous user'
	obj.email = email || null
	obj.team = team || null
	obj.collaborators = collaborators || []
	obj.rights = rights ?? 0
	obj.public = public || false
	obj.language = language || 'en'
	obj.country = {
		iso3: iso3 || 'NUL',
		name: countryname || 'Null Island',
		bureau: bureau,
		lnglat: { lng: lng ?? 0, lat: lat ?? 0 }
	}

	obj.token = jwt.sign(obj, 
		process.env.APP_SECRET,
		{ audience: 'global:user' },
		{ expiresIn: '24h' })

	return obj
}
exports.pagemetadata = (_kwargs) => {
	const conn = _kwargs.connection || DB.conn
	let { page, pagecount, map, display, mscale, source, req, res } = _kwargs || {}
	if (!source || !apps_in_suite.some(d => d.key === source)) source = apps_in_suite[0].key

	let { headers, path, params, query, session, ip } = req || {}
	path = path.substring(1).split('/')

	let { object, space, instance } = params || {}
	if (instance) {
		object = res?.locals?.instance_vars?.object
		space = res?.locals?.instance_vars?.space
	}

	if (session.uuid) { // USER IS LOGGED IN
		var { uuid, username: name, country, rights, collaborators, public } = session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, username: name, country, rights, collaborators, public } = this.sessiondata({ public: true }) || {}
	}
	const language = checklanguage(params?.language || session.language || this.sessiondata())
	const page_language = params?.language;
	
	const parsedQuery = {}
	for (let key in query) {
		if (key === 'search') {
			if (query[key].trim().length) parsedQuery[key] = query[key]
		} else {
			if (!Array.isArray(query[key])) parsedQuery[key] = [query[key]]
			else parsedQuery[key] = query[key]
		}
	}

	// ADD A CALL FOR ALL TEMPLATES (NAME + ID)
	return conn.tx(t => {
		const batch = []
		if (modules.some(d => d.type === 'templates' && rights >= d.rights.read)) {
			batch.push(t.any(`
				SELECT id, title, owner, status FROM templates
				WHERE (status >= 2
					OR (status = 1 AND owner = $1))
					AND id NOT IN (SELECT template FROM review_templates)
				ORDER BY date DESC
			;`, [ uuid ]).catch(err => console.log(err))
			.then(async results => {
				const data = await join.users(results, [ language, 'owner' ])
				return data
			}).catch(err => console.log(err)))
		} else batch.push(null)
		if (modules.some(d => d.type === 'mobilizations' && rights >= d.rights.read)) {
			batch.push(t.any(`
				SELECT m.id, m.title, m.owner, m.child, m.status,
					COALESCE((SELECT tm.id FROM mobilizations tm WHERE tm.source = m.id LIMIT 1), NULL) AS target_id,
					COALESCE((SELECT sm.id FROM mobilizations sm WHERE sm.id = m.source LIMIT 1), NULL) AS source_id
				FROM mobilizations m
				WHERE status = 2
					AND (owner = $1 OR $2 > 2)
				ORDER BY m.end_date DESC
			;`, [ uuid, rights ])
			.then(async results => {
				const data = await join.users(results, [ language, 'owner' ])
				return data
			}).catch(err => console.log(err)))
		} else batch.push(null)
		if (modules.some(d => d.type === 'mobilizations' && rights >= d.rights.read)) {
			batch.push(t.any(`
				SELECT m.id, m.owner, m.title, m.template, m.source, m.copy, m.status, m.child,
					to_char(m.start_date, 'DD Mon YYYY') AS start_date
				FROM mobilizations m
				WHERE m.id IN (SELECT mobilization FROM mobilization_contributors WHERE participant = $1)
					OR m.public = TRUE
					AND m.status = 1
				ORDER BY m.start_date DESC
			;`, [ uuid ]).catch(err => console.log(err))
			.then(async results => {
				const data = await join.users(results, [ language, 'owner' ])
				return data
			}).catch(err => console.log(err)))
		} else batch.push(null)
		batch.push(DB.general.task(gt => {
			const gbatch = []
			gbatch.push(gt.any(`
				SELECT DISTINCT (name), language FROM languages
				WHERE language IN ($1:csv)
				ORDER BY language
			;`, [ app_languages ]))
			gbatch.push(gt.any(`
				SELECT language, secondary_languages FROM users
				-- SELECT COUNT (id)::INT AS count, language FROM users
				-- GROUP BY language
			;`))
			return gt.batch(gbatch)
			.catch(err => console.log(err))
		}).catch(err => console.log(err)))
		// REVIEW TEMPLATES
		if (modules.some(d => d.type === 'reviews' && rights >= d.rights.read)) {
			batch.push(t.any(`
				SELECT template, language FROM review_templates
			;`).then())
		} else batch.push(null)

		return t.batch(batch)
		.catch(err => console.log(err))
	}).then(results => {
		let [ templates, mobilizations, participations, languagedata, review_templates ] = results
		let [ languages, speakers ] = languagedata

		// THIS PART IS A BIT COMPLEX: IT AIMS TO COMBINE PRIMARY AND SECONDARY LANGUAGES OF USERS
		// TO WIDEN THE POSSIBLE REVIEWER POOL
		if (review_templates) {
			speakers = speakers.map(d => {
				const l = d.secondary_languages || []
				l.push(d.language)
				return l
			}).flat()
			speakers = array.count.call(speakers, { keyname: 'language' })

			review_templates = join.multijoin.call(review_templates, [ speakers, 'language' ])
			review_templates = join.multijoin.call(review_templates, [ languages, 'language' ])
			review_templates.forEach(d => {
				d.disabled = d.count < (modules.find(d => d.type === 'reviews')?.reviewers ?? 0)
			})
		} else review_templates = []

		const obj = {}
		obj.metadata = {
			site: {
				apps_in_suite: apps_in_suite.map((d) => {
					if (uuid) {
						const curHost = `${d.baseurl}`.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
						const token = jwt.sign({ uuid, rights, ip }, process.env.APP_SECRET, { audience: 'user:known', issuer: curHost, expiresIn: '1h' })
						d.forwardURL = `${d.baseurl.replace(/\/$/, '')}/transfer?path=%2F&token=${token}`;
					} else {
						d.forwardURL = d.baseurl;
					}
					return d;
				}),
				title,
				description,
				languages,
				modules,
				metafields,
				media_value_keys,
				engagementtypes,
				welcome_module,
				colors
			},
			user: {
				uuid,
				name,
				country,
				rights
			},
			page: {
				title,
				instance_title: res?.locals.instance_vars?.title || null,
				id: page ?? undefined,
				count: pagecount ?? null,
				language,
				page_language,
				public,

				path,
				referer: headers.referer,
				activity: path[1],
				object,
				space,
				query: parsedQuery,

				source,
				lazyload,
				map: map || false,
				mscale: mscale || 'contain',
				display: display || browse_display,
				page_content_limit
			},
			menu: {
				templates,
				mobilizations,
				participations,
				review_templates
			}
		}
		return obj
	}).catch(err => console.log(err))
}
exports.legacy.publishablepad = (_kwargs) => { // THIS IS LEGACY FOR THE SOLUTIONS MAPPING PLATFORM
	const conn = _kwargs.connection || DB.conn
	const { data } = _kwargs

	const other_metadata = metafields.filter(d => !['tag', 'index', 'location'].includes(d.type))
	if (other_metadata.length > 0) {
		if (Array.isArray(data)) {
			return Promise.all(data.map(d => {
				return conn.any(`
					SELECT type, name, value FROM metafields
					WHERE pad = $1::INT
				;`, [ d.id ])
				.then(meta => {
					const nesting = array.nest.call(meta, { key: c => `${c.type}-${c.name}`, keep: ['type', 'name'] })
					const has_metadata = other_metadata.every(c => nesting.some(b => c.required && b.type === c.type && b.name === c.name && b.count <= (c.limit ?? Infinity)))

					d.publishable = (d.status >= 1 && has_metadata) || false
					return d
				}).catch(err => console.log(err))
			}))
		} else {
			return conn.any(`
				SELECT type, name, value FROM metafields
				WHERE pad = $1::INT
			;`, [ data.id ])
			.then(meta => {
				const nesting = array.nest.call(meta, { key: d => `${d.type}-${d.name}`, keep: ['type', 'name'] })
				const has_metadata = other_metadata.every(c => nesting.some(b => c.required && b.type === c.type && b.name === c.name && b.count <= (c.limit ?? Infinity)))

				data.publishable = (data.status >= 1 && has_metadata) || false
				return data
			}).catch(err => console.log(err))
		}
	} else {
		return new Promise(resolve => {
			if (Array.isArray(data)) {
				data.forEach(d => d.publishable = (d.status >= 1 || false))
			} else data.publishable = data.status >= 1 || false

			resolve(data)
		})
	}
}

// THE REST IS NOT USED FOR NOW
exports.pagedata = (_req, _data) => {
	const obj = {}
	obj.metadata = {
		site: {
			modules,
			metafields,
			engagementtypes,
			public
		},
		user: {
			// TO DO: GET THIS FROM SESSION DATA OR FROM this.sessiondata
			name: username,
			country,
			rights
		},
		page: {
			title: pagetitle, // NEED TO FETCH SOMEWHERE
			id: 0,
			count: 0,
			lang, // NEED TO FETCH SOMEWHERE

			path, // NEED TO RETRIEVE path FROM req
			activity: path[1],
			object,
			space,
			query,

			lazyload,
			mscale: 'contain',
			display: browse_display
		},
		menu: {}, // TO DO: CHECK WHAT THIS IS FOR


	}
	obj.stats = {
		total: 0,
		filtered: 0,
		private: 0,
		curated: 0,
		shared: 0,
		public: 0,
		displayed: 0,
		breakdown: 0,
		persistent_breakdown: 0,
		contributors: 0,
		tags: 0
	}
	obj.data = {
		filters_menu: [],
		documents: [], // PADS, TEMPLATES, ETC
		sections: [] // THIS SHOULD BE DEPRECATED
		// clusters,
		// pinboards_list,
		// pinboard,
	} // TO DO: THIS IS A NEW SCHEMA (NOT USED NOW BUT CLEANER)
	return obj
}


exports.constructQueryString = (params) => {
	const { search, country, type, full_filters } = params;
    let queryString = "";
    if (search) {
      queryString += "search=" + encodeURIComponent(search) + "&";
    }

    if (country) {
      if (Array.isArray(country)) {
        country.forEach(function (c) {
          queryString += "country=" + encodeURIComponent(c) + "&";
        });
      } else {
        queryString += "country=" + encodeURIComponent(country) + "&";
      }
    }

    if (type) {
      if (Array.isArray(type)) {
        type.forEach(function (t) {
          queryString += "type=" + encodeURIComponent(t) + "&";
        });
      } else {
        queryString += "type=" + encodeURIComponent(type) + "&";
      }
    }

	if(full_filters && typeof full_filters === 'string'){
		queryString += "full_filters=" + encodeURIComponent(full_filters) + "&"
	}

    return queryString.slice(0, -1);
};