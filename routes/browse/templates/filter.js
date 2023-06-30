const { modules, DB, engagementtypes } = include('config/')
const { parsers } = include('routes/helpers/')

exports.main = req => {
	const { uuid, rights, collaborators } = req.session || {}
	const { object, space } = req.params || {}
	let { search, status, contributors, countries, templates, mobilizations, page } = Object.keys(req.query)?.length ? req.query : Object.keys(req.body)?.length ? req.body : {}

	// MAKE SURE WE HAVE PAGINATION INFO
	if (!page) page = 1
	else page = +page	

	const module_rights = modules.find(d => d.type === object)?.rights
	let collaborators_ids = collaborators.map(d => d.uuid) //.filter(d => d.rights >= (module_rights?.write ?? Infinity)).map(d => d.uuid)
	if (!collaborators_ids.length) collaborators_ids = [ uuid ]
	
	// FILTERS
	return new Promise(async resolve => {

		// BASE FILTERS
		const base_filters = []
		if (search) base_filters.push(DB.pgp.as.format(`t.full_text ~* $1`, [ parsers.regexQuery(search) ]))
		if (status) base_filters.push(DB.pgp.as.format(`t.status IN ($1:csv)`, [ status ]))

		let f_space = ''
		if (space === 'private') f_space = DB.pgp.as.format(`(t.owner IN ($1:csv) AND t.id NOT IN (SELECT template FROM review_templates))`, [ collaborators_ids ])
		if (space === 'curated') f_space = DB.pgp.as.format(`
			(t.id IN (
					SELECT template FROM mobilizations 
					WHERE child = TRUE 
						AND source IN (
							SELECT id FROM mobilizations WHERE owner IN ($1:csv)
						)
					) 
				OR $2 > 2) 
			AND (t.owner NOT IN ($1:csv) OR t.owner IS NULL) AND t.status < 2`, [ collaborators_ids, rights ])
		engagementtypes.forEach(e => {
			if (space === `${e}s`) f_space = DB.pgp.as.format(`t.id IN (SELECT docid FROM engagement WHERE user = $1 AND doctype = 'template' AND type = $2 AND t.id NOT IN (SELECT template FROM review_templates))`, [ uuid, e ])
		})
		if (space === 'shared') f_space = DB.pgp.as.format(`(t.status = 2 AND t.id NOT IN (SELECT template FROM review_templates))`)
		if (space === 'public') f_space = DB.pgp.as.format(`(t.status = 3 t.id NOT IN (SELECT template FROM review_templates))`)
		if (space === 'reviews') f_space = DB.pgp.as.format(`t.id IN (SELECT template FROM review_templates)`)
		// TO DO: curated SPACE FOR SUDO

		base_filters.push(f_space)

		// PLATFORM FILTERS
		const platform_filters = []
		if (templates) platform_filters.push(DB.pgp.as.format(`t.id IN ($1:csv)`, [ templates ]))
		if (contributors) platform_filters.push(DB.pgp.as.format(`t.owner IN ($1:csv)`, [ contributors ]))
		if (countries) {
			platform_filters.push(await DB.general.any(`
				SELECT uuid FROM users WHERE iso3 IN ($1:csv)
			;`, [ countries ])
			.then(results =>  DB.pgp.as.format(`t.owner IN ($1:csv)`, [ results.map(d => d.uuid) ]))
			.catch(err => console.log(err)))
		}
		if (mobilizations) platform_filters.push(DB.pgp.as.format(`t.id IN (SELECT template FROM mobilizations WHERE id IN ($1:csv))`, [ mobilizations ]))

		// ORDER
		let order = DB.pgp.as.format(`ORDER BY t.date DESC`)

		let filters = [ base_filters.filter(d => d).join(' AND '), platform_filters.filter(d => d).join(' OR ') ]
			.filter(d => d)
			.map(d => `(${d.trim()})`)
			.join(' AND ')
			.trim()

		if (filters.length && filters.slice(0, 3) !== 'AND') filters = `AND ${filters}`
		
		resolve([ `AND ${f_space}`, order, page, filters ])
	})

	// const platform_filters = [f_contributors, f_countries, f_mobilizations].filter(d => d).join(' OR ')
	// const content_filters = [].filter(d => d).join(' OR ')
	// const display_filters = []

	// let filters = ''
	// if (f_templates) {
	// 	filters += f_templates
	// 	if (f_search || f_status || platform_filters !== '' || (platform_filters === '' && content_filters !== '')) filters += ' AND '
	// }
	// if (f_search) {
	// 	filters += f_search
	// 	if (f_status || platform_filters !== '' || (platform_filters === '' && content_filters !== '')) filters += ' AND '
	// }
	// if (f_status) {
	// 	filters += f_status
	// 	if (platform_filters !== '' || (platform_filters === '' && content_filters !== '')) filters += ' AND '
	// }
	// if (platform_filters !== '') {
	// 	filters += `(${platform_filters})`
	// 	if (content_filters !== '') filters += ' AND '
	// }
	// if (content_filters !== '') filters += `(${content_filters})`
	// if (filters.length) filters = `AND ${filters}`

	// return [ f_space, order, page, filters ]
}