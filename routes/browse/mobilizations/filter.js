const { DB, engagementtypes } = include('config/')
const { parsers } = include('routes/helpers/')

exports.main = req => { 
	const { uuid, rights } = req.session || {}
	const { space } = req.params || {}
	
	let { search, mobilizations, templates, page } = Object.keys(req.query)?.length ? req.query : Object.keys(req.body)?.length ? req.body : {}

	// MAKE SURE WE HAVE PAGINATION INFO
	if (!page) page = 1
	else page = +page

	const filters = []
	if (search) filters.push(DB.pgp.as.format(`AND (m.title ~* $1)`, [ parsers.regexQuery(search) ]))
	if (mobilizations) filters.push(DB.pgp.as.format(`AND m.id IN ($1:csv)`, [ mobilizations ]))
	if (templates) filters.push(DB.pgp.as.format(`AND m.template IN ($1:csv)`, [ templates ]))

	// ONGOING OR PAST MOBILIZATION
	let f_space = null
	if (space === 'scheduled') f_space = DB.pgp.as.format(`AND m.status = 0`)
	if (space === 'ongoing') f_space = DB.pgp.as.format(`AND m.status = 1`)
	if (space === 'past') f_space = DB.pgp.as.format(`AND m.status = 2`)

	if (f_space) filters.push(f_space)

	// ORDER
	let order = null
	if (['ongoing', 'scheduled'].includes(space)) order = DB.pgp.as.format(`ORDER BY m.start_date DESC`)
	if (space === 'past') order = DB.pgp.as.format(`ORDER BY m.end_date DESC, m.start_date DESC`)

	return [ f_space, order, page, filters.join(' ') ]
}