const { modules, engagementtypes, metafields, app_languages, DB } = include('config/')
// const header_data = include('routes/header/').data
const { checklanguage, datastructures } = include('routes/helpers/')

exports.main = async (req, res) => {	
	const { id, errormessage, u_errormessage } = req.query || {}
	const { uuid, rights, public } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)
	const path = req.path.substring(1).split('/')
	const activity = path[1]

	DB.general.tx(async t => {
		return check_authorization({ connection: t, id, uuid, rights })
		.then(result => {
			const { authorized, redirect } = result
			if (!authorized) return res.redirect(referer)
			else if (authorized && redirect && redirect !== activity) return res.redirect(`/${language}/${redirect}/contributor?id=${id}`)
			else {
				const batch = []
				// GET LIST OF COUNTRIES
				batch.push(t.any(`
					SELECT DISTINCT (iso3), name FROM country_names
					WHERE language = (COALESCE((SELECT DISTINCT (language) FROM country_names WHERE language = $1 LIMIT 1), 'en'))
					ORDER BY name
				;`, [ language ]))
				// GET LIST OF LANGUAGES
				batch.push(t.any(`
					SELECT DISTINCT (language), name FROM languages
					WHERE language IN ($1:csv)
					ORDER BY name
				;`, [ app_languages ]))
				// GET LIST OF TEAMS
				batch.push(t.any(`
					SELECT id, name FROM teams
					WHERE host = $1
						OR id IN (
							SELECT team FROM team_members
							WHERE member = $1
						)
						OR $2 > 2
					ORDER BY name
				;`, [ uuid, rights ]))
				// GET DATA
				if (id) {
					batch.push(t.one(`
						SELECT DISTINCT (u.uuid), u.name, u.email, u.position, u.iso3, u.language, u.secondary_languages, u.rights, u.notifications, u.reviewer,
						cn.name AS country, l.name AS languagename,

						COALESCE(
						(SELECT json_agg(json_build_object(
								'id', t.id, 
								'name', t.name
							)) FROM teams t
							INNER JOIN team_members tm
								ON tm.team = t.id
							WHERE tm.member = u.uuid
							GROUP BY tm.member
						)::TEXT, '[]')::JSONB
						AS teams,

						CASE WHEN uuid = $1
							OR $2 > 2
								THEN TRUE
								ELSE FALSE
						END AS editable,

						CASE WHEN $1 IN (SELECT host FROM cohorts WHERE contributor = u.uuid)
							OR $2 > 2
								THEN TRUE
								ELSE FALSE
						END AS host_editor

						FROM users u
						INNER JOIN country_names cn
							ON cn.iso3 = u.iso3
							AND cn.language = u.language
						INNER JOIN languages l
							ON l.language = u.language
						WHERE uuid = $3
					;`, [ uuid, rights, id ])
					.catch(err => console.log(err)))
				} else batch.push(null)

				if(uuid === id){
					batch.push(t.any(`
					SELECT *
					FROM trusted_devices
					WHERE user_uuid = $1
					  AND is_trusted = true
					  AND created_at >= NOW() - INTERVAL '1 year';
					;`, [ uuid ]))
				} else batch.push(null)

				return t.batch(batch)
				.then(async results => {
					const [ countries, languages, teams, data, devices ] = results

					const trusted_devices = devices?.map(p=> ({
						...p,
						last_login: new Date(p.last_login)?.toLocaleDateString() + ' ' + new Date(p.last_login).toLocaleTimeString(),
						created_at: new Date(p.created_at)?.toLocaleDateString() + ' ' + new Date(p.last_login).toLocaleTimeString(),
					}))
					const metadata = await datastructures.pagemetadata({ req })
					return Object.assign(metadata, { data, countries, languages, teams, errormessage, trusted_devices, u_errormessage })
				}).then(data => res.render('profile', data))
				.catch(err => console.log(err))
			}
		}).catch(err => console.log(err))
	}).catch(err => console.log(err))
}

function check_authorization (_kwargs) {
	const conn = _kwargs.connection || DB.general
	const { id, uuid, rights } = _kwargs

	if (id) {
		if (id === uuid || rights > 2) return new Promise(resolve => resolve({ authorized: true, redirect: 'edit' }))
		else return conn.oneOrNone(`
			SELECT DISTINCT (TRUE) AS bool FROM cohorts
			WHERE contributor = $1
				AND host = $2
		;`, [ id, uuid ])
		.then(result => {
			if (result) return { authorized: true, redirect: 'view' }
			else return { authorized: false }
		}).catch(err => console.log(err))
	} else return new Promise(resolve => resolve({ authorized: true }))
}