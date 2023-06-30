const { DB } = include('config/')

exports.joinObj = function (obj = {}) {
	return {...this, ...obj}
}
exports.multijoin = function (args = []) {
	const [ arr, key ] = args
	return this.map(d => {
		const obj = arr.find(c => c[key] === d[key]) || {}
		return {...d, ...obj}
	})
}
exports.users = (data, args = []) => {
	const [ lang, key ] = args
	if (!key) key = 'owner'

	if ((Array.isArray(data) && data.length) || data?.[key]) {
		return DB.general.any(`
			SELECT u.uuid AS $1:name, u.name AS ownername, u.iso3, u.position, cn.name AS country FROM users u 
			INNER JOIN country_names cn
				ON u.iso3 = cn.iso3
			WHERE u.uuid IN ($2:csv)
				AND cn.language = $3
		;`, [ key, Array.isArray(data) ? data.map(d => d[key]) : data[key], lang ])
		.then(users => {
			if (Array.isArray(data)) return this.multijoin.call(data, [ users, key ])
			else return this.joinObj.call(data, users[0])
		}).catch(err => console.log(err))
	} else return new Promise(resolve => resolve(data))
}
exports.tags = (data, args = []) => {
	const [ lang, key, tagname, tagtype ] = args
	if (!key) return false

	if (data?.length) {
		return DB.general.tx(t => {
			return t.any(`SELECT id AS $1:name, key, language FROM tags WHERE id IN ($2:csv);`, [ key, data.map(d => d[key]) ])
			.then(results => {
				data = this.multijoin.call(data, [ results, key ])

				const batch = []

				const tags_with_equivalences = data.filter(d => ![undefined, null].includes(d.key))
				const tags_without_equivalences = data.filter(d => [undefined, null].includes(d.key))

				if (tags_with_equivalences.length) {
					batch.push(t.any(`
						SELECT t.id AS $1:name, t.key, t.name,

						COALESCE((SELECT jsonb_agg(id) FROM tags WHERE key = t.key GROUP BY key), '[]') AS equivalents

						FROM tags t
						WHERE t.type = $2
							AND key IN ($3:csv)
							AND language = (COALESCE((SELECT language FROM tags WHERE type = $2 AND language = $4 LIMIT 1), 'en'))
					;`, [ key, tagname, tags_with_equivalences.map(d => d.key), lang ])
					.then(tags => {
						// data = this.multijoin.call(data, [ results, key ])
						return this.multijoin.call(tags_with_equivalences, [ tags, 'key' ])
						// return { key: 'key', tags }
					}).catch(err => console.log(err)))	
				}
				if (tags_without_equivalences.length) {
					batch.push(t.any(`
						SELECT id AS $1:name, key, name FROM tags 
						WHERE type = $2
							AND id IN ($3:csv)
							AND language = (COALESCE((SELECT language FROM tags WHERE type = $2 AND language = $4 LIMIT 1), 'en'))
					;`, [ key, tagname, tags_without_equivalences.map(d => d[key]), lang ])
					.then(tags => {
						return this.multijoin.call(tags_without_equivalences, [ tags, key ])
						// return { key, tags }
					}).catch(err => console.log(err)))
				}

				return t.batch(batch)
				.then(results => {
					return results.flat()
				}).catch(err => console.log(err))
			}).catch(err => console.log(err))
		}).catch(err => console.log(err))

		// FIND LANGUAGE OF TAGS IN DATA
		// IF THERE IS A CORRESPONDANCE THEN FIND IN REQUESTED lang

		// let sql = ''
		// if (tagtype === 'index') {
		// 	sql = DB.pgp.as.format(`
		// 		SELECT id AS $1:name, key, name FROM tags 
		// 		WHERE type = $2
		// 			AND id IN ($3:csv)
		// 			AND language = (COALESCE((SELECT language FROM tags WHERE type = $2 AND language = $4 LIMIT 1), 'en'))
		// 	;`, [ key, tagname.slice(0, -1), data.map(d => d[key]), lang ])
		// } else {
		// 	sql = DB.pgp.as.format(`
		// 		SELECT id AS $1:name, name FROM tags
		// 		WHERE type = $2
		// 			AND id IN ($3:csv)
		// 			AND language = (COALESCE((SELECT language FROM tags WHERE type = $2 AND language = $4 LIMIT 1), 'en'))
		// 	;`, [ key, tagname.slice(0, -1), data.map(d => d[key]), lang ])
		// }

		// return DB.general.any(`
		// 	SELECT id AS $1:name, key, name FROM tags 
		// 	WHERE type = $2
		// 		AND id IN ($3:csv)
		// 		AND language = (COALESCE((SELECT language FROM tags WHERE type = $2 AND language = $4 LIMIT 1), 'en'))
		// ;`, [ key, tagname, data.map(d => d[key]), lang ])
	} else return new Promise(resolve => resolve(data))
}