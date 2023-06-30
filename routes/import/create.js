const { modules, metafields, DB } = include('config/')
const header_data = include('routes/header/').data
const { checklanguage, flatObj, datastructures } = include('routes/helpers/')

exports.main = async (req, res) => {
	const { object } = req.params || {}
	let { uuid, rights } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	DB.general.task(t => {
		const batch1 = metafields.filter(d => ['tag', 'index'].includes(d.type))
		.map(d => {
			return t.any(`
				SELECT id, key, name, type FROM tags 
				WHERE type = $1
					AND language = (COALESCE((SELECT language FROM tags WHERE type = $1 AND language = $2 LIMIT 1), 'en'))
			;`, [ d.label, language ])
			.then(results => {
				const obj = {}
				obj[d.label] = results
				return obj
			}).catch(err => console.log(err))
		})
		return t.batch(batch1)
		.then(results => {
			return flatObj.call(results)
		}).catch(err => console.log(err))
	}).then(async tags => {
		const metadata = await datastructures.pagemetadata({ req })
		return Object.assign(metadata, { tags })


		// return {

		// 	metadata : {
		// 		site: {
		// 			modules,
		// 			metafields
		// 		},
		// 		page: {
		// 			title: pagetitle, 
		// 			path,
		// 			referer: originalUrl,
		// 			language,
		// 			activity: path[1],
		// 			object,
		// 			query
		// 		},
		// 		menu: {
		// 			templates,
		// 			participations
		// 		},
		// 		user: {
		// 			name: username,
		// 			country,
		// 			// centerpoint: JSON.stringify(req.session.country?.lnglat || {}),
		// 			rights
		// 		}
		// 	},
		// 	tags
		// }
	}).then(data => res.render('import', data))
	.catch(err => console.log(err))
}