const { apps_in_suite, page_content_limit, followup_count, metafields, modules, engagementtypes, map, DB } = include('config/')
const { checklanguage, datastructures, engagementsummary, parsers, array, join } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	const { req, res, baseurl } = kwargs || {}
	const { object } = req.params || {}
	let { source } = req.query || {}
	if (!source || !apps_in_suite.some(d => d.key === source)) source = apps_in_suite[0].key

	// const { uuid, rights, collaborators } = req.session || {}
	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, rights, collaborators } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, rights, collaborators } = datastructures.sessiondata({ public: true }) || {}
	}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req, res)

	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	const engagement = engagementsummary({ doctype: 'pad', engagementtypes, uuid })

	// CONSTRUCT FOLLOW-UPS GRAPH
	return conn.task(t => {
		// THE ORDER HERE IS IMPORTANT, THIS IS WHAT ENSURE THE TREE CONSTRUCTION LOOP WORKS
		return t.any(`
			SELECT id, source FROM pads
			WHERE id IN (SELECT source FROM pads)
				OR source IS NOT NULL
			ORDER BY date ASC
		;`).then(async results => {
			const groups = results.filter(d => !d.source).map(d => { return [d.id] })
			results.filter(d => d.source).forEach(d => {
				groups.find(c => c.includes(d.source)).push(d.id)
			})
			// console.log('check here')
			// console.log(results.length)
			// console.log(results)
			// console.log(groups.length)
			// console.log(groups)

			// FOLLOW UP json_agg INSPIRED BY:
			// https://stackoverflow.com/questions/54637699/how-to-group-multiple-columns-into-a-single-array-or-similar/54638050
			// https://stackoverflow.com/questions/24155190/postgresql-left-join-json-agg-ignore-remove-null

			return t.any(`
				SELECT p.id, p.owner, p.title, p.sections, p.template, p.status, p.source,
					m.id AS mobilization,
					m.title AS mobilization_title, m.pad_limit,
					t.title AS template_title,

					CASE WHEN p.id IN (SELECT pad FROM review_requests)
						THEN 1
						ELSE 0
					END AS review_status,

					CASE
						WHEN AGE(now(), p.date) < '0 second'::interval
							THEN jsonb_build_object('interval', 'positive', 'date', to_char(p.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(p.date, now())), 'hours', EXTRACT(hour FROM AGE(p.date, now())), 'days', EXTRACT(day FROM AGE(p.date, now())), 'months', EXTRACT(month FROM AGE(p.date, now())))
						ELSE jsonb_build_object('interval', 'negative', 'date', to_char(p.date, 'DD Mon YYYY'), 'minutes', EXTRACT(minute FROM AGE(now(), p.date)), 'hours', EXTRACT(hour FROM AGE(now(), p.date)), 'days', EXTRACT(day FROM AGE(now(), p.date)), 'months', EXTRACT(month FROM AGE(now(), p.date)))
					END AS date,

					-- CASE WHEN AGE(now(), p.date) < '1 hour'::interval
					-- 		THEN EXTRACT(minute FROM AGE(now(), p.date))::text || ' minutes ago'
					-- 	WHEN AGE(now(), p.date) < '1 day'::interval
					-- 		THEN EXTRACT(hour FROM AGE(now(), p.date))::text || ' hours ago'
					-- 	WHEN AGE(now(), p.date) < '1 month'::interval
					-- 		THEN EXTRACT(day FROM AGE(now(), p.date))::text || ' days ago'
					-- 	ELSE to_char(p.date, 'DD Mon YYYY')
					-- END AS date,

					CASE WHEN p.source IS NOT NULL
						THEN (SELECT p2.title FROM pads p2 WHERE p2.id = p.source)
						ELSE NULL
					END AS source_title,

					CASE WHEN p.source IS NOT NULL
						AND m.id IS NOT NULL
						AND (SELECT copy FROM mobilizations WHERE id = m.id) = FALSE
							THEN TRUE
							ELSE FALSE
						END AS is_followup,

					CASE WHEN p.source IS NOT NULL
						AND m.id IS NOT NULL
						AND (SELECT copy FROM mobilizations WHERE id = m.id) = TRUE
							THEN TRUE
							ELSE FALSE
						END AS is_forward,

					COALESCE(json_agg(json_build_object(
						'id', fmob.id,
						'title', fmob.title,
						'source', p.id,
						'template', fmob.template,
						'count', (SELECT COUNT(p2.id) FROM pads p2
							INNER JOIN mobilization_contributions mc2
								ON p2.id = mc2.pad
							WHERE p2.source = p.id
							AND mc2.mobilization = fmob.id),
						'max', $12::INT
					)) FILTER (WHERE fmob.id IS NOT NULL AND fmob.copy = FALSE AND p.status >= 2), '[]')
					AS followups,

					COALESCE(json_agg(json_build_object(
						'id', fmob.id,
						'title', fmob.title,
						'source', p.id,
						'template', fmob.template,
						'count', (SELECT COUNT(p2.id) FROM pads p2
							INNER JOIN mobilization_contributions mc2
								ON p2.id = mc2.pad
							WHERE p2.source = p.id
							AND mc2.mobilization = fmob.id),
						'max', $12::INT
					)) FILTER (WHERE fmob.id IS NOT NULL AND fmob.copy = TRUE AND p.status >= 2), '[]')
					AS forwards,

					COALESCE(
						(SELECT m.pad_limit - COUNT (id) FROM pads pp
							WHERE pp.owner IN ($2:csv)
							AND pp.id IN (SELECT pad FROM mobilization_contributions WHERE mobilization = m.id)
							AND pp.status >= 2
						), 1)::INT AS available_publications,

					COALESCE(p.source, p.id) AS group_id,

					-- THESE ARE THE ENGAGEMENT COALESCE STATEMENTS
					$3:raw,

					-- CASE WHEN p.owner IN ($2:csv)
					--	OR $4 > 2
					--		THEN TRUE
					--		ELSE FALSE
					--	END AS editable,

					FALSE AS editable,

					-- THESE ARE THE ENGAGEMENT CASE STATEMENTS
					$5:raw,

					-- THIS IS THE PINBOARD CASE STATEMENT
					-- COALESCE(
					-- (SELECT json_agg(json_build_object(
					-- 		'id', pb.id,
					-- 		'title', pb.title
					-- 	)) FROM pinboards pb
					-- 	INNER JOIN pinboard_contributions pbc
					-- 		ON pbc.pinboard = pb.id
					-- 	WHERE $1:raw IN (SELECT participant FROM pinboard_contributors WHERE pinboard = pb.id)
					-- 		AND pbc.pad = p.id
					-- 		-- AND pbc.source = $14
					-- 	GROUP BY p.id
					-- )::TEXT, '[]')::JSONB
					-- AS pinboards,

					'[]'::JSONB AS pinboards,

					$13 || p.id AS link

				FROM pads p

				LEFT JOIN templates t
					ON t.id = p.template

				LEFT JOIN ($6:raw) ce ON ce.docid = p.id

				LEFT JOIN mobilization_contributions mc
					ON mc.pad = p.id

				LEFT JOIN mobilizations m
					ON m.id = mc.mobilization

				LEFT JOIN (
					SELECT id, title, source, template, copy FROM mobilizations
					WHERE status = 1
				) fmob
					ON fmob.source = m.id

				WHERE TRUE
					$7:raw
					AND (m.id = (SELECT MAX(mc2.mobilization) FROM mobilization_contributions mc2 WHERE mc2.pad = p.id)
						OR m.id IS NULL) -- THIS IS IN CASE A PAD IS CONTRIBUTED TO TWO MOBILIZATIONS
					AND p.id NOT IN (SELECT review FROM reviews)

				GROUP BY (
					p.id,
					m.id,
					m.title,
					m.pad_limit,
					t.title,
					$8:raw
				)
				$9:raw
				LIMIT $10 OFFSET $11
			;`, [
				/* $1 */ DB.pgp.as.format(uuid === null ? 'NULL' : '$1', [ uuid ]),
				/* $2 */ collaborators_ids,
				/* $3 */ engagement.coalesce,
				/* $4 */ rights,
				/* $5 */ engagement.cases,
				/* $6 */ engagement.query,
				/* $7 */ full_filters,
				/* $8 */ engagement.list,
				/* $9 */ order,
				/* $10 */ page_content_limit,
				/* $11 */ (page - 1) * page_content_limit,
				/* $12 */ followup_count,
				/* $13 */ `${baseurl}/${language}/view/pad?id=`,
				/* $14 */ source // THIS IS NOT USED AND NEEDS TO BE TAKEN OUT SINCE THE PINBOARD INFO IS NOT IN THIS DB
			]).then(results => {
				// REMOVE THE follow_ups AND forwards FOR PADS THAT HAVE ALREADY BEEN FOLLOWED UP FOR A GIVEN MOBILIZATION
				results.forEach(d => {
					d.followups = d.followups?.filter(c => c.count < followup_count)
					d.forwards = d.forwards?.filter(c => c.count < followup_count)

					d.img = parsers.getImg(d)
					d.sdgs = parsers.getSDGs(d)
					d.tags = parsers.getTags(d)
					d.txt = parsers.getTxt(d)
					delete d.sections // WE DO NOT NEED TO SEND ALL THE DATA (JSON PAD STRUCTURE) AS WE HAVE EXTRACTED THE NECESSARY INFO ABOVE

					// d.publishable = d.status >= 1
				})

				// IF ALL PADS ARE ALREADY RETRIEVED, THEN GROUP THEM
				// IF A FOLLOW UP IS RETRIEVED BUT NOT THE SOURCE, LOOK FOR THE SOURCES AND RETRIEVE THEM
				results.forEach(d => {
					if (d.source) {
						const group = groups.find(c => c.includes(d.id))
						// console.log(`${d.id} is associated with ${group.filter(c => c !== d.id)}`)
						// console.log(`missing ${group.filter(c => !results.map(b => b.id).includes(c))}`)
					}
				})

				if (results.length) {
					return [];
					/*  // FIXME no pinboards in prod
					return DB.conn.any(`
						SELECT p.pad AS id,
							json_agg(json_build_object(
								'id', pb.id,
								'title', pb.title
							)) AS pinboards

						FROM pinboard_contributions p
						INNER JOIN pinboards pb
							ON pb.id = p.pinboard

						WHERE $1:raw IN (SELECT participant FROM pinboard_contributors WHERE pinboard = pb.id)
							AND p.pad IN ($2:csv)
							AND p.source = $3
						GROUP BY p.pad
					;`, [ DB.pgp.as.format(uuid === null ? 'NULL' : '$1', [ uuid ]), results.map(d => d.id), source ])
					.then(pins => {
						const data = join.multijoin.call(results, [ pins, 'id' ])
						return data
					}).catch(err => console.log(err))
					*/
				} else return results

			}).catch(err => console.log(err))
		}).then(results => {
			// THIS IS A LEGACY FIX FOR THE SOLUTIONS MAPPING PLATFORM
			// NEED TO CHECK WHETHER THERE IS A CONSENT FORM ATTACHED FOR SOLUTIONS THAT ARE NOT PUBLIC (status = 2)
			// ONLY THESE CAN BE PUBLISED IN THE FRONT-END
			if (results.length) return datastructures.legacy.publishablepad({ connection: t, data: results })
			else return results
		}).catch(err => console.log(err))
	}).then(async results => {
		const data = await join.users(results, [ language, 'owner' ])

		return {
			data,
			// count: (page - 1) * page_content_limit,
			// count: page * page_content_limit,
			count: page_content_limit,
			sections: [{ data }]
		}
	}).catch(err => console.log(err))
}
