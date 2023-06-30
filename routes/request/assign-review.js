const path = require('path')

process.on('message', message => {
	const { rootpath, id, language, reviewers, tagfocus, uuid, sendemail } = message || {} // sendemail IS PROBABLY NOT NEEDED HERE
	
	console.log(tagfocus)
	// const tagfocus = 'thematic_areas'
		
	// console.log(sendemail)

	const { modules, DB } = require(path.join(rootpath, '/config'))
	
	if (reviewers) { // SIMPLY ASSIGN TO REVIEWERS
		DB.conn.task(t => {
			return t.one(`
				INSERT INTO review_requests (pad, language)
				VALUES ($1::INT, $2)
				RETURNING id
			;`, [ id, language ], d => d.id)
			.then(request => {
				const identified_reviewers = reviewers.map((d, i) => {
					return { reviewer: d, rank: i, request }
				})
				const sql = `${DB.pgp.helpers.insert(identified_reviewers, [ 'reviewer', 'rank', 'request' ], 'reviewer_pool')} ON CONFLICT ON CONSTRAINT unique_reviewer_pad DO NOTHING;`
				return t.none(sql)
				.then(_ => {
					// const identified_reviewers_uuid = identified_reviewers.map(d => d.reviewer)
					// return reviewers.filter(d => identified_reviewers_uuid.includes(d.uuid))
					return DB.general.any(`
						SELECT uuid, email, notifications FROM users
						WHERE uuid IN ($1:csv)
						-- WHERE reviewer = TRUE
						-- 	AND rights >= $2
						-- 	AND uuid NOT IN (
						-- 		SELECT member FROM team_members
						-- 		WHERE team IN (
						-- 			SELECT team FROM team_members
						-- 			WHERE member = $3:csv
						-- 		)
						-- 	)
					;`, [ reviewers, modules.find(d => d.type === 'reviews')?.rights.write || 2, uuid ]) // THE uuid SHOUD ULTIMATELY BE THE pad OWNER
					.catch(err => console.log(err))
				}).catch(err => console.log(err))
			}).catch(err => console.log(err))
		}).then(results => {
			process.send(results)
			process.exit()
		}).catch(err => console.log(err))
	} else { // FIND RERVIEWERES BASED ON THE tagfocus
		DB.conn.task(t => {
			// 1: CONSTRUCT PAD VECTOR
			// THIS IMPLIES THE PAD HAS TAGS
			const batch = []
			batch.push(t.any(`SELECT DISTINCT (tag_id) AS id FROM tagging WHERE type = $1 AND pad = $2::INT;`, [ tagfocus, id ]))
			batch.push(t.one(`SELECT owner FROM pads WHERE id = $1::INT;`, [ id ], d => d.owner))

			return t.batch(batch)
			.then(results => {
				let [ tags, owner ] = results
				tags = tags.map(d => d.id)
				console.log(tags)
				console.log(owner)
				
				return DB.general.task(gt => {
					const gbatch = []
					// GET PAD TAG WEIGHTS
					if (tags?.length) {
						gbatch.push(gt.any(`
							SELECT CASE WHEN id IN ($1:csv)
									THEN 1
									ELSE 0
								END AS weight
							FROM tags 
							WHERE type = $2
							ORDER BY id
						;`, [ tags, tagfocus ]))
					} else { // NO TAGS TO RANDOM ASSIGNMENT (NOTE IN THIS CASE, ALL THE FOLLOWING OPERATIONS ARE MAJOR OVERKILL)
						gbatch.push(gt.any(`
							SELECT 0 AS weight
							FROM tags 
							WHERE type = $1
							ORDER BY id
						;`, [ tagfocus ]))
					}
					// GET POTENTIAL REVIEWERS
					gbatch.push(gt.any(`
						SELECT uuid, email, notifications FROM users
						WHERE (language = $1 OR secondary_languages ? $1)
							AND reviewer = TRUE
							AND rights >= $2
							AND uuid NOT IN (
								SELECT member FROM team_members
								WHERE team IN (
									SELECT team FROM team_members
									WHERE member = $3:csv
								)

								-- SELECT tm.member FROM team_members tm
								-- INNER JOIN teams t
								-- 	ON t.id = tm.team
								-- WHERE t.id IN (
								-- 	SELECT t2.id FROM teams t2
								-- 	INNER JOIN team_members tm2
								-- 		ON tm2.team = t2.id
								-- 	WHERE tm2.member = $3
								-- )
							)
					;`, [ language, modules.find(d => d.type === 'reviews')?.rights.write || 2, owner ]))
					
					return gt.batch(gbatch)
					.catch(err => console.log(err))
				}).then(results => {
					const [ weights, reviewers ] = results
					const padweights = weights.map(d => d.weight)
					const reviewer_pool = reviewers.map(d => d.uuid)
					// reviewer_pool.push(uuid)
					// 2: CONSTRUCT ALL USERS VECTORS
					// NOTE: THE SELECT ON tagging AND THE INNER JOIN ON pads BELOW IMPLIES THAT POTENTIAL REVIEWERS HAVE CONTRIBUTED SOMETHING
					// MAYBE THIS IS NOT DESIRABLE (PEOPLE WHO HAVE NOT SUBMITTED ANYTHING SHOULD MAYBE BE ALLOWED TO REVIEW)
					return t.any(`
						SELECT p.owner, json_agg(json_build_object('tag', t.tag_id)) AS tags FROM tagging t
						INNER JOIN pads p
							ON p.id = t.pad
						WHERE t.type = $1
						AND p.owner IN ($2:csv)
						GROUP BY p.owner;
					;`, [ tagfocus, reviewer_pool ])
					.then(users => {
						const batch = []
						users.forEach(d => {
							const tags = DB.pgp.helpers.values(d.tags, ['tag'])
							batch.push(
								DB.general.task(gt => {
									return gt.any(`
									WITH user_tags (tag) AS (VALUES $1:raw)
									SELECT $2 AS owner, CASE WHEN id IN (SELECT tag FROM user_tags)
											THEN (SELECT COUNT (tag) FROM user_tags WHERE tag = id)::decimal / (SELECT MAX (count) FROM (SELECT COUNT (tag) FROM user_tags GROUP BY tag) AS counts)::decimal
											ELSE 0
										END AS weight
									FROM tags
									WHERE type = $3
									ORDER BY id
								;`, [ tags, d.owner, tagfocus ])
									.then(weights => {
										const userweights = weights.map(c => +c.weight)
										const gbatch = []
										gbatch.push(gt.one(`
											SELECT ST_Distance (
												(SELECT ST_Transform(ST_SetSRID(ST_Point(lng, lat), 4326), 3857) FROM countries WHERE iso3 = (SELECT iso3 FROM users WHERE uuid = $1)),
												(SELECT ST_Transform(ST_SetSRID(ST_Point(lng, lat), 4326), 3857) FROM countries WHERE iso3 = (SELECT iso3 FROM users WHERE uuid = $2))
											) AS distance
										;`, [ d.owner, owner ], d => d.distance))
										gbatch.push(gt.one(`SELECT language FROM users WHERE uuid = $1;`, [ d.owner ], d => d.language))
										return gt.batch(gbatch)
										.then(results => {
											const [ distance, language ] = results
											return { user: d.owner, match: cosinesim(padweights, userweights), distance, language }
										}).catch(err => console.log(err))
									}).catch(err => console.log(err))
								}).catch(err => console.log(err))
							)
						})
						return t.batch(batch)
						.then(distances => {
							distances.sort((a, b) => (b.match - a.match) || (a.distance - b.distance))
							// TO DO: ADD EXTRA FILTER BASED ON NUMBER OF ALREADY ASSIGNED REVIEWS
							console.log(distances)

							return t.one(`
								INSERT INTO review_requests (pad, language)
								VALUES ($1::INT, $2)
								RETURNING id
							;`, [ id, language ], d => d.id)
							.then(request => {
								const identified_reviewers = distances.slice(0, 10).map((d, i) => { return { reviewer: d.user, rank: i, request } })
								const sql = `${DB.pgp.helpers.insert(identified_reviewers, [ 'reviewer', 'rank', 'request' ], 'reviewer_pool')} ON CONFLICT ON CONSTRAINT unique_reviewer_pad DO NOTHING;`
								return t.none(sql)
								.then(_ => {
									const identified_reviewers_uuid = identified_reviewers.map(d => d.reviewer)
									return reviewers.filter(d => identified_reviewers_uuid.includes(d.uuid))
								}).catch(err => console.log(err))
							}).catch(err => console.log(err))
						}).catch(err => console.log(err))
					}).catch(err => console.log(err))
				}).catch(err => console.log(err))
			}).catch(err => console.log(err))
		}).then(reviewers => {
			process.send(reviewers)
			process.exit()
		}).catch(err => console.log(err))
	}
})

function cosinesim (A, B){
	// CREDIT TO: https://stackoverflow.com/questions/51362252/javascript-cosine-similarity-function
	let dotproduct = 0
	let mA = 0
	let mB = 0
	for(i = 0; i < A.length; i ++){
	    dotproduct += (A[i] * B[i])
	    mA += (A[i]*A[i])
	    mB += (B[i]*B[i])
	}
	mA = Math.sqrt(mA)
	mB = Math.sqrt(mB)
	return (dotproduct) / ((mA) * (mB))
}