exports.main = (req, res) => {
	const { filepath } = req.query || {}
	if (filepath) res.sendFile(filepath)
	else res.status(400).json({ message: 'Missing file path.' })

	// TO DO: CHECK TOKEN
	// const token = req.body.token || req.query.token || req.headers['x-access-token']

	// if (token) {
	// 	return DB.conn.any(`
	// 		SELECT uuid FROM mappers
	// 	;`).then(results => {
	// 		results = results.map(d => d.uuid)
	// 		// ADD PLATFORM REQUEST KEYS
	// 		results.push(process.env.ACCLAB_PLATFORM_KEY)
			
	// 		const auth = results.map(d => {
	// 			try {
	// 				return jwt.verify(token, d)
	// 			} catch (err) {
	// 				return null
	// 			}
	// 		}).filter(d => d)?.[0]
			
	// 		if (auth?.authorization?.includes('api')) {
	// 			const { filepath } = req.query || {}

	// 			if (filepath) res.sendFile(filepath)
	// 			else res.status(400).json({ message: 'Missing file path.' })
	// 		} else res.status(403).json({ message: 'It seems you do not have the authorization to use the api.' })
	// 	}).catch(err => console.log(err))
	// } else res.status(403).json({ message: 'You need an access token for this api.' })
}