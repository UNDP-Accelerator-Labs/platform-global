const { app_title, DB } = include('config/')
const { email: sendemail } = include('routes/helpers/')

exports.main = (req, res) => {
	const { referer } = req.headers || {}
	let { contributor, pinboard } = req.body || {}
	const { uuid, email: from, username } = req.session || {}

	if (!Array.isArray(contributor)) contributor = [contributor]
	const data = contributor.map(d => {
		const obj = {}
		obj.pinboard = pinboard
		obj.participant = d
		return obj
	})

	DB.conn.tx(t => {
		const batch = []
		const sql = `${DB.pgp.helpers.insert(data, [ 'pinboard', 'participant' ], 'pinboard_contributors')} ON CONFLICT ON CONSTRAINT unique_pinboard_contributor DO NOTHING;`
		batch.push(t.none(sql))
		batch.push(t.none(`
			DELETE FROM pinboard_contributors
			WHERE pinboard = $1::INT
				AND participant NOT IN ($2:csv)
				AND participant NOT IN (SELECT owner FROM pinboards WHERE id = $1::INT)
		;`, [ pinboard, contributor ]))
		return t.batch(batch)
		.then(_ => {
			return t.one(`SELECT title FROM pinboards WHERE id = $1::INT;`, [ pinboard ])
			.then(result => {
				const { title } = result
				return DB.general.any(`
					SELECT email FROM users
					WHERE uuid IN ($1:csv)
						AND uuid <> $2
						AND notifications = TRUE
				;`, [ contributor, uuid ])
				.then(results => {
					// SEND EMAIL NOTIFICATION
					// NEED TO CHECK IF EMAIL NOTIFICATIONS IS ACTIVATED
					return Promise.all(results.map(d => {
						sendemail({
							to: d.email,
							cc: from,
							subject: `[${app_title}] Collections`,
							html: `Dear contributor, ${username} has shared with you the follow collection on the ${app_title} platform:
								<br><br><strong>${title}</strong>
								<br><br>Please click <a href='${referer}'>this link</a> to view the collection.` // TO DO: TRANSLATE AND STYLIZE
						})
					})).then(_ => res.redirect(referer))
					.catch(err => console.log(err))
				}).catch(err => console.log(err))
			}).catch(err => console.log(err))
		}).catch(err => console.log(err))
	}).catch(err => console.log(err))
}
