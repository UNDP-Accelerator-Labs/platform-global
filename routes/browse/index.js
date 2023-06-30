const { modules } = include('config/')

const pads = require('./pads/')
const templates = require('./templates/')
const files = require('./files/')
const reviews = require('./reviews/')
const mobilizations = require('./mobilizations/')
const contributors = require('./contributors/')
const blog = require('./blog/')

module.exports = async (req, res) => {
	const { xhr } = req
	let { object, space, instance } = req.params || {}

	// if (req.session.uuid) { // USER IS LOGGED IN
	// 	var { rights } = req.session || {}
	// } else { // PUBLIC/ NO SESSION
	// 	var { rights } = datastructures.sessiondata({ public: true }) || {}
	// }
	// const language = checklanguage(req.params?.language || req.session.language)

	// if (space === 'private' && rights < modules.find(d => d.type === object)?.rights?.write) { // THE USER DOES NOT HAVE THE RIGHT TO NAVIGATE TO A private VIEW
		
	// }

	if (modules.some(d => d.type === object)) {
		if (!xhr) {
			console.log('object ', object)
			if (object === 'pads') pads.render(req, res)
			if (object === 'templates') templates.render(req, res)
			if (object === 'files') files.render(req, res)
			if (object === 'reviews') reviews.render(req, res)
			if (object === 'mobilizations') mobilizations.render(req, res)
			if (object === 'contributors') contributors.render(req, res)
			if(object === 'blog') blog.render(req, res)

		} else { // AJAX CALL
			let data 
			if (object === 'pads') data = await pads.load({ req: req })
			if (object === 'templates') data = await templates.load({ req: req })
			if (object === 'files') data = await files.load({ req: req })
			if (object === 'reviews') data = await reviews.load({ req: req })
			if (object === 'contributors') data = await contributors.load({ req: req })
			// TO DO: FOR MOBILIZATIONS
			res.status(200).json(data)
		}
	} else if (instance) {
		pads.render(req, res)
	} else res.redirect('/module-error')
}