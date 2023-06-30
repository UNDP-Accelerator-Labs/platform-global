const { DB } = include('config/')
const helpers = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	// THIS NEEDS TO BE A TASK
	const { req } = kwargs || {}
	const { uuid, rights } = req.session || {}
	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)

	return conn.task(t => {
		const batch = []
		// GET MOBILIZATIONS COUNT
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (m.id))::INT, m.status 
			FROM mobilizations m
			WHERE (m.owner = $1
				OR $1 IN (SELECT mc.participant FROM mobilization_contributors mc WHERE mc.mobilization = m.id)
				OR $2 > 2)
				$3:raw
			GROUP BY m.status
			ORDER BY m.status
		;`, [ uuid, rights, f_space ]).then(d => { return { total: d } }))
		// GET MOBILIZATIONS COUNT, ACCORDING TO FILTERS
		batch.push(t.any(`
			SELECT COUNT (DISTINCT (m.id))::INT, m.status 
			FROM mobilizations m
			WHERE (m.owner = $1
				OR $1 IN (SELECT mc.participant FROM mobilization_contributors mc WHERE mc.mobilization = m.id)
				OR $2 > 2)
				$3:raw
			GROUP BY m.status
			ORDER BY m.status
		;`, [ uuid, rights, full_filters ] ).then(d => { return { filtered: d } }))
		// GET SCHEDULED MOBILIZATIONS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (m.id))::INT FROM mobilizations m
			WHERE (m.owner = $1
				OR $2 > 2)
			AND m.status = 0
		;`, [ uuid, rights ], d => d.count).then(d => { return { scheduled: d } }))
		// GET ONGOIONG MOBILIZATIONS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (m.id))::INT FROM mobilizations m
			WHERE (m.owner = $1
				OR $1 IN (SELECT mc.participant FROM mobilization_contributors mc WHERE mc.mobilization = m.id)
				OR $2 > 2)
			AND m.status = 1
		;`, [ uuid, rights ], d => d.count).then(d => { return { ongoing: d } }))
		// GET PAS MOBILIZATIONS COUNT
		batch.push(t.one(`
			SELECT COUNT (DISTINCT (m.id))::INT FROM mobilizations m
			WHERE (m.owner = $1
				OR $1 IN (SELECT mc.participant FROM mobilization_contributors mc WHERE mc.mobilization = m.id)
				OR $2 > 2)
			AND m.status = 2
		;`, [ uuid, rights ], d => d.count).then(d => { return { past: d } }))

		return t.batch(batch)
	}).then(d => helpers.flatObj.call(d))
	.catch(err => console.log(err))
}