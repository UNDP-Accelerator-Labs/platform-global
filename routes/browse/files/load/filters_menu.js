const { modules, metafields, DB } = include('config/')
const { array, join, flatObj } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	// THIS NEEDS TO BE A TASK
	const { req, participations } = kwargs || {}
	const { uuid, rights, collaborators } = req.session || {}
	const { space } = req.params || {}
	const language = checklanguage(req.params?.language || req.session.language)
	// GET FILTERS
	const [ f_space, order, page, full_filters ] = await filter(req)

	return conn.task(t => {
		const batch = []
		// GET CONTRBIUTOR BREAKDOWN
		// DEPENDING ON space, GET names OR COUNTRIES
		batch.push(t.task(t1 => {
			const batch1 = []
			if (space === 'private') {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (id))::INT, owner 
					FROM files
					WHERE owner IN ($1:csv)
					GROUP BY owner
				;`, [ req.session.collaborators.map(d => d.uuid) ])
				.then(async results => {
					const contributors = await join.users(results, [ language, 'owner' ])
					// THIS NEEDS SOME CLEANING FOR THE FRONTEND
					contributors = contributors.map(d => {
						const obj = {}
						obj.id = d.owner
						obj.name = d.ownername
						obj.count = d.count
						return obj
					})
					contributors.sort((a, b) => a.name?.localeCompare(b.name))

					return contributors.length ? { contributors } : null
				}).catch(err => console.log(err)))
			} else if (space === 'public') {
				batch1.push(t1.any(`
					SELECT f.owner
					FROM files f
					WHERE TRUE
						$1:raw
				;`, [ f_space ])
				.then(async results => {
					let countries = await join.users(results, [ language, 'owner' ])
					countries = array.count.call(countries, { key: 'country', keyname: 'name', keep: 'iso3' })
					// THIS NEEDS SOME CLEANING FOR THE FRONTEND
					countries = countries.map(d => {
						const obj = {}
						obj.id = d.iso3
						obj.name = d.country
						obj.count = d.count
						return obj
					})
					countries.sort((a, b) => a.name?.localeCompare(b.name))

					return countries.length ? { countries } : null
				}).catch(err => console.log(err)))
			} else batch1.push(null)
			
			// GET TEMPLATE BREAKDOWN
			// if (modules.includes('templates')) {
			if (modules.some(d => d.type === 'templates')) {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (f.id))::INT, t.id, t.title FROM files f
					INNER JOIN pads p
						ON f.source = p.id
					INNER JOIN templates t 
						ON p.template = t.id
					WHERE TRUE 
						$1:raw
					GROUP BY t.id
				;`, [ f_space ]).then(results => { 
					// THIS NEEDS SOME CLEANING FOR THE FRONTEND
					const templates = results.map(d => {
						const obj = {}
						obj.id = d.id
						obj.name = d.title
						obj.count = d.count
						return obj
					})
					templates.sort((a, b) => a.name?.localeCompare(b.name))

					return templates.length ? { templates } : null
				}))
			} else batch1.push(null)
			
			// GET MOBILIZATIONS BREAKDOWN
			// TO DO: IF USER IS NOT HOST OF THE MBILIZATION, ONLY MAKE THIS AVAILABLE IN PUBLIC VIEW
			// (CONTRIBUTORS CAN ONLY SEE WHAT OTHERS HAVE PUBLISHED)
			// if (modules.includes('mobilizations') && participations.length) {
			if (modules.some(d => d.type === 'mobilizations') && participations.length) {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (f.id))::INT, m.id, m.title AS name FROM files f
					LEFT JOIN pads p
						ON f.source = p.id
					INNER JOIN mobilization_contributions mc 
						ON mc.pad = p.id
					INNER JOIN mobilizations m
						ON m.id = mc.mobilization
					WHERE m.id IN ($1:csv)
						$2:raw
					GROUP BY m.id
					ORDER BY m.title
				;`, [ participations.map(d => d.id), f_space ]).then(results => { 
					// THIS NEEDS SOME CLEANING FOR THE FRONTEND
					// const mobilizations = results.map(d => {
					// 	const obj = {}
					// 	obj.id = d.id
					// 	obj.name = d.title
					// 	obj.count = d.count
					// 	return obj
					// })
					results.sort((a, b) => a.name?.localeCompare(b.name))

					return results.length ? { mobilizations: results } : null
				}))
			} else batch1.push(null)

			return t1.batch(batch1)
			.then(results => results.filter(d => d))
		}).catch(err => console.log(err)))
		
		// GET THE TAG BREAKDOWNS
		batch.push(t.task(t1 => {
			const batch1 = []
			metafields.filter(d => ['tag', 'index'].includes(d.type))
			.forEach(d => {
				batch1.push(t1.any(`
					SELECT COUNT (DISTINCT (pad))::INT, tag_id AS id FROM tagging
					WHERE type = $1
					GROUP BY tag_id
				;`, [ d.label ]).then(async results => { 
					const tags = await join.tags(results, [ language, 'id', d.label, d.type ])
					// if (d.label.toLowerCase() === 'sdgs') {
					if (d.type === 'index') {
						tags.forEach(d => {
							d.name = `${d.key} – ${d.name}`
							// d.id = d.key
							// delete d.key
						})
					}
					tags.sort((a, b) => a.name?.localeCompare(b.name))
					return tags.length ? { tags } : null
				}))
			})

			// if (metafields.includes('tags')) {
			// 	batch1.push(t1.any(`
			// 		SELECT COUNT (DISTINCT (pad))::INT, tag_id AS id FROM tagging
			// 		WHERE type = 'tag'
			// 		GROUP BY tag_id
			// 	;`).then(async results => { 
			// 		const thematic_areas = await join.tags(results, [ language, 'id', 'tags' ])
			// 		thematic_areas.sort((a, b) => a.name?.localeCompare(b.name))
			// 		return thematic_areas.length ? { thematic_areas } : null
			// 	}))
			// } else batch1.push(null)

			// // GET THE SDGs BREAKDOWN
			// if (metafields.includes('sdgs')) {
			// 	batch1.push(t1.any(`
			// 		SELECT COUNT (DISTINCT (pad))::INT, tag_id AS id FROM tagging
			// 		WHERE type = 'sdg'
			// 		GROUP BY tag_id
			// 		ORDER BY tag_id
			// 	;`).then(async results => { 
			// 		const sdgs = await join.tags(results, [ language, 'id', 'sdgs' ])
			// 		sdgs.forEach(d => {
			// 			d.name = `${d.key} – ${d.name}`
			// 			d.id = d.key
			// 			delete d.key
			// 		})
			// 		return sdgs.length ? { sdgs } : null
			// 	}))
			// } else batch1.push(null)

			// // GET THE METHODS (SKILLS) BREAKDOWN
			// if (metafields.includes('methods')) {
			// 	batch1.push(t1.any(`
			// 		SELECT COUNT (DISTINCT (pad))::INT, tag_id AS id FROM tagging
			// 		WHERE type = 'skill'
			// 		GROUP BY tag_id
			// 	;`).then(async results => { 
			// 		const methods = await join.tags(results, [ language, 'id', 'methods' ])
			// 		methods.sort((a, b) => a.name?.localeCompare(b.name))
			// 		return methods.length ? { methods } : null
			// 	}))
			// } else batch1.push(null)
			
			// // GET THE DATA SOURCES BREAKDOWN
			// if (metafields.includes('datasources')) {
			// 	batch1.push(t1.any(`
			// 		SELECT COUNT (DISTINCT (pad))::INT, tag_id AS id FROM tagging
			// 		WHERE type = 'datasource'
			// 		GROUP BY tag_id
			// 	;`).then(async results => { 
			// 		const datasources = await join.tags(results, [ language, 'id', 'datasources' ])
			// 		datasources.sort((a, b) => a.name?.localeCompare(b.name))
			// 		return datasources.length ? { datasources } : null
			// 	}))
			// } else batch1.push(null)

			return t1.batch(batch1)
			.then(results => results.filter(d => d))
		}).catch(err => console.log(err)))
		
		return t.batch(batch)
		.then(results => results.filter(d => d.length))
	}).then(results => {
		return results.map(d => flatObj.call(d))
	})
}