const { modules, DB } = include('config/')
const helpers = include('routes/helpers/')

const filter = require('../filter').main

exports.main = kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.general
	const { req } = kwargs || {}
	const { uuid, rights, collaborators } = req.session || {}
	// GET FILTERS
	const [ f_space, page, full_filters ] = filter(req) // THERE IS ONLY ONE f_space FOR NOW SO WE DO NOT NEED TO USE IT. IT IS ONLY HERE FOR CONSISTENCY
	
	return conn.task(t => {
		const batch = []

		// GET CONTRIBUTOR BREAKDOOWN BY CONFIRMATION STATUS
		batch.push(t.any(`
			SELECT COUNT(DISTINCT (u.uuid))::INT, u.confirmed::INT AS status FROM users u
			WHERE TRUE
				$1:raw
			GROUP BY status
			ORDER BY status
		;`, [ f_space || '' ]).then(d => { return { total: d } }))
		// GET CONTRIBUTOR COUNT, ACCORDING TO FILTERS
		batch.push(t.any(`
			SELECT COUNT(DISTINCT (u.uuid))::INT, u.confirmed::INT AS status FROM users u
			WHERE TRUE
				$1:raw
			GROUP BY status
			ORDER BY status
		;`, [ full_filters.replace(`AND LEFT(u.name, 1) = '${page}'`, '') ]).then(d => { return { filtered: d } })) // WE NEED TO REMOVE THE PAGE FILTER
		// GET CONTRIBUTOR COUNT, ACCORDING TO FILTERS WITH PAGE FILTER
		batch.push(t.any(`
			SELECT COUNT(DISTINCT (u.uuid))::INT, u.confirmed::INT AS status FROM users u
			WHERE TRUE
				$1:raw
			GROUP BY status
			ORDER BY status
		;`, [ full_filters ]).then(d => { return { displayed: d } }))
		// GET CONTRIBUTOR COUNT, ACCORDING TO FILTERS BUT WITHOUT STATUS
		batch.push(t.any(`
			SELECT COUNT(DISTINCT (u.uuid))::INT, u.confirmed::INT AS status FROM users u
			WHERE TRUE
				$1:raw
			GROUP BY status
			ORDER BY status
		;`, [ full_filters.replace(`AND LEFT(u.name, 1) = '${page}'`, '').replace(/AND u.confirmed::INT IN \([\'\d\,\s]+\)/g, '') ]).then(d => { return { persistent: d } })) // WE NEED TO REMOVE THE PAGE FILTER

		// GET INVITED CONTRIBUTOR BREAKDOOWN BY CONFIRMATION STATUS
		batch.push(t.one(`
			SELECT COUNT(DISTINCT (u.uuid))::INT FROM users u
			WHERE uuid IN (SELECT contributor FROM cohorts WHERE host = $1)
				OR $2::INT > 2
		;`, [ uuid, rights ], d => d.count).then(d => { return { invited: d } }))
		// GET ALL CONTRIBUTOR BREAKDOOWN BY CONFIRMATION STATUS
		batch.push(t.one(`
			SELECT COUNT(DISTINCT (u.uuid))::INT FROM users u
			WHERE rights >= $1::INT
		;`, [ modules.find(d => d.type === 'pads')?.rights.write || 4 ], d => d.count).then(d => { return { all: d } }))

		// GET CONTRIBUTOR COUNT BY FIRST LETTER (FOR pagination)
		batch.push(t.any(`
			SELECT COUNT(DISTINCT (u.uuid))::INT, LEFT (u.name, 1) AS initial FROM users u
			WHERE TRUE 
				$1:raw
				-- uuid IN (SELECT contributor FROM cohorts WHERE host = $2)
				-- OR $3::INT > 2
			GROUP BY initial
		;`, [ full_filters.replace(/(\s)?AND LEFT\(u\.name, 1\) = \'[A-Z]\'/g, ''), uuid, rights ]).then(d => { return { toc: d } }))

		return t.batch(batch)
	}).then(d => helpers.flatObj.call(d))
	.catch(err => console.log(err))
}