const { app_title, DB } = include('config/')
const { checklanguage, email: sendemail } = include('routes/helpers/')

const cron = require('node-cron')

exports.main = (req, res) => {
	let { title, description, cohort, template, public, start_date, end_date } = req.body || {}
	if (title.length > 99) title = `${title.slice(0, 96)}…`
	if (!Array.isArray(cohort)) cohort = [cohort]
	if (start_date) start_date = new Date(start_date)
	if (end_date) end_date = new Date(end_date)
	
	const { uuid, email } = req.session || {}
	const language = checklanguage(req.params?.language || req.session.language)

	DB.conn.tx(t => { // INSERT THE NEW MOBILIZATION		
		// INSPIRED BY https://stackoverflow.com/questions/38750705/filter-object-properties-by-key-in-es6
		const insert = Object.keys(req.body)
			.filter(key => !['cohort'].includes(key))
			.reduce((obj, key) => {
				obj[key] = req.body[key]
				return obj
			}, {})
		
		saveSQL = DB.pgp.as.format(`
			INSERT INTO $1:name ($2:name, owner) 
			SELECT $2:csv, $3
			RETURNING $1:name.id
		;`, [ 'mobilizations', insert, uuid ])
		
		return t.one(saveSQL)
		.then(result => { // INSERT THE COHORT FOR THE MOBILIZATION
			const { id } = result
			const batch = []

			// TO DO: TO OPTIMIZE THE CRON JOBS, KEEP TRACK OF THE UNIQUE mobilization-job(s) IN CASE THE MOBILIZATION IS ENDED PREMATURELY OR DELETED
			// IF THE MOBILIZATION IS SCHEDULED FOR A LATER DATE, SO SET UP A CRON JOB
			const now = new Date()
			if (start_date && start_date >= now) {
				const min = start_date.getMinutes()
				const hour = start_date.getHours()
				const day = start_date.getDate()
				const month = start_date.getMonth() + 1
				const year = start_date.getFullYear()

				cron.schedule(`${min} ${hour} ${day} ${month} *`, function () {
					DB.conn.none(`
						UPDATE mobilizations
						SET status = 1
						WHERE id = $1
					;`, [ id ])
					.catch(err => console.log(err))
				})
			} 
			// IF THE MOBILIZATION HAS AN END DATE, SET UP A CRON JOB
			if (end_date && end_date >= now) {
				const min = end_date.getMinutes()
				const hour = end_date.getHours()
				const day = end_date.getDate()
				const month = end_date.getMonth() + 1
				const year = end_date.getFullYear()

				cron.schedule(`${min} ${hour} ${day} ${month} *`, function () {
					DB.conn.none(`
						UPDATE mobilizations
						SET status = 2
						WHERE id = $1
					;`, [ id ])
					.catch(err => console.log(err))
				})
			}

			if (!public) {
				cohort.forEach(d => {
					batch.push(t.none(`
						INSERT INTO mobilization_contributors (participant, mobilization)
						VALUES ($1, $2::INT)
					;`, [ d, id ]))
				})
				// ADD THE HOST OF THE MOBIILIZATION BY DEFAULT
				if (!cohort.some(d => d === uuid)) {
					batch.push(t.none(`
						INSERT INTO mobilization_contributors (participant, mobilization)
						VALUES ($1, $2::INT)
					;`, [ uuid, id ]))
				}
			} else {
				// AUTOMATICALLY CREATE A PUBLIC PINBOARD FOR THIS MOBILIZATION
				batch.push(t.one(`
					INSERT INTO pinboards (title, description, owner, status, mobilization)
					VALUES ($1, $2, $3, 3, $4::INT)
					RETURNING id
				;`, [ title, description, uuid, id ], d => d.id)
				.then(result => {
					return t.none(`
						INSERT INTO pinboard_contributors (pinboard, participant)
						VALUES ($1::INT, $2)
						ON CONFLICT ON CONSTRAINT unique_pinboard_contributor
							DO NOTHING
					;`, [ result, uuid ])
				}).catch(err => console.log(err)))
			}

			return t.batch(batch)
			.then(_ => {
				const batch = []

				if (!public) {
					// SEND EMAILS TO THOSE WHO ACCEPT NOTIFICATIONS (IN bcc FOR ONLY ONE EMAIL)
					batch.push(DB.general.any(`
						SELECT DISTINCT email FROM users 
						WHERE uuid IN ($1:csv)
							AND uuid <> $2
							AND notifications = TRUE
					;`, [ cohort, uuid ]).then(async results => {
						const bcc = results.map(d => d.email)
						bcc.push('myjyby@gmail.com') // TO DO: THIS IS TEMP
						
						await sendemail({
							to: email, 
							bcc,
							subject: `[${app_title}] New campaign`,
							html: `Dear contributor, you are invited to participate in a new documentation campaign on the ${app_title} platform. 
								Here is some information about the campaign:
								<br><br>${title}<br>${description}` // TO DO: TRANSLATE AND STYLIZE
						})
						// SEE https://stackoverflow.com/questions/57675265/how-to-send-an-email-in-bcc-using-nodemailer FOR bcc
					}).catch(err => console.log(err)))
				}
				// PUBLISH THE TEMPLATE USED
				batch.push(t.none(`
					UPDATE templates 
					SET status = 2
					WHERE id = $1::INT
				;`, [ template ]))
				return t.batch(batch)
				.catch(err => console.log(err))
			}).catch(err => console.log(err))
		})
	}).then(_ => res.redirect(`/${language}/browse/mobilizations/ongoing`))
	.catch(err => console.log(err))
}