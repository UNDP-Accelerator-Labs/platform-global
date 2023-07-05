const { checklanguage } = include('routes/helpers/')

module.exports = (req, res, next) => {
	let { language } = req.params || {}
	if (!language) {
		language = checklanguage(req.session.language)
		res.redirect(`/${language}/home`)
	} else next()
}
