const { app_title, app_suite, DB } = include('config/')
const { email: sendemail } = include('routes/helpers/')

exports.main = (req, res) => {
	const { referer } = req?.headers || {}
	const { uuid, username } = req.session || {}
	let { id, new_name: name, new_email: email, new_position: position, new_password: password, iso3, language, rights, teams, reviewer, email_notifications: notifications, secondary_languages } = req.body || {}
	if (teams && !Array.isArray(teams)) teams = [teams]
	if (secondary_languages && !Array.isArray(secondary_languages)) secondary_languages = [secondary_languages]

	if (!id) {
		DB.general.tx(t => {
			return t.one(`
				INSERT INTO users (name, email, position, password, iso3, language, secondary_languages, rights, notifications, reviewer)
				VALUES ($1, $2, $3, crypt($4, GEN_SALT('bf', 8)), $5, $6, $7, $8, $9, $10)
				RETURNING uuid
			;`, [ 
				/* $1 */ name, 
				/* $2 */ email, 
				/* $3 */ position, 
				/* $4 */ password, 
				/* $5 */ iso3, 
				/* $6 */ language, 
				/* $7 */ JSON.stringify(secondary_languages || []), 
				/* $8 */ rights, 
				/* $9 */ notifications || false, 
				/* $10 */ reviewer || false 
			], d => d.uuid)
			.then(result => {
				const batch = []
				batch.push(t.none(`
					INSERT INTO cohorts (contributor, host)
					VALUES ($1, $2)
				;`, [ result, uuid ]))
				
				if (teams?.length > 0) {
					teams.forEach(d => {
						batch.push(t.none(`
							INSERT INTO team_members (team, member)
							VALUES ($1, $2)
						;`, [ d, result ]))
					})
				}
				return t.batch(batch)
				.then(async _ => {
					if (result !== uuid) {
						// ALWAYS SEND EMAIL IN THIS CASE AS IT IS SOMEONE ELSE INTERVENING ON ACCOUNT INFORMATION
						// return t.one(`SELECT email FROM users WHERE uuid = $1;`, [ uuid ], d => d.email)
						// .then(async from => {
							await sendemail({
								to: email, 
								bcc: 'myjyby@gmail.com',
								subject: `[${app_title}] An account has been created for you`,
								html: `${username} has created an account for you to access the ${app_title} application.`
							})
							return result
						// }).catch(err => console.log(err))
					} else return result
				})
				.catch(err => console.log(err))
			}).catch(err => console.log(err))
		}).then(result => res.redirect(`/${language}/edit/contributor?id=${result}`))
		.catch(err => console.log(err))
	} else {
		DB.general.tx(t => {
			const batch = []
			let update_pw = ''
			if (password?.trim().length > 0) update_pw = DB.pgp.as.format(`password = crypt($1, GEN_SALT('bf', 8)),`, [ password ])
			batch.push(t.none(`
				UPDATE users
				SET name = $1,
					email = $2,
					position = $3,
					$4:raw
					iso3 = $5,
					language = $6,
					secondary_languages = $7,
					rights = $8,
					notifications = $9,
					reviewer = $10
				WHERE uuid = $11
			;`, [ 
				/* $1 */ name, 
				/* $2 */ email, 
				/* $3 */ position, 
				/* $4 */ update_pw, 
				/* $5 */ iso3, 
				/* $6 */ language, 
				/* $7 */ JSON.stringify(secondary_languages || []), 
				/* $8 */ rights, 
				/* $9 */ notifications || false, 
				/* $10 */ reviewer || false, 
				/* $11 */ id
			]))

			if (teams?.length > 0) {
				teams.forEach(d => {
					batch.push(t.none(`
						INSERT INTO team_members (team, member)
						VALUES ($1, $2)
						ON CONFLICT ON CONSTRAINT unique_team_member
							DO NOTHING
					;`, [ d, id ]))
				})
				batch.push(t.none(`
					DELETE FROM team_members
					WHERE member = $1
						AND team NOT IN ($2:csv)
				;`, [ id, teams ]))
			} else {
				batch.push(t.none(`
					DELETE FROM team_members
					WHERE member = $1
				;`, [ id ]))
			}

			return t.batch(batch)
			.then(async _ => {
				if (id !== uuid) {
					// return t.one(`SELECT email FROM users WHERE uuid = $1;`, [ uuid ], d => d.email)
					// .then(async from => {
						// ALWAYS SEND EMAIL IN THIS CASE AS IT IS SOMEONE ELSE INTERVENING ON ACCOUNT INFORMATION
						await sendemail({
							// from, 
							to: email,
							bcc: 'myjyby@gmail.com',
							subject: `[${app_title}] Your account information has been modified`,
							html: `Your account information has been modified by ${username} via the ${app_title} application.` // TO DO: TRANSLATE 
						})
						return null
					// }).catch(err => console.log(err))
				} else return null
			}).catch(err => console.log(err))
			.catch(err => console.log(err))
		}).then(_ => res.redirect(referer))
		.catch(err => console.log(err))
	}
}