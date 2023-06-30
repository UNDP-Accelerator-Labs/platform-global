const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
// const rootpath = path.resolve(__dirname, '../..')
// global.include = path => require(`${rootpath}/${path}`)

const XLSX = require('xlsx') // SEE HERE: https://www.npmjs.com/package/xlsx

const { app_title_short, DB } = include('config/')
const { checklanguage, array } = include('routes/helpers/')

const filter = include('routes/browse/contributors/filter').main

exports.main = async (req, res) => {
	let { output, render, include_data, include_teams, include_contributions } = req.body || {}
	const pw = req.session.email || null
	const language = checklanguage(req.params?.language || req.body.language || req.session.language)

	const [ f_space, page, full_filters ] = await filter(req, res)

	if (output === 'csv') {
		var single_sheet = true
	}

	// CREATE A tmp FOLDER TO STORE EVERYTHING
	if (render) {
		// const basedir = path.join(__dirname, `../public/uploads/`)
		var basedir = path.join(rootpath, '/tmp')
		if (!fs.existsSync(basedir)) fs.mkdirSync(basedir)
		const now = new Date()
		var dir = path.join(basedir, `download-${+now}`)
		if (!fs.existsSync(dir)) fs.mkdirSync(dir)
	}

	DB.general.tx(t => {
		return t.any(`
			SELECT u.uuid, u.name, u.email, u.position, 
				u.iso3, cn.name AS country, c.lat, c.lng, 
				u.language AS primary_language, u.secondary_languages,
				u.invited_at, u.confirmed_at, u.left_at

			FROM users u
			INNER JOIN countries c
				ON c.iso3 = u.iso3
			INNER JOIN country_names cn
				ON cn.iso3 = u.iso3

			WHERE cn.language = $1
				$2:raw
			ORDER BY u.iso3, u.name ASC
		;`, [ language, full_filters.replace(`AND LEFT(u.name, 1) = '${page}'`, '') ]) // NEED TO REMOVE page INFO
		.then(async users => {
			const ids = users.map(d => d.uuid)				
			const batch = []

			if (include_teams) {
				batch.push(t.any(`
					SELECT tm.member AS uuid, t.name AS team
					FROM team_members tm
					INNER JOIN teams t
						ON t.id = tm.team
					WHERE tm.member IN ($1:csv)
					ORDER BY tm.member
				;`, [ ids ]))
			} else batch.push([])
			
			if (include_contributions) {
				batch.push(DB.conn.task(t1 => {
					const batch1 = []
					// ADD PAD INFO
					batch1.push(t1.any(`
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
					batch1.push(t1.any(`
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
					batch1.push(t1.any(`
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

					return t1.batch(batch1)
					.catch(err => console.log(err))
				}).catch(err => console.log(err)))
			} else batch.push([])

			return t.batch(batch)
			.then(results => {
				let [ teams, contributions ] = results
				const [ pads, templates, mobilizations ] = contributions

				const wb = XLSX.utils.book_new()

				if (include_data) {
					// DETERMINE MAX LANGUAGES
					const max_languages = Math.max(...users.map(d => d.secondary_languages?.length).flat())
					// MAX TEAMS
					if (teams?.length) var max_teams = Math.max(...array.nest.call(teams, { key: 'uuid' }).map(d => d.count))
					// MAX PADS
					if (pads?.length) var max_pads = Math.max(...array.nest.call(pads, { key: 'owner' }).map(d => d.count))
					// MAX TEMPLATES
					if (templates?.length) var max_templates = Math.max(...array.nest.call(templates, { key: 'owner' }).map(d => d.count))
					// MAX MOBILIZATIONS
					if (mobilizations?.length) var max_mobilizations = Math.max(...array.nest.call(mobilizations, { key: 'owner' }).map(d => d.count))

					const flat_content = users.map(d => {
						const obj = {}
						Object.keys(d).forEach(c => {
							if (c === 'uuid') obj.contributor_id = `c-${ids.indexOf(d[c]) + 1}`
							else if (c !== 'secondary_languages') obj[c] = d[c]
							else {
								for (let i = 0; i < max_languages; i++) {
									obj[`secondary_language--${i + 1}`] = d[c][i] || null
								}
							}
						})
						if (single_sheet && include_teams) {
							const user_teams = teams.filter(c => c.uuid === d.uuid)
							for (let i = 0; i < max_teams; i++) {
								obj[`team--${i + 1}`] = user_teams[i]?.team || null
							}
						}
						if (single_sheet && include_contributions) {
							// ADD PADS TO SINGE SHEET
							const user_pads = pads.filter(c => c.owner === d.uuid)
							for (let i = 0; i < max_pads; i++) {
								obj[`pad_id--${i + 1}`] = user_pads[i]?.id || null
								obj[`pad_title--${i + 1}`] = user_pads[i]?.title || null
							}
							// ADD TEMPLATES TO SINGE SHEET
							const user_templates = templates.filter(c => c.owner === d.uuid)
							for (let i = 0; i < max_templates; i++) {
								obj[`template_id--${i + 1}`] = user_templates[i]?.id || null
								obj[`template_title--${i + 1}`] = user_templates[i]?.title || null
							}
							// ADD PADS TO SINGE SHEET
							const user_mobilizations = mobilizations.filter(c => c.owner === d.uuid)
							for (let i = 0; i < max_mobilizations; i++) {
								obj[`campaign_id--${i + 1}`] = user_mobilizations[i]?.id || null
								obj[`campaign_title--${i + 1}`] = user_mobilizations[i]?.title || null
							}
							// TO DO: FILES
							// TO DO: REVIEWS
						}
						return obj
					})
					
					const data_sheet = XLSX.utils.json_to_sheet(flat_content)
					XLSX.utils.book_append_sheet(wb, data_sheet, 'data-main')
				}

				if (!single_sheet && include_teams) {
					// ADD TEAMS TO WORKBOOK
					teams.forEach(d => {
						d.contributor_id = `c-${ids.indexOf(d.uuid) + 1}`
						delete d.uuid
					})
					teams.sort((a, b) => a.team.localeCompare(b.team))

					const teams_sheet = XLSX.utils.json_to_sheet(teams)
					XLSX.utils.book_append_sheet(wb, teams_sheet, 'data-teams')
				}
				if (!single_sheet && include_contributions) {
					const all_contributions = []
					if (pads.length) {
						pads.forEach(d => {
							d.contributor_id = `c-${ids.indexOf(d.owner) + 1}`
							d.type = 'pad'
							delete d.owner
						})
						pads.sort((a, b) => a.contributor_id.localeCompare(b.contributor_id))
						all_contributions.push(pads)
					}
					if (templates.length) {
						templates.forEach(d => {
							d.contributor_id = `c-${ids.indexOf(d.owner) + 1}`
							d.type = 'template'
							delete d.owner
						})
						templates.sort((a, b) => a.contributor_id.localeCompare(b.contributor_id))
						all_contributions.push(templates)
					}
					if (mobilizations.length) {
						mobilizations.forEach(d => {
							d.contributor_id = `c-${ids.indexOf(d.owner) + 1}`
							d.type = 'campaign'
							delete d.owner
						})
						mobilizations.sort((a, b) => a.contributor_id.localeCompare(b.contributor_id))
						all_contributions.push(mobilizations)
					}
					// TO DO: FILES
					// TO DO: REVIEWS

					const contributions_sheet = XLSX.utils.json_to_sheet(all_contributions.flat())
					XLSX.utils.book_append_sheet(wb, contributions_sheet, 'data-contributions')
				}

				// RENDER THE FILES
				if (render) {
					if (single_sheet) XLSX.writeFile(wb, path.join(dir, `${app_title_short}_contributors.csv`), {})
					else XLSX.writeFile(wb, path.join(dir, `${app_title_short}_contributors.xlsx`), {})
				}
				return null
			}).catch(err => console.log(err))
		}).catch(err => console.log(err))
	}).then(_ => {
		if (render) {
			const zip = spawn('zip',[ '-rP', pw, 'archive.zip', path.relative(basedir, dir) ], { cwd: basedir })
			// zip.stdin.on('data', (data) => { console.log(`stdin: ${data}`) })
			zip.stdout.on('data', data => console.log(`stdout: ${data}`))
			zip.stderr.on('data', data => console.log(`stderr: ${data}`))
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
		}
	}).catch(err => console.log(err))
}