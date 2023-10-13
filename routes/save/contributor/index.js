const { app_title, app_languages, DB } = include('config/')
const { email: sendemail, datastructures, sessionupdate } = include('routes/helpers/')
const { isPasswordSecure } = require('../../login')
const { updateRecord, confirmEmail } = require('./services')

module.exports = async (req, res) => {
	const { referer } = req.headers || {}
	const { uuid, rights: session_rights, username, is_trusted } = req.session || {}
	let { id, new_name: name, new_email: email, new_position: position, new_password: password, iso3, language, rights, teams, reviewer, email_notifications: notifications, secondary_languages } = req.body || {}
	if (teams && !Array.isArray(teams)) teams = [teams]
	if (secondary_languages && !Array.isArray(secondary_languages)) secondary_languages = [secondary_languages]

	let logoutAll = false;

	let redirect_url;
	const referer_url = new URL(referer)
	const referer_params = new URLSearchParams(referer_url.search)

	if(password.length) {
		let message = isPasswordSecure(password);
		if (message.length) {
			referer_params.set('errormessage', message);
			return res.redirect(`${referer_url.pathname}?${referer_params.toString()}`);
		}
	}
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
						await sendemail({
							to: email,
							bcc: 'myjyby@gmail.com',
							subject: `[${app_title}] An account has been created for you`,
							html: `${username} has created an account for you to access the ${app_title} application.`
						})
						return result
					} else return result
				})
				.catch(err => console.log(err))
			}).catch(err => {
				console.log('There is a non-blocking error. Likely already a user with the same email account')
				console.log(err)
				return null
			})
		}).then(result => {
			if (result) res.redirect(`/${language}/edit/contributor?id=${result}`)
			else { // TELL THE USER TO LOG IN OR USE A DIFFERENT EMAIL
				const message = 'It seems the email you want to use is already associated with an account. Please use a different email for the new account.' // TO DO: TRANSLATE
				referer_params.set('errormessage', message)
				res.redirect(`${referer_url.pathname}?${referer_params.toString()}`);
			}
		})
		.catch(err => console.log(err))
	} else {
		DB.general.tx(async t => {
			const batch = []
			// CHECK IF THE CURRENT USER HAS THE RIGHT TO CHANGE VALUES
			batch.push(t.any(`
				SELECT c.host, u.name FROM cohorts c
				INNER JOIN users u
				ON u.uuid = c.host
				WHERE c.contributor = $1
			`, [ id ]).then(async results => {
				if (id === uuid || results.some(d => d.host === uuid) || session_rights > 2) {
					let update_pw = ''
					if ((id === uuid || session_rights > 2) && password?.trim().length > 0) update_pw = DB.pgp.as.format(`password = crypt($1, GEN_SALT('bf', 8)),`, [ password ])
					let update_rights = ''
					if ((results.some(d => d.host === uuid) || session_rights > 2) && ![undefined, null].includes(rights)) update_rights = DB.pgp.as.format('rights = $1,', [ rights ]) // ONLY HOSTS AND SUPER USERS CAN CHANGE THE USER RIGHTS

					const u_user = await t.oneOrNone(`SELECT email, name FROM users WHERE uuid = $1`, [id])

					if(u_user?.email != email || update_pw?.length > 0 || u_user.name != name){
						if (is_trusted) {
							logoutAll = true;
							//IF EMAIL CHANGES, SEND CONFIRM EMAIL BEFORE UPDATING EMAIL
							if(u_user?.email != email){
								confirmEmail({email, name: u_user.name, uuid: id, old_email: u_user?.email, req })
								if(!update_pw && u_user.name == name) logoutAll = false
								message = 'An email has been sent to your email address. Please confirm the email to proceed with the email update.'
								req.session.errormessage = message
								referer_params.set('u_errormessage', message);
								redirect_url = `${referer_url.pathname}?${referer_params.toString()}`
							}

							updateRecord({
								conn: t,
								data: [
									/* $1 */ name,
									/* $2 */ email,
									/* $3 */ position,
									/* $4 */ update_pw,
									/* $5 */ iso3,
									/* $6 */ language,
									/* $7 */ JSON.stringify(secondary_languages || []),
									/* $8 */ update_rights,
									/* $9 */ notifications || false,
									/* $10 */ reviewer || false,
									/* $11 */ id
								]
							})
							.catch(err => res.redirect('/module-error'))
						} else {
							referer_params.set('u_errormessage', 'This action can only be authorized on trusted devices. Please log in from a trusted device');
							redirect_url = `${referer_url.pathname}?${referer_params.toString()}`
						}
					} else {
						return t.none(`
							UPDATE users
							SET name = $1,
								position = $3,
								iso3 = $5,
								language = $6,
								secondary_languages = $7,
								$8:raw
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
							/* $8 */ update_rights,
							/* $9 */ notifications || false,
							/* $10 */ reviewer || false,
							/* $11 */ id
						])
					}
				} else return null
			}).catch(err => console.log(err)))

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
				if (logoutAll) {
					// PASSWORD HAS BEEN RESET SO LOG OUT EVERYWHERE
					sessionupdate({
						conn: t,
						whereClause: `sess ->> 'uuid' = $1`,
						queryValues: [uuid]
					})

				} else {
					// UPDATE THE SESSION DATA
					await t.one(`
						SELECT u.uuid, u.rights, u.name, u.email, u.iso3, c.lng, c.lat, c.bureau,

						CASE WHEN u.language IN ($1:csv)
							THEN u.language
							ELSE 'en'
						END AS language,

						CASE WHEN u.language IN ($1:csv)
							THEN (SELECT cn.name FROM country_names cn WHERE cn.iso3 = u.iso3 AND cn.language = u.language)
							ELSE (SELECT cn.name FROM country_names cn WHERE cn.iso3 = u.iso3 AND cn.language = 'en')
						END AS countryname,

						COALESCE(
							(SELECT json_agg(DISTINCT(jsonb_build_object(
								'uuid', u2.uuid,
								'name', u2.name,
								'rights', u2.rights
							))) FROM team_members tm
							INNER JOIN teams t
								ON t.id = tm.team
							INNER JOIN users u2
								ON u2.uuid = tm.member
							WHERE t.id IN (SELECT team FROM team_members WHERE member = u.uuid)
						)::TEXT, '[]')::JSONB
						AS collaborators

						FROM users u
						INNER JOIN countries c
							ON u.iso3 = c.iso3

						WHERE uuid = $2
					;`, [ app_languages, id ])
					.then(result => {
						const { device } = req.session
						const sess = { ...result, is_trusted, device: {...device, is_trusted}}
						Object.assign(req.session, datastructures.sessiondata(sess))
						return null
					}).catch(err => console.log(err))
				}

				// SEND EMAIL IF THE CHANGES ARE NOT SELF-TRIGGERED
				if (id !== uuid) {
					// ALWAYS SEND EMAIL IN THIS CASE AS IT IS SOMEONE ELSE INTERVENING ON ACCOUNT INFORMATION
					await sendemail({
						// from,
						to: email,
						bcc: 'myjyby@gmail.com',
						subject: `[${app_title}] Your account information has been modified`,
						html: `Your account information has been modified by ${username} via the ${app_title} application.` // TO DO: TRANSLATE
					})
					return null
				} else return null
			}).catch(err => console.log(err))
			.catch(err => console.log(err))
		}).then(_ => {
			if (redirect_url || referer) res.redirect(redirect_url || referer)
			else res.redirect('/login')
		}).catch(err => console.log(err))
	}
}
