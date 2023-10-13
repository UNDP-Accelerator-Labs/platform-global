const { DB } = include('config/')
const { datastructures, sessionupdate } = include('routes/helpers/')

module.exports = async (req, res, next) => {
	const { sessionID: sid } = req || {}
	const { uuid } = req.session || {}
	req.session.sessions = null

	if (uuid) {
		let cleared = await DB.general.tx(t => {
			return t.oneOrNone(`
				SELECT TRUE AS bool FROM session
				WHERE sid = $1
				AND sess ->> 'uuid' = $2
			;`, [ sid, uuid ], d => d.bool)
			.then(result => {
				if (result) {
					return t.one(`SELECT COALESCE(rights, 0)::INT AS rights FROM users WHERE uuid = $1;`, [ uuid ], d => d.rights)
					.then(result => {
						req.session.rights = result
						return true
					}).catch(err => console.log(err))
				} else return false
			}).catch(err => console.log(err))
		}).catch(err => console.log(err))

		if (cleared === true) next()
		else {
			await sessionupdate({
				conn: DB.general,
				whereClause: `sess ->> 'uuid' = $1`,
				queryValues: [uuid]
			})
			res.redirect('/login')
		}
	} 
	else { 
		Object.assign(req.session, datastructures.sessiondata({ public: true }))
		next()
	}
}
