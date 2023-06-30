const { blogAggQuery, totalArticleTyle, totalCountries, totalUnknownCountries, countryGroup, articleGroup, statsQuery } = require('./query')

const { apps_in_suite, page_content_limit, followup_count, metafields, modules, engagementtypes, map, DB } = include('config/')
const { checklanguage, datastructures, engagementsummary, parsers, array, join } = include('routes/helpers/')

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	const { req, res, page } = kwargs || {};
	let { source, search, country, type } = req.query || {}
	if (!source || !apps_in_suite.some(d => d.key === source)) source = apps_in_suite[0].key

	const language = checklanguage(req.params?.language || req.session.language);

	return conn.task(t => {
        const batch = []

		batch.push(t.any(blogAggQuery).then(async (results) => results)
        .catch(err => console.log(err)))

        batch.push(t.any(statsQuery(search?.trim(), country, type)).then(async (results) => results)
        .catch(err => console.log(err)))

        return t.batch(batch)
		.catch(err => console.log(err))
        
	}).then(d =>  ({
        stats: d.flat()
    }))
	.catch(err => console.log(err))
}