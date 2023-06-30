const { app_languages } = include('config/')

exports.main = function (lang = 'en') {
	return app_languages.includes(lang) ? lang : 'en'
}