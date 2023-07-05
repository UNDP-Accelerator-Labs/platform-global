const { page_content_limit, apps_in_suite, modules, metafields, engagementtypes, lazyload, map, browse_display, welcome_module, DB } = include('config/')
const header_data = include('routes/header/').data
const { array, datastructures, checklanguage, join, parsers } = include('routes/helpers/')

const fetch = require('node-fetch')

const load = require('./load/')
const filter = require('./filter.js').main

exports.main = async (req, res) => {
	let { mscale, display, pinboard, source } = req.query || {}
	if (!source || !apps_in_suite.some(d => d.key === source)) source = apps_in_suite[0].key
	const { object, instance } = req.params || {}
	const path = req.path.substring(1).split('/')
	const activity = path[1]
	if (instance) pinboard = res.locals.instance_vars?.pinboard

	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, rights, collaborators, public } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, rights, collaborators, public } = datastructures.sessiondata({ public: true }) || {}
	}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req, res)

	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]


	// TO DO: CHECK IF THERE IS A QUERY
	// IF NOT, THEN SIMPLY RETURN THE MENU INFO
	const sourceDB = DB.conns.find(d => d.key === source)

	const data = await sourceDB.conn.tx(async t => {
		// const { participations } = await header_data({ connection: t, req })
		const batch = []

		// PADS DATA
		batch.push(load.data({ connection: t, req, res, baseurl: sourceDB.baseurl }))

		// FILTERS MENU DATA
		batch.push(load.filters_menu({ connection: t, participations: [], req, res }))
		// SUMMARY STATISTICS
		batch.push(load.statistics({ connection: t, req, res }))
		// LOCATIONS DATA
		batch.push(t.task(t1 => {
			const batch1 = []
			// GET LOCATIONS, ACCORDING TO FILTERS
			if (metafields.some(d => d.type === 'location') && map) {
				// TO DO: DEFAULT HERE IS DBSCAN, MAKE THIS DEPENDENT ON req.query
				// WE NEED CLUSTERS
				// [1000, 100] ARE THE DISTANCES (IN KM) FOR THE DBSCAN CLUSTERING
				[1000, 100].forEach(d => {
					batch1.push(t1.any(`
						SELECT
						jsonb_build_object(
							'type', 'Feature',
							'geometry', ST_AsGeoJson(ST_Centroid(ST_Collect(clusters.geo)))::jsonb,
							'properties', json_build_object('pads', json_agg(DISTINCT (clusters.pad)), 'count', COUNT(clusters.pad), 'cid', clusters.cid)::jsonb
						) AS json
						FROM (
							SELECT points.pad, ST_ClusterDBSCAN(points.projected_geom, eps := $1, minpoints := 2) over () AS cid, points.geo
							FROM (
								SELECT ST_Transform(ST_SetSRID(ST_Point(l.lng, l.lat), 4326), 3857) AS projected_geom, ST_Point(l.lng, l.lat) AS geo, l.pad
								FROM locations l
								INNER JOIN pads p
									ON l.pad = p.id
								WHERE TRUE
									$2:raw
							) AS points
						) clusters
						GROUP BY (clusters.cid)
						ORDER BY clusters.cid
					;`, [ d * 1000, full_filters ])
					.then(results => results.map(d => d.json))
					.catch(err => console.log(err)))
				})
				// NEED EXTRA LEVEL WITH SINGLE (NOT CLUSTERED) POINTS
				batch1.push(t1.any(`
					SELECT
					jsonb_build_object(
						'type', 'Feature',
						'geometry', ST_AsGeoJson(points.geo)::jsonb,
						'properties', json_build_object('pads', json_agg(DISTINCT (points.pad)), 'count', COUNT(points.pad), 'cid', NULL)::jsonb
					) AS json
					FROM (
						SELECT ST_Point(l.lng, l.lat) AS geo, l.pad
						FROM locations l
						INNER JOIN pads p
							ON l.pad = p.id
						WHERE TRUE
							$1:raw
					) AS points
					GROUP BY (points.geo)
				;`, [ full_filters ])
				.then(results => results.map(d => d.json))
				.catch(err => console.log(err)))
			} else if (map) {
				// USERS CANNOT INPUT LOCATIONS, BUT THERE IS A MAP SO WE POPULATE IT WITH USER LOCATION INFO
				batch1.push(t1.any(`
					SELECT p.id AS pad, p.owner FROM pads p
					WHERE p.id NOT IN (SELECT review FROM reviews)
						$1:raw
				;`, [ full_filters ])
				.then(results => {
					if (results.length) {
						const columns = Object.keys(results[0])
						const values = DB.pgp.helpers.values(results, columns)
						const set_table = DB.pgp.as.format(`SELECT $1:name FROM (VALUES $2:raw) AS t($1:name)`, [ columns, values ])

						return DB.general.any(`
							SELECT
							jsonb_build_object(
								'type', 'Feature',
								'geometry', ST_AsGeoJson(ST_Centroid(ST_Collect(clusters.geo)))::jsonb,
								'properties', json_build_object('pads', json_agg(clusters.pad), 'count', COUNT(clusters.pad), 'cid', clusters.cid)::jsonb
							) AS json
							FROM (
								SELECT c.iso3 AS cid, ST_Point(c.lng, c.lat) AS geo, t.pad FROM countries c
								INNER JOIN users u
									ON u.iso3 = c.iso3
								INNER JOIN ($1:raw) t
									ON t.owner::uuid = u.uuid::uuid
							) AS clusters
							GROUP BY (clusters.cid)
							ORDER BY clusters.cid
						;`, [ set_table ])
						.then(results => results.map(d => d.json))
						.catch(err => console.log(err))
					} else return null
				}).catch(err => console.log(err)))
			}
			return t1.batch(batch1)
			.catch(err => console.log(err))
		}))

		if (public && !pinboard) {
			batch.push(t.any(`
				SELECT id, title, owner, sections FROM pads
				WHERE status = 3
				ORDER BY random()
				LIMIT 72
			;`).then(async results => {
				const data = await join.users(results, [ language, 'owner' ])
				data.forEach(d => {
					d.img = parsers.getImg(d)
					d.txt = parsers.getTxt(d)
					delete d.sections
					delete d.owner
					delete d.ownername
					delete d.position
				})
				let max = 10
				if (welcome_module === 'mosaic') max = 46
				return data.filter(d => d.img?.length).slice(0, max)
			}))
		} else batch.push(null)

		return t.batch(batch)
		.then(async results => {
			let [ data,
				filters_menu,
				statistics,
				clusters,
				sample_images
			] = results

			// const { sections, pads } = data
			const { sections } = data
			const stats = {
				total: array.sum.call(statistics.total, 'count'),
				filtered: array.sum.call(statistics.filtered, 'count'),

				private: statistics.private,
				curated: statistics.curated,
				shared: statistics.shared,
				reviewing: statistics.reviewing,
				public: statistics.public,

				displayed: data.count,
				breakdown: statistics.filtered,
				persistent_breakdown: statistics.persistent,
				contributors: statistics.contributors,
				tags: statistics.tags
			}

			const metadata = await datastructures.pagemetadata({ req, res, page, pagecount: Math.ceil((stats.filtered || 0) / page_content_limit), map, mscale, source, connection: t })
			return Object.assign(metadata, { sections, clusters, sample_images, stats, filters_menu })
		}).catch(err => console.log(err))
	}).catch(err => console.log(err))

	const global_info = await Promise.all(
		DB.conns.map(app_conn => {
			return app_conn.conn.tx(async t => {
				const [ f_space, order, page, full_filters ] = await filter(req, res, { source: app_conn.key })
				const batch = []

				// LIST OF ALL PAD IDS, BASED ON FILTERS
				// GET PADS COUNT, ACCORDING TO FILTERS: TO DO: MOVE THIS TO load/data.js
				batch.push(t.any(`
					SELECT p.id, $1 AS source FROM pads p
					LEFT JOIN mobilization_contributions mob
						ON p.id = mob.pad
					WHERE p.id NOT IN (SELECT review FROM reviews)
						$2:raw
				;`, [ app_conn.key, full_filters ])
				.catch(err => console.log(err)))

				// GET FILTERS MENU FOR ALL PLATFORMS
				batch.push(load.filters_menu({ connection: t, participations: [], req, res, source: app_conn.key }))
				// GET STATISTICS FOR ALL PLATFORMS
				batch.push(load.statistics({ connection: t, req, res, source: app_conn.key })) // TO DO: THIS IS WHERE THE PB WITH pinboard STATS IS

				return t.batch(batch)
				.catch(err => console.log(err))
			}).then(results => {
				const [ pads, filters_menu, statistics ] = results

				return {
					key: app_conn.key,
					pads,
					filters_menu,
					stats: {
						filtered: array.sum.call(statistics.filtered, 'count'),
						shared: statistics.shared,
						public: statistics.public
					}
				}
			}).catch(err => console.log(err))
		})
	).then(results => {
		const global_info = {}
		global_info.statistics = results
		global_info.pads = results.map(d => d.pads).flat()
		global_info.filtered = array.sum.call(results.map(d => d.stats), 'filtered')
		global_info.shared = array.sum.call(results.map(d => d.stats), 'shared')
		global_info.public = array.sum.call(results.map(d => d.stats), 'public')

		function mergeObjValues (arr) {
			if (arr?.length) {
				const allkeys = arr.map(d => Object.keys(d)).flat()
				const commonkeys = array.unique.call(allkeys).reduce((accumulator, value) => {
					if (allkeys.filter(d => d === value).length >= 2) accumulator.push(value)
					return accumulator
				}, [])
				const uniquekeys = array.unique.call(allkeys).reduce((accumulator, value) => {
					if (allkeys.filter(d => d === value).length === 1) accumulator.push(value)
					return accumulator
				}, [])

				const obj = {}
				commonkeys.forEach(d => {
					const values = arr.map(c => c[d]).filter(c => c).flat()

					const usekey = values.every(c => ![null, undefined].includes(c.key))
					obj[d] = []
					values.forEach(c => {
						const preventry = obj[d].find(b => usekey ? b.key === c.key : b.id === c.id)
						if (preventry) preventry.count += c.count
						else obj[d].push(c)
					})
					if (usekey) obj[d].sort((a, b) => a.key - b.key)
					else obj[d].sort((a, b) => a.name.localeCompare(b.name))
				})

				uniquekeys.forEach(d => {
					obj[d] = arr.find(c => c[d])[d]
				})

				return obj
			} else return null
		}
		global_info.filters_menu = new Array(Math.max(...results.map(d => d.filters_menu.length)))
			.fill(0).map((d, i) => mergeObjValues(results.map(c => c.filters_menu[i]).filter(c => c)))

		return global_info
	}).catch(err => console.log(err))


	/*  // FIXME no pinboards in prod
	const [ pinboards_list, uniqueboard ] = await DB.conn.tx(t => {
		const batch = []
		// PINBOARDS LIST
		if (modules.some(d => d.type === 'pinboards' && d.rights.read <= rights)) {
			batch.push(t.any(`
				SELECT p.id, p.title,
					COALESCE(
						(SELECT COUNT (DISTINCT (pad)) FROM pinboard_contributions WHERE pinboard = p.id),
					0)::INT AS count

				FROM pinboards p

				WHERE $1 IN (SELECT participant FROM pinboard_contributors WHERE pinboard = p.id)
				GROUP BY p.id
				ORDER BY p.title
			;`, [ uuid ]))
		} else batch.push(null)
		// PINBOARD
		if (modules.some(d => d.type === 'pinboards') && pinboard) {
			batch.push(t.one(`
				SELECT p.*, array_agg(pc.participant) AS contributors,
					CASE WHEN p.owner = $1
					OR $1 IN (SELECT participant FROM pinboard_contributors WHERE pinboard = $3::INT)
					OR $2 > 2
						THEN TRUE
						ELSE FALSE
					END AS editable

				FROM pinboards p

				INNER JOIN pinboard_contributors pc
					ON pc.pinboard = p.id

				WHERE p.id = $3::INT
				GROUP BY p.id
			;`, [ uuid, rights, pinboard ])
			.then(async result => {
				const data = await join.users(result, [ language, 'owner' ])
				return data
			}).catch(err => console.log(err)))
		} else batch.push(null)

		return t.batch(batch)
		.catch(err => console.log(err))
	}).catch(err => console.log(err))
	*/
	const pinboards_list = [];
	const uniqueboard = null;

	data.metadata.page.display = uniqueboard?.slideshow && (!uniqueboard?.editable || activity === 'preview') ? 'slideshow' : display

	res.render('browse/', Object.assign(data, { global_info, pinboards_list, pinboard: uniqueboard }))
}
