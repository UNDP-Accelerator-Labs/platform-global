const { page_content_limit, modules, engagementtypes, DB } = include('config/')
const { array, join, checklanguage } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.general
	const { req } = kwargs || {}
	const { object } = req.params || {}
	const { uuid, rights, collaborators } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, page, full_filters ] = filter(kwargs.req)
	
	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	return conn.task(gt => {
		return gt.any(`
			SELECT DISTINCT (u.uuid) AS id, u.name, u.email, u.position AS txt, u.iso3, u.confirmed::INT AS status, 
			u.confirmed_at, u.left_at,
			u.language, u.secondary_languages,
			to_char(u.confirmed_at, 'DD Mon YYYY') AS start_date, to_char(u.left_at, 'DD Mon YYYY') AS end_date,
			cn.name AS country,

			CASE WHEN $1 > 2
				THEN TRUE
				ELSE FALSE
			END AS editable,

			-- THIS IS THE PINBOARD CASE STATEMENT
			COALESCE(
			(SELECT json_agg(json_build_object(
					'id', t.id, 
					'title', t.name
				)) FROM teams t
				INNER JOIN team_members tm
					ON tm.team = t.id
				WHERE t.host IN ($2:csv)
					AND tm.member = u.uuid
				GROUP BY tm.member
			)::TEXT, '[]')::JSONB
			AS pinboards

			FROM users u

			-- FROM cohorts c
			-- INNER JOIN users u
			-- 	ON u.uuid = c.contributor
			
			INNER JOIN country_names cn
				ON cn.iso3 = u.iso3
			INNER JOIN languages l
				ON l.iso3 = u.iso3
			WHERE cn.language = $3
				$4:raw
			ORDER BY u.name
		;`, [ rights, collaborators_ids, language, full_filters ])
		.then(users => {
			// CONVERT THE pinboards TO json
			// users.forEach(d => {
			// 	d.pinboards = JSON.parse(d.pinboards)
			// })

			// TO DO: FINISH HERE

			if (users.length) {
				return Promise.all(DB.conns.map(app_conn => {
					return app_conn.conn.task(t => {
						const batch = []
						batch.push(t.any(`
							SELECT mc.participant AS id, COALESCE(COUNT (mc.mobilization), 0)::INT AS ongoing_associated_mobilizations FROM mobilization_contributors mc
							INNER JOIN mobilizations m
								ON m.id = mc.mobilization
							WHERE mc.participant IN ($1:csv)
								AND m.status = 1
							GROUP BY mc.participant
						;`, [ users.map(d => d.id) ]))

						batch.push(t.any(`
							SELECT mc.participant AS id, COALESCE(COUNT (mc.mobilization), 0)::INT AS past_associated_mobilizations FROM mobilization_contributors mc
							INNER JOIN mobilizations m
								ON m.id = mc.mobilization
							WHERE mc.participant IN ($1:csv)
								AND m.status = 2
							GROUP BY mc.participant
						;`, [ users.map(d => d.id) ]))
						
						batch.push(t.any(`
							SELECT owner AS id, COALESCE(COUNT (id), 0)::INT AS private_associated_pads FROM pads
							WHERE owner IN ($1:csv)
								AND status < 2
							GROUP BY owner
						;`, [ users.map(d => d.id) ]))

						batch.push(t.any(`
							SELECT owner AS id, COALESCE(COUNT (id), 0)::INT AS associated_pads FROM pads
							WHERE owner IN ($1:csv)
								AND status >= 2
							GROUP BY owner
						;`, [ users.map(d => d.id) ]))
						
						return t.batch(batch)
						.then(results => {
							const [ ongoing_associated_mobilizations, past_associated_mobilizations, private_associated_pads, associated_pads ] = results

							users.forEach(d => {
								results.forEach(c => {
									const values = c.find(b => b.id === d.id)
									if (values) {
										const { id, ...stat } = values
										const key = Object.keys(stat)[0]
										const value = Object.values(stat)[0]
										if (!d[key]) d[key] = +value
										else d[key] += +value
									}
								})
							})
							// let data = join.multijoin.call(users, [ ongoing_associated_mobilizations, 'id' ])
							// data = join.multijoin.call(data, [ past_associated_mobilizations, 'id' ])
							// data = join.multijoin.call(data, [ private_associated_pads, 'id' ])
							// data = join.multijoin.call(data, [ associated_pads, 'id' ])
							return null	
						}).catch(err => console.log(err))
					}).catch(err => console.log(err))
				})).then(_ => {
					users.forEach(d => { // UPDATE STATUS BASED ON PADS
						if (d.status === 1 && (d.associated_pads > 0 || d.private_associated_pads > 0)) d.status = 2
					})
					return users
				}).catch(err => console.log(err))
			} else return users
		}).catch(err => console.log(err))
	}).then(data => {

		// const sections = array.nest.call(data, { key: d => d.name.charAt(0).toUpperCase() })
		// sections.forEach(d => {
		// 	d.data = d.values
		// 	delete d.values
		// })
		// sections.sort((a, b) => a.key?.localeCompare(b.key))

		return { 
			data,
			// count: (page - 1) * page_content_limit, 
			// count: page * page_content_limit, 
			sections: [{ data }]
			// sections
		}
	}).catch(err => console.log(err))
}