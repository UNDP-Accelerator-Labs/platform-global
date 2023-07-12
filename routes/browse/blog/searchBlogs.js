const { searchBlogQuery } = require('./query')

exports.main = async kwargs => {
	const conn = kwargs.connection ? kwargs.connection : DB.conn
	const { req, res, baseurl, page, page_content_limit } = kwargs || {}

    const searchText = req.query.search ||  '';
	let { source, search, country, type } = req.query || {}

	return conn.task(t => {
			return t.any(searchBlogQuery(searchText, page, country, type)).then(async (results) => {
				return {
					searchResults : results,
					page,
					total_pages : results[0]?.total_pages || 0,
					totalRecords : results[0]?.total_records || 0
				}
			  
			}).catch(err => {
				console.log(err);
				return {
					searchResults : []
				}
			})
		
	})
}