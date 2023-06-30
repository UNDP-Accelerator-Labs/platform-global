const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
// const rootpath = path.resolve(__dirname, '../..')
// global.include = path => require(`${rootpath}/${path}`)

const turf = require('@turf/turf')

const { app_title_short, DB } = include('config/')
const { checklanguage, array } = include('routes/helpers/')

const filter = include('routes/browse/contributors/filter').main

exports.main = async (req, res) => {
	let { output, render, include_data, include_teams, include_contributions } = Object.keys(req.query)?.length ? req.query : Object.keys(req.body)?.length ? req.body : {} // req.body || {}
	const pw = req.session.email || null
	const language = checklanguage(req.params?.language || req.body.language || req.session.language)

	const [ f_space, page, full_filters ] = await filter(req, res)
	let cors_filter = ''
	if (!pw) cors_filter = DB.pgp.as.format(`AND FALSE`)

	// CREATE A tmp FOLDER TO STORE EVERYTHING
	if (render) {
		// const basedir = path.join(__dirname, `../public/uploads/`)
		var basedir = path.join(rootpath, '/tmp')
		if (!fs.existsSync(basedir)) fs.mkdirSync(basedir)
		const now = new Date()
		var dir = path.join(basedir, `download-${+now}`)
		if (!fs.existsSync(dir)) fs.mkdirSync(dir)
	}

	DB.general.any(`
		SELECT u.uuid, u.name, u.email, u.position, 
			u.iso3, cn.name AS country, 
			u.language AS primary_language, u.secondary_languages,
			u.invited_at, u.confirmed_at, u.left_at,

			jsonb_build_object('lat', c.lat, 'lng', c.lng) AS location,			

			COALESCE(
			(SELECT json_agg(t.name) FROM teams t
			INNER JOIN team_members tm
				ON tm.team = t.id
			WHERE tm.member = u.uuid
			GROUP BY tm.member
			)::TEXT, '[]')::JSONB
			AS teams

		FROM users u
		INNER JOIN countries c
			ON c.iso3 = u.iso3
		INNER JOIN country_names cn
			ON cn.iso3 = u.iso3

		WHERE cn.language = $1
			$2:raw
			$3:raw
		ORDER BY u.iso3, u.name ASC
	;`, [ language, full_filters.replace(`AND LEFT(u.name, 1) = '${page}'`, ''), cors_filter ]) // NEED TO REMOVE page INFO
	.then(async users => {
		const ids = users.map(d => d.uuid)				
		
		return DB.conn.tx(t => {
			const batch = []
			// ADD PAD INFO
			if (include_contributions) {
				batch.push(t.any(`
					SELECT id, title, owner,
					CASE WHEN status = 2
						THEN 'Preprint'
						ELSE 'Published'
					END AS status

					FROM pads
					WHERE status >= 2
						AND owner IN ($1:csv)
					ORDER BY owner
				;`, [ ids ]))
				// ADD TEMPLATE INFO
				batch.push(t.any(`
					SELECT id, title, owner,
					CASE WHEN status = 2
						THEN 'Preprint'
						ELSE 'Published'
					END AS status

					FROM templates
					WHERE status >= 2
						AND owner IN ($1:csv)
					ORDER BY owner
				;`, [ ids ]))
				// ADD MOBILIZATION INFO
				batch.push(t.any(`
					SELECT id, title, owner,
					CASE WHEN status = 1
						THEN 'Ongoing'
						ELSE 'Ended'
					END AS status

					FROM mobilizations
					WHERE status >= 1
						AND owner IN ($1:csv)
					ORDER BY owner
				;`, [ ids ]))

				// TO DO: ADD FILE INFO
				// TO DO: ADD REVIEW INFO
			}

			return t.batch(batch)
			.catch(err => console.log(err))
		}).then(results => {
			const [ pads, templates, mobilizations ] = results

			users.forEach(d => {
				// SET contributor_id
				d.contributor_id = `c-${ids.indexOf(d.uuid) + 1}`

				console.log(include_data)
				if (!include_data) {
					delete d.name
					delete d.email
					delete d.position
					delete d.iso3
					delete d.country
					delete d.primary_language
					delete d.secondary_languages
					delete d.invited_at
					delete d.confirmed_at
					delete d.left_at
					delete d.location
				}

				if (!include_teams) delete d.teams
				
				if (include_contributions) {
					d.pads = pads?.filter(c => c.owner === d.uuid) || []
					d.templates = templates?.filter(c => c.owner === d.uuid) || []
					d.campaigns = mobilizations?.filter(c => c.owner === d.uuid) || []
				}
				
				delete d.uuid
			})

			if (output === 'geojson') {
				users = users.map(d => {
					const { location, ...properties } = d
					return turf.point([location.lng, location.lat], properties)

				})
			}

			// RENDER THE FILES
			if (render) {
				fs.writeFileSync(path.join(dir, `${app_title_short}_contributors.json`), JSON.stringify(users))
			}
			return users
		}).catch(err => console.log(err))		
	}).then(data => {
		if (render) {
			var zip = spawn('zip',[ '-rP', pw, 'archive.zip', path.relative(basedir, dir) ], { cwd: basedir })
			// zip.stdin.on('data', d => { console.log(`stdin: ${d}`) })
			zip.stdout.on('data', d => console.log(`stdout: ${d}`))
			zip.stderr.on('data', d => console.log(`stderr: ${d}`))
			// zip.on('error', err => console.log(err))
			zip.on('exit', code => {
				console.log(`zipped: ${code}`)
				fs.rmSync(dir, { recursive: true })
				console.log('folder removed')
				// DOWNLOAD THE FILE
				res.setHeader('Content-type','application/zip')
				res.sendFile(path.join(basedir, '/archive.zip'), {}, function () {
					fs.rmSync(path.join(basedir, '/archive.zip'))
				})
			})
		} else {
			if (data.length) res.json(data)
			else res.send('Sorry you do not have the rights to download this content. Please enquire about getting an access token to view download this content.')
		}
	}).catch(err => console.log(err))
}