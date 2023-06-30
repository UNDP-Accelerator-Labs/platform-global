const { modules, metafields, DB } = include('config/')
const { datastructures, checklanguage, count, flatObj } = include('routes/helpers/')

const filter = require('../filter').main

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.general
	// THIS NEEDS TO BE A TASK
	const { req } = kwargs || {}
	const { space } = req.params || {}
	const { uuid, rights, collaborators } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)
	// GET FILTERS
	const [ f_space, page, full_filters ] = await filter(req)

	return conn.task(t => {
		const batch = []

		batch.push(t.task(t1 => {
			const batch1 = []			
			// GET POSITION BREAKDOWN
			batch1.push(t1.any(`
				SELECT COUNT (DISTINCT (u.id))::INT, u.position AS id, u.position AS name FROM users u
				WHERE TRUE 
					$1:raw
				GROUP BY u.position
			;`, [ full_filters.replace(`AND LEFT(u.name, 1) = '${page}'`, '') ])
			.then(results => {
				return { positions: results }
			}))
			
			// GET COUNTRY BREAKDOWN
			batch1.push(t1.any(`
				SELECT COUNT (DISTINCT (u.id))::INT, u.iso3 AS id, cn.name AS name FROM users u
				INNER JOIN country_names cn
					ON cn.iso3 = u.iso3
				WHERE cn.language = $1
					$2:raw
				GROUP BY (u.iso3, cn.name)
				ORDER BY cn.name
			;`, [ language, full_filters.replace(`AND LEFT(u.name, 1) = '${page}'`, '') ])
			.then(results => { 
				return results.length ? { countries: results } : null
			}))

			// GET RIGHTS BREAKDOWN
			batch1.push(t1.any(`
				SELECT COUNT (DISTINCT (u.id))::INT, u.rights AS id, u.rights AS name FROM users u
				WHERE TRUE 
					$1:raw
				GROUP BY u.rights
			;`, [ full_filters.replace(`AND LEFT(u.name, 1) = '${page}'`, '') ])
			.then(results => { 
				return results.length ? { rights: results } : null
			}))
			
			return t1.batch(batch1)
			.then(results => results.filter(d => d))
		}).catch(err => console.log(err)))
	
		return t.batch(batch)
		.then(results => results.filter(d => d.length))
		.catch(err => console.log(err))
	}).then(results => {
		return results.map(d => flatObj.call(d))
	}).catch(err => console.log(err))
}