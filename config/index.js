let { 
	app_title, 
	app_title_short, 
	app_suite,
	app_suite_secret,
	app_languages,
	app_description,
	apps_in_suite,
	modules, 
	metafields, 
	engagementtypes, 
	colors, 
	map, 
	lazyload, 
	page_content_limit, 
	followup_count,
	browse_display,
	view_display,
	welcome_module
} = require('./edit/')

const { translations } = require('./edit/translations.js')
exports.translations = translations

exports.app_title = app_title
exports.app_title_short = app_title_short
exports.app_suite = app_suite
exports.app_suite_secret = app_suite_secret
exports.app_description = app_description
exports.apps_in_suite = apps_in_suite
exports.colors = colors


// DESIRED MODULES
if (!modules) modules = []
if (!modules.some(d => d.type === 'pads')) modules.unshift({ type: 'pads', rights: { read: 0, write: 1 } }) // ALWAYS INCLUDE PADS

modules.forEach(d => {
	// THIS IS TO MAKE SURE USERS WHO CAN WRITE HAVE AT LEAST THE RIGHT TO VIEW
	const { rights } = d
	if (rights.write < rights.read) rights.write = rights.read // TO DO: CHECK THIS DOES NOT NEED TO BE d.rights…
})
exports.modules = modules
// DESIRED METADATA
if (metafields.some(d => d.type === 'location')) map = true
metafields.forEach(d => d.label = d.name.toLowerCase().trim().replace(/\s+/g, '_'))
exports.metafields = metafields || []

exports.media_value_keys = ['txt', 'html', 'src', 'srcs', 'shapes', 'options']

// DESIRED ENGAGEMENT TYPES
exports.engagementtypes = engagementtypes || []

// LANGUAGES AVAILABLE
exports.app_languages = app_languages.sort((a, b) => a.localeCompare(b))

// DB CONNECTION
exports.DB = require('./db/').DB

// DISPLAY VARIABLES
exports.map = map
exports.lazyload = lazyload
exports.page_content_limit = browse_display === 'columns' ? Math.floor(page_content_limit / 3) * 3 : page_content_limit
exports.followup_count = followup_count
exports.browse_display = browse_display
exports.view_display = view_display
exports.welcome_module = welcome_module
