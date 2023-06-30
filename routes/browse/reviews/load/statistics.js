const { modules, DB } = include('config/')
const { datastructures, checklanguage, flatObj } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	// THIS NEEDS TO BE A TASK
	const { req } = kwargs || {}
	const { object } = req.params || {}
	const { uuid, rights, collaborators } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)
	
	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]

	// TO DO: UPDATE THIS
	return conn.task(t => {
		const batch = []
		// GET PADS COUNT BY STATUS
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (id))::INT, status FROM (
				SELECT p.id,
				COALESCE((SELECT status FROM reviews WHERE review = p.id), -1) AS status

				FROM pads p
				WHERE TRUE 
					$2:raw
			) AS t
			GROUP BY status
			ORDER BY status
		;`, [ uuid, f_space ]).then(d => { return { total: d } }))
		// GET PADS COUNT, ACCORDING TO FILTERS
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (id))::INT, status FROM (
				SELECT p.id,
				COALESCE((SELECT status FROM reviews WHERE review = p.id), -1) AS status

				FROM pads p
				WHERE TRUE 
					$2:raw
			) AS t
			GROUP BY status
			ORDER BY status
		;`, [ uuid, full_filters ]).then(d => { return { filtered: d } }))
		// GET PADS COUNT, ACCORDING TO FILTERS BUT WITHOUT STATUS
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (id))::INT, status FROM (
				SELECT p.id,
				COALESCE((SELECT status FROM reviews WHERE review = p.id), -1) AS status

				FROM pads p
				WHERE TRUE 
					$2:raw
			) AS t
			GROUP BY status
			ORDER BY status
		;`, [ uuid, full_filters.replace(/\-\- BEGIN STATUS FILTER \-\-[\s\S]*\-\- END STATUS FILTER \-\-/g, '') ]).then(d => { return { persistent: d } }))
		// EXPLANATION FOR [\s\S] IN REGEX ABOVE: https://stackoverflow.com/questions/6711971/regular-expressions-match-anything
		
		// GET PENDING REVIEWS COUNT
		// TO DO: THE COUNT IS NO GOOD HERE
		batch.push(t.one(`
			SELECT COUNT (DISTINCT(pad))::INT FROM review_requests
			WHERE id IN (SELECT request FROM reviewer_pool WHERE (reviewer = $1 OR $2 > 2) AND status = 0)
				AND pad NOT IN (SELECT pad FROM reviews WHERE reviewer = $1)
		;`, [ uuid, rights ], d => d.count).then(d => { return { pending: d } }))
		
		// GET ONGOING/ ACCEPTED REVIEWS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT(review)) FROM reviews
			WHERE reviewer = $1
				AND status < 2

			-- SELECT COUNT (DISTINCT (p.id))::INT FROM pads p
			-- WHERE p.id IN (SELECT review FROM reviews WHERE reviewer = $1)
			--	 AND p.status < 2
		;`, [ uuid ], d => d.count).then(d => { return { ongoing: d } }))

		// GET PAST REVIEWS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT(review)) FROM reviews
			WHERE reviewer = $1
				AND status >= 2

			-- SELECT COUNT (DISTINCT (p.id))::INT FROM pads p
			-- WHERE p.id IN (SELECT review FROM reviews WHERE reviewer = $1)
			--	AND p.status >= 2
		;`, [ uuid ], d => d.count).then(d => { return { past: d } }))
		
		
		return t.batch(batch)
	}).then(d => flatObj.call(d))
	.catch(err => console.log(err))
}