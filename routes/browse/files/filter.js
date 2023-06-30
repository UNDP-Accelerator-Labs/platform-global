const { DB, engagementtypes } = include('config/')
const { parsers } = include('routes/helpers/')

exports.main = req => {
	const { uuid, country, rights, collaborators } = req.session || {}
	const { space } = req.params || {}
	let { pads, search, contributors, countries, templates, mobilizations, methods, datasources, sdgs, tags, page } = Object.keys(req.query)?.length ? req.query : Object.keys(req.body)?.length ? req.body : {}
	const sudo = rights > 2
	
	// MAKE SURE WE HAVE PAGINATION INFO
	if (!page) page = 1
	else page = +page
	
	// FILTERS
	return new Promise(async resolve => {
		// TO DO: CHANGE pads TO files, ALSO IN THE req.query
		const f_pads = pads ? DB.pgp.as.format(`f.id IN ($1:csv)`, [ pads ]) : null
		// SEARCH IS ONLY AVAILABLE FOR PAD-BASED FILES (pdf) IN files BECAUSE THERE IS NO full_text REPRESENTATION
		// THIS WOULD REQUIRE PARSING THE pdf IN A PYTHON CHILD PROCESS UPON UPLOAD
		const f_search = search ? DB.pgp.as.format(`(f.full_text ~* $1 OR f.name ~* $1)`, [ parsers.regexQuery(search) ]) : null
		const f_contributors = contributors ? DB.pgp.as.format(`f.owner IN ($1:csv)`, [ contributors ]) : null

		let f_countries = null
		if (countries) {
			f_countries = await DB.general.any(`
				SELECT uuid FROM users WHERE iso3 IN ($1:csv)
			;`, [ countries ])
			.then(results =>  DB.pgp.as.format(`f.owner IN ($1:csv)`, [ results.map(d => d.uuid) ]))
			.catch(err => console.log(err))
		}

		const f_templates = templates ? DB.pgp.as.format(`f.source IN (SELECT id FROM pads WHERE template IN ($1:csv))`, [ templates ]) : null
		// THE MOBILIZATION FILTER BELOW WILL ONLY PICK UP ON FILES GENERATED IN THE PLATFORM, NOT ON FILES UPLOADED
		const f_mobilizations = mobilizations ? DB.pgp.as.format(`f.source IN (SELECT pad FROM mobilization_contributions WHERE mobilization IN ($1:csv))`, [ mobilizations ]) : null
		
		// PUBLIC/ PRIVATE FILTERS
		let f_space = ''
		if (space === 'private' && !sudo) f_space = DB.pgp.as.format(`AND f.owner IN ($1:csv)`, [ collaborators.map(d => d.uuid) ])
		
		engagementtypes.forEach(e => {
			if (space === `${e}s`) f_space = DB.pgp.as.format(`AND f.id IN (SELECT docid FROM engagement WHERE user = $1 AND doctype = 'file' AND type = $2)`, [ uuid, e ])
		})
		
		if (space === 'shared')	f_space = DB.pgp.as.format(`AND f.status = 2`)
		if (space === 'public')	f_space = DB.pgp.as.format(`AND f.status = 3`)
		// ORDER
		// let 	order = DB.pgp.as.format(`ORDER BY p.status ASC, p.date DESC`)
		let order = DB.pgp.as.format(`ORDER BY f.date DESC`)

		// ADDITIONAL FILTER FOR SETTING UP THE "LINKED PADS" DISPLAY
		// const f_sources = DB.pgp.as.format(`AND f.source IS NULL`)

		const platform_filters = [f_contributors, f_countries, f_templates, f_mobilizations].filter(d => d).join(' OR ')
		const content_filters = [].filter(d => d).join(' OR ') //[f_methods, f_datasources, f_tags, f_sdgs].filter(d => d).join(' OR ')
		const display_filters = []

		let filters = ''
		if (f_pads) {
			filters += f_pads
			if (f_search || platform_filters !== '' || (platform_filters === '' && content_filters !== '')) filters += ' AND '
		}
		if (f_search) {
			filters += f_search
			if (platform_filters !== '' || (platform_filters === '' && content_filters !== '')) filters += ' AND '
		}
		if (platform_filters !== '') {
			filters += `(${platform_filters})`
			if (content_filters !== '') filters += ' AND '
		}
		if (content_filters !== '') filters += `(${content_filters})`
		if (filters.length) filters = `AND ${filters}`

		resolve([ f_space, order, page, filters ])
	})
}