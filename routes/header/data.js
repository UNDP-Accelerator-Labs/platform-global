const { app_title, DB } = include('config/')
const { datastructures, checklanguage } = include('routes/helpers/')

exports.main = (kwargs) => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	const { req } = kwargs || {}
	let { path, query, headers } = req || {}
	path = path.substring(1).split('/')
	
	// const { uuid, username, country, rights } = req.session || {}
	if (req.session.uuid) { // USER IS LOGGED IN
		var { uuid, username, country, rights } = req.session || {}
	} else { // PUBLIC/ NO SESSION
		var { uuid, username, country, rights } = datastructures.sessiondata({ public: true }) || {}
	}
	const language = checklanguage(req.params?.language || req.session.language)
	
	// let { language } = req.params || kwargs.req.session || {}
	// language = checklanguage(language)

	// THIS IS PARSING THE QUERY TO SEND IT BACK TO THE CLIENT FOR PROPER DISPLAY IN FILTER MENU
	const parsedQuery = {}
	for (let key in query) {
		if (key === 'search') { 
			if (query[key].trim().length) parsedQuery[key] = query[key]//query[key].trim().toLowerCase().split(' or ').map(d => d.split(' ')).flat() // TO DO: CHECK THIS
		} else { //if (!['mscale'].includes(key)) {
			if (!Array.isArray(query[key])) parsedQuery[key] = [query[key]]
			else parsedQuery[key] = query[key]
		}
	}

	// ADD A CALL FOR ALL TEMPLATES (NAME + ID)
	return conn.tx(t => {
		const batch = []
		batch.push(t.any(`
			SELECT t.id, t.title FROM templates t
			WHERE t.status >= 2
				OR (t.status = 1 AND t.owner = $1)
		;`, [ uuid ]))
		batch.push(t.any(`
			SELECT mob.id, mob.title, mob.template, mob.source, mob.copy, mob.status,
				to_char(mob.start_date, 'DD Mon YYYY') AS start_date 
				-- c.name AS host_name 
			FROM mobilization_contributors mc
			INNER JOIN mobilizations mob
				ON mc.mobilization = mob.id
			-- INNER JOIN contributors c
			-- 	ON mob.host = c.id
			WHERE mc.participant = $1
		;`, [ uuid ]))
		return t.batch(batch)
	}).then(results => {
		const [ templates, participations ] = results

		// TO DO: ATTACH HOST NAME USING general DB // MAYBE THIS IS NOT NEEDED ACTUALLY
		// const data = await join.users(participations, req.session.language)

		return { 
			pagetitle: app_title, 
			path, 
			originalUrl: headers.referer, 
			uuid, 
			username, 
			country, 
			rights, 
			language, 
			query: parsedQuery, 
			templates,
			participations
		}
	}).catch(err => console.log(err))
}