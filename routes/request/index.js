const attachment = require('./attachment.js')
const review = require('./review.js')

exports.main = (req, res) => {
	const { object } = req.params || {}
	
	if (['attachment', 'join'].includes(object)) attachment.main(req, res)
	else if (object === 'review') review.main(req, res)
}