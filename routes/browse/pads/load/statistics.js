const { apps_in_suite, modules, DB } = include('config/')
const { datastructures, checklanguage, flatObj } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	// THIS NEEDS TO BE A TASK
	const { req, res } = kwargs || {}
	const { object } = req.params || {}
	let source = kwargs.source || req.query.source || req.body.source
	if (!source || !apps_in_suite.some(d => d.key === source)) source = apps_in_suite[0].key

	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, rights, collaborators } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, rights, collaborators } = datastructures.sessiondata({ public: true }) || {}
	}
	const language = checklanguage(req.params?.language || req.session.language)

	// const { uuid, rights, collaborators } = req.session || {}
	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req, res, { source })
	
	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	return conn.task(t => {
		const batch = []
		// GET PADS COUNT BY STATUS
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (p.id))::INT, p.status FROM pads p
			WHERE p.id NOT IN (SELECT review FROM reviews)
				$1:raw
			GROUP BY p.status
			ORDER BY p.status
		;`, [ f_space ]).then(d => { return { total: d } })
		.catch(err => console.log(err)))
		// GET PADS COUNT, ACCORDING TO FILTERS
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (p.id))::INT, p.status FROM pads p
			LEFT JOIN mobilization_contributions mob
				ON p.id = mob.pad
			WHERE p.id NOT IN (SELECT review FROM reviews)
				$1:raw
			GROUP BY p.status
			ORDER BY p.status
		;`, [ full_filters ]).then(d => { return { filtered: d } })
		.catch(err => console.log(err)))
		// GET PADS COUNT, ACCORDING TO FILTERS BUT WITHOUT STATUS
		batch.push(t.any(`
			-- LOOKING FOR PERSISTENT BREAKDOWN
			SELECT COUNT (DISTINCT (p.id))::INT, p.status FROM pads p
			LEFT JOIN mobilization_contributions mob
				ON p.id = mob.pad
			WHERE p.id NOT IN (SELECT review FROM reviews)
				$1:raw
			GROUP BY p.status
			ORDER BY p.status
		;`, [ full_filters.replace(/(AND\s)?p\.status IN \([\'\d\,\s]+\)(\sAND\s)?/g, '') ]).then(d => { return { persistent: d } })
		.catch(err => console.log(err)))
		// GET PRIVATE PADS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (p.id))::INT FROM pads p
			WHERE p.owner IN ($1:csv)
				AND p.id NOT IN (SELECT review FROM reviews)
		;`, [ collaborators_ids, rights ], d => d.count).then(d => { return { private: d } })
		.catch(err => console.log(err)))
		// GET CURATED PADS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (p.id))::INT FROM pads p
			WHERE (p.id IN (
				SELECT mc.pad FROM mobilization_contributions mc
				INNER JOIN mobilizations m
					ON m.id = mc.mobilization
				WHERE m.owner IN ($1:csv) 
			) OR $2 > 2) 
				AND p.id NOT IN (SELECT review FROM reviews)
				AND (p.owner NOT IN ($1:csv) OR p.owner IS NULL)
				AND p.status < 2
		;`, [ collaborators_ids, rights ], d => d.count).then(d => { return { curated: d } })
		.catch(err => console.log(err)))
		// GET SHARED PADS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (p.id))::INT FROM pads p
			WHERE p.status = 2
				AND p.id NOT IN (SELECT review FROM reviews)
		;`, [], d => d.count).then(d => { return { shared: d } })
		.catch(err => console.log(err)))
		// GET UNDER REVIEW PADS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (p.id))::INT FROM pads p
			WHERE ((p.id IN (
					SELECT mc.pad FROM mobilization_contributions mc 
					INNER JOIN mobilizations m 
						ON m.id = mc.mobilization 
					WHERE m.owner IN ($1:csv)
				) OR $2 > 2) OR (p.owner IN ($1:csv)))
				AND p.id IN (SELECT pad FROM review_requests)
				AND p.id NOT IN (SELECT review FROM reviews)
		;`, [ collaborators_ids, rights ], d => d.count).then(d => { return { reviewing: d } })
		.catch(err => console.log(err)))
		// GET PUBLIC PADS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (p.id))::INT FROM pads p
			WHERE p.status = 3
				AND p.id NOT IN (SELECT review FROM reviews)
		;`, [], d => d.count).then(d => { return { public: d } })
		.catch(err => console.log(err)))
		// GET A COUNT OF CONTRBIUTORS
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (p.owner))::INT FROM pads p
			WHERE p.id NOT IN (SELECT review FROM reviews)
				$1:raw
		;`, [ full_filters ], d => d.count).then(d => { return { contributors: d } })
		.catch(err => console.log(err)))
		// GET A COUNT OF TAGS
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (tag_id))::INT, type FROM tagging
				WHERE pad IN (
					SELECT id FROM pads p 
						WHERE p.id NOT IN (SELECT review FROM reviews)
						$1:raw
				)
			GROUP BY type
		;`, [ full_filters ]).then(d => { return { tags: d } })
		.catch(err => console.log(err)))
		
		return t.batch(batch)
		.catch(err => console.log(err))
	}).then(d => flatObj.call(d))
	.catch(err => console.log(err))
}