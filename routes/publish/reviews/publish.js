const { app_suite, app_title, modules, DB } = include('config/')
const { checklanguage, parsers, email: sendemail } = include('routes/helpers/')

exports.main = (req, res) => {
	const { host, referer } = req.headers || {}
	const { id, source, status } = req.query || {}
	const { uuid, rights } = req.session || {}

	DB.conn.tx(t => {
		const batch = []

		if (status) {
			if (id) {
				// PUBLISH THE PAD AND THE REVIEW
				batch.push(t.none(`
					UPDATE pads
						SET status = $1::INT
					WHERE id = $2::INT
						AND status >= 1
						AND (owner = $3
							OR $4 > 2)
				;`, [ status, id, uuid, rights ]))

				batch.push(t.none(`
					UPDATE reviews
						SET status = $1::INT
					WHERE review = $2::INT
						AND status >= 1
						AND (reviewer = $3
							OR $4 > 2)
				;`, [ status, id, uuid, rights ]))

			}
		}

		return t.batch(batch)
		.then(_ => {
			if (id) {
				// 1/ COUNT NUMBER OF PUBLISHED REVIEWS
				return t.task(t1 => {
					return t1.one(`
						SELECT COUNT(id)::INT FROM reviews
						WHERE pad = $1 AND status = 2
					;`, [ source ], d => d.count)
					.then(review_count => {
						console.log('check review count')
						console.log(review_count)

						if (review_count > 0 && review_count % modules.find(d => d.type === 'reviews').reviewers === 0) {
							// 2/ THERE ARE ENOUGH REVIEWS, GET SCORES
							console.log('there are enough reviews')
							return t1.any(`
								SELECT sections FROM pads
								WHERE id IN (
									SELECT review FROM reviews
									WHERE pad = $1
								)
							;`, [ source ])
							.then(results => {
								const batch = []
								batch.push(results.every(d => +parsers.getReviewScore(d) === 1))
								batch.push(t.one(`SELECT title FROM pads WHERE id = $1::INT;`, [ source ], d => d.title))
								batch.push(t.oneOrNone(`SELECT language FROM review_requests WHERE pad = $1::INT;`, [ source ], d => d?.language))

								batch.push(t1.any(`
									SELECT owner FROM pads
									WHERE id IN (SELECT review FROM reviews WHERE pad = $1::INT)
								;`, [ source ]))
								// GET PAD OWNER UUID
								batch.push(t1.one(`
									SELECT owner FROM pads
									WHERE id = $1
								;`, [ source ], d => d.owner))

								console.log('check review scores')
								console.log(results.every(d => +parsers.getReviewScore(d) === 1))
								if (results.every(d => +parsers.getReviewScore(d) === 1)) {
									// 3/ ALL SCORES ARE ACCEPT, AUTO-PUBLISH PAD
									batch.push(t1.none(`
										UPDATE pads
										SET status = 3
										WHERE id = $1
									;`, [ source ]))
								}
								return t1.batch(batch)
								.then(results => {
									// 4/ SEND EMAIL NOTIFICATION TO AUTHOR AND REVIEWERS
									let [ accepted, title, language, reviewers, owner ] = results
									language = checklanguage(language || req.params?.language || req.session.language)
									console.log('check accepted')
									console.log(accepted)
									console.log(language)

									return DB.general.task(gt => {
										const gbatch = []
										gbatch.push(gt.any(`
											SELECT email FROM users
											WHERE uuid IN ($1:csv)
												AND notifications = TRUE
										;`, [ reviewers.map(d => d.owner) ])
										.then(user_info => {
											// TO DO: TRANSLATE
											const html = `Thank you for taking the time to review the submission entitled "${title}".
											All reviews are now completed. You can read them <a href='http${process.env.NODE_ENV === 'production' ? 's' : ''}://${host}/${language}/view/pad?id=${source}&display=adjacent-reviews'>here</a>.`

											return Promise.all(user_info.map(d => {
												return sendemail({
													to: d.email,
													subject: `[${app_title}] Reviews for "${title}" are in`,
													html
												})
											}))
										}).catch(err => console.log(err)))

										gbatch.push(gt.any(`
											SELECT email FROM users
											WHERE uuid IN ($1:csv)
												AND notifications = TRUE
										;`, [ owner ])
										.then(user_info => {
											let html = ''
											if (accepted) {
												// TO DO: TRANSLATE
												html = `Congrats! Your submission has been accepted and has automatically been published at <a href='http${process.env.NODE_ENV === 'production' ? 's' : ''}://${host}/${language}/browse/pads/public?pads=${source}'>http${process.env.NODE_ENV === 'production' ? 's' : ''}://${host}/${language}/browse/pads/public?id=${source}</a>.
												Click <a href='http://${host}/${language}/view/pad?id=${source}&display=adjacent-reviews'>here</a> to see the reviews.`
											} else {
												// TO DO: TRANSLATE
												html = `Reviews are in for your submission "${title}".
												Unfortunately some revisions are required. You will find the reviews <a href='http${process.env.NODE_ENV === 'production' ? 's' : ''}://${host}/${language}/view/pad?id=${source}&display=adjacent-reviews'>here</a>.
												Please consider and address them carefully, then resubmit your pad for another round of reviews.`
											}

											return Promise.all(user_info.map(d => {
												return sendemail({
													to: d.email,
													subject: `[${app_title}] Your submission "${title}" has been reviewed`,
													html
												})
											}))
										}).catch(err => console.log(err)))

										return gt.batch(gbatch)
										.catch(err => console.log(err))
									}).then(_ => {
										// 5/ AND REMOVE REVIEW REQUEST AND REVIEWERS FROM POOL (CLEAN UP)
										return t1.none(`
											DELETE FROM reviewer_pool
											WHERE request IN (
												SELECT id FROM review_requests
												WHERE pad = $1
											);`, [ source ])
										.then(_ => {
											return t1.none(`DELETE FROM review_requests WHERE pad = $1;`, [ source ])
											.catch(err => console.log(err))
										}).catch(err => console.log(err))
									}).catch(err => console.log(err))
								}).catch(err => console.log(err))
							}).catch(err => console.log(err))
						} else {
							// 2/ THERE ARE NOT ENOUGH REVIEWS
							console.log('there are not enough reviews')
							return null
						}
					}).catch(err => console.log(err))
				}).catch(err => console.log(err))
			}
		}).catch(err => console.log(err))
	}).then(_ => res.redirect(referer))
	.catch(err => console.log(err))
}
