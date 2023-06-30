// THIS IS TO GO FROM LAT, LNG TO A PLACE NAME
// SEE https://opencagedata.com/api#quickstart
const fetch = require('node-fetch')

exports.code = (locations, list = false) => {
	console.log('pay attention to geocode')
	return locations.map(l => {
		return new Promise(resolve => {
			if (!l || !Array.isArray(l) || l.length !== 2 || !l.every(d => !isNaN(d))) {
				console.log('does not meet requirements')
				const obj = {}
				obj.input = l
				obj.found = false
				obj.caption = `No location was found for <strong>${l}</strong>.` // TO DO: TRANSLATE
				resolve(obj)
			} else {
				setTimeout(_ => {
					l_formatted = l.join('+')

					fetch(`https://api.opencagedata.com/geocode/v1/json?q=${l_formatted}&key=${process.env.OPENCAGE_API}`)
					.then(response => response.json())
					.then(data => {
						const obj = {}
						obj.input = l
						if (data.results.length) {
							if (!list) {
								const location = data.results[0] // NOTE CONFIDENCE IS SOMETHING ELSE: https://opencagedata.com/api#ranking
								obj.formatted = location.formatted
							} else {
								obj.locations = data.results
								obj.formatted = data.results.map(d => d.formatted)
							}
							obj.found = true
							obj.caption = `Location name${locations.length !== 1 ? 's' : ''} found using <a href='https://opencagedata.com/credits' target='_blank'>OpenCage Geocoder</a> | &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap contributors</a>` // TO DO: TRANSLATE
						} else {
							obj.found = false
							obj.caption = `No location was found for <strong>${l}</strong>.` // TO DO: TRANSLATE
						}
						resolve(obj)
					}).catch(err => console.log(err))
				}, 1000)
			}
		})
	})
}
exports.render = (req, res) => {
	const { locations, list } = req.body || {}
	const { country } = req.session || {}
	
	const promises = this.code(locations, list)
	Promise.all(promises)
	.then(data => res.json(data))
	.catch(err => {
		console.log(err)
		res.json({ status: 500, message: 'Oops! Something went wrong while searching for locations.' })
	})
}