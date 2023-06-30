const { DB } = include('config/')
const helpers = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	// THIS NEEDS TO BE A TASK
	const { req } = kwargs || {}
	const { uuid, rights, collaborators } = req.session || {}
	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)

	return conn.task(t => {
		const batch = []
		// GET FILES COUNT BY STATUS
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (f.id))::INT, f.status FROM files f
			WHERE TRUE
				$1:raw
			GROUP BY f.status
			ORDER BY f.status
		;`, [ f_space ]).then(d => { return { total: d } }))
		// GET FILES COUNT, ACCORDING TO FILTERS

	// EVERYWHERE THERE IS A LEFT JOIN mobilization_contributions NEED TO CHANGE
	// BUT FIRST, ADD COLUMN TO mobilization_contributions TO INCLUDE files

		batch.push(t.any(`
			SELECT COUNT (DISTINCT (f.id))::INT, f.status FROM files f
			LEFT JOIN pads p
				ON f.source = p.id
			LEFT JOIN mobilization_contributions mob
				ON p.id = mob.pad
			WHERE TRUE 
				$1:raw $2:raw
			GROUP BY f.status
			ORDER BY f.status
		;`, [ full_filters, f_space ]).then(d => { return { filtered: d } }))
		// GET PRIVATE FILES COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (f.id))::INT FROM files f
			WHERE f.owner IN ($1:csv)
				OR $2 > 2
		;`, [ collaborators.map(d => d.uuid), rights ], d => d.count).then(d => { return { private: d } }))
		// GET SHARED FILES COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (f.id))::INT FROM files f
			WHERE f.status = 2
		;`, [], d => d.count).then(d => { return { shared: d } }))
		// GET PUBLIC FILES COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (f.id))::INT FROM files f
			WHERE f.status = 3
		;`, [], d => d.count).then(d => { return { public: d } }))
		// GET A COUNT OF CONTRBIUTORS: NOTE THIS IS NOT USED IN THE FRONT END FOR NOW
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (f.owner))::INT FROM files f
			WHERE TRUE
				$1:raw
		;`, [ full_filters ]))
		return t.batch(batch)
	}).then(d => helpers.flatObj.call(d))
	.catch(err => console.log(err))
}