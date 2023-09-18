const query = require('./query')
const { apps_in_suite, colors, DB } = include('config/')
const { checklanguage,join, datastructures, fetcher, safeArr } = include('routes/helpers/')
const filter = require('./filter')

exports.main = async (req, res) => {
	const language = checklanguage(req.params?.language || req.session.language)
	const [ full_filters ] = filter(req, res)

	return DB.conn.task(t => {
		const batch = []

		batch.push(t.any(query.statsQuery).then(d => d)
		.catch(err => console.log(err)))
	
		// LIST OF PINBOARDS/ COLLECTIONS
		batch.push(t.any(query.pinboad_list, [ full_filters ])
		.then(d => d.map(pbRow => ({
				...pbRow,
				}))
		)
		)

		return t.batch(batch)
		.catch(err => console.log(err))
	})
	.then(async results => {
		const [ stats, pinboards ] = results;
		let platform_stats = null;
		try {
			const global_urls = apps_in_suite
			  .map((d) => [
				{
				  key: d.name,
				  url: `${d.baseurl}/apis/fetch/statistics`,
				},
			  ])
			  .flat();
		
			const global_requests = global_urls.map((url) =>
			  fetcher(req, url.url,)
				.then((results) => ({
				  ...results,
				  key: url.key,
				}))
				.catch((err) => console.log(err))
			);
		
			platform_stats = await Promise.all(global_requests)
			  .then((results) => {
				return({
					total: results.reduce((acc, obj) => acc + obj.total, 0),
					data: [
						{ value: results[0]?.contributors || 0, color: colors['light-red'], label: 'Contributors' },
						{ value: results[0].tags[0]?.count || 0, color: colors['light-red'], label: 'SDG Tags' },
						{ value: results[0].tags[1]?.count || 0, color: colors['light-yellow'], label: 'Thematic areas' },
						{ value: results.filter(p=> p.key == 'Solutions Mapping')[0]?.total || 0, color: colors['light-blue'], label: 'Solution mapping' },
						{ value: results.filter(p=> p.key == 'Action Plans')[0]?.total || 0, color: colors['dark-blue'], label: 'Action Plans' },
						{ value: results.filter(p=> p.key == 'Experiments')[0]?.total || 0, color: colors['mid-blue-semi'], label: 'Experiments' },
					]
				});
			  })
			  .catch((err) => {
				console.log('err ', err)
				throw new Error
			  });

		  } catch (err) {
			console.log("An error occurred ", err);
			return res.redirect('/module-error')
		  }
		const metadata = await datastructures.pagemetadata({ req, res })
		const data = Object.assign(metadata, { stats: stats[0], platform_stats, pinboards })
		
		return res.render(`home`, data)
	})
	.catch(err => {
		console.log("An error occurred ", err);
		return res.redirect('/module-error')
	  })
}