const { DB } = include('config/')

exports.main = (req, res) => {
	const { referer } = req.headers || {}
	const { id } = req.query || {}

	// EXECUTE SQL
	DB.conn.none(`
		UPDATE mobilizations 
		SET status = 2,
			end_date = NOW()
		WHERE id = $1::INT
	;`, [ id ])
	.then(_ => res.redirect(referer))
	.catch(err => console.log(err))
}
