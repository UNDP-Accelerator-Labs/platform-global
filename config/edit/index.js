//// EDIT THIS
// GENERAL APP INFO
exports.app_title = 'UNDP AccLabs Pads, Generic pads'
exports.app_title_short = 'pads'
exports.app_suite = 'acclab_platform'
exports.app_suite_secret = process.env.APP_SUITE_SECRET || 'secret'
exports.app_languages = ['en', 'fr', 'es', 'pt']
exports.app_description = require('./translations.js').translations['app description']

// apps_in_suite NEED TO BE THE NAMES OF THE DIFFERENT DBs
exports.apps_in_suite = [
	{ name: 'Action Plans', key: process.env.NODE_ENV === 'production' ? 'action_plans_platform' : (process.env.DB_AP || 'solution_mapping_platform'), baseurl: 'https://acclabs-actionlearningplans.azurewebsites.net/' },
	{ name: 'Solutions Mapping', key: process.env.NODE_ENV === 'production' ? 'solutions_mapping_platform' : (process.env.DB_SM || 'solution_mapping_platform'), baseurl: 'https://acclabs-solutionsmapping.azurewebsites.net/' },
	{ name: 'Experiments', key: process.env.NODE_ENV === 'production' ? 'experiments_platform' : (process.env.DB_EXP || 'solution_mapping_platform'), baseurl: 'https://acclabs-experiments.azurewebsites.net/' }
	// { name: 'Blogs', key: 'exp_test_02', baseurl: 'https://acclabs-blogs.azurewebsites.net/' },
	// { name: 'Consent archive', key: 'exp_test_02', baseurl: 'https://acclabs-consent-archive.azurewebsites.net/' },
	// { name: 'Buzz', key: 'exp_test_02', baseurl: 'https://acclabs-buzz.azurewebsites.net/' },
	// { name: 'Bootcamps', key: 'exp_test_02', baseurl: 'https://sites.google.com/view/acclab-bootcamp/home' },
	// { name: 'Main wesite', key: 'exp_test_02', baseurl: 'https://www.undp.org/acceleratorlabs' },

]

// DESIRED MODULES
exports.modules = [
	{ type: 'pads', rights: { read: 0, write: 1 } },
	{ type: 'pinboards', rights: { read: 0, write: 1 } },
	// { type: 'templates', rights: { read: 2, write: 2 } },
	// { type: 'files', rights: { read: 0, write: 1 } },
	{ type: 'contributors', rights: { read: 2, write: 2 } },
	{ type: 'teams', rights: { read: 2, write: 2 } },
	{ type: 'blog', rights: { read: 0, write: 0 } }

	// { type: 'analyses', rights: { read: 1, write: 2 } }
]

// NOTE: reviews IS DEPENDENT ON tags RIGHT NOW (FOR ASSIGNMENT OF REVIEWERS)

// DESIRED METADATA
// TO DO: metafields SHOULD BE ANY KIND OF MEDIA, E.G. CHECKBOX WITH VALUES, TEXT, ETC
	// OPTIONS: ['tags', 'sdgs', 'methods', 'datasources', 'locations']
exports.metafields = [
	{ type: 'index', name: 'SDGs', required: true, opencode: false, limit: 5 },

	{ type: 'tag', name: 'thematic areas', required: true, opencode: true, limit: 5 },
	{ type: 'tag', name: 'methods', required: true, opencode: false },
	{ type: 'tag', name: 'datasources', required: true, opencode: true },
	// { type: 'location', name: 'locations', required: true }
]
// DESIRED ENGAGEMENT TYPES
	// OPTIONS: ['like', 'dislike', 'comment']
exports.engagementtypes = ['like', 'dislike', 'comment']

// COLORS
exports.colors = {
	'dark-blue': '#005687',
	'mid-blue': '#0468B1',
	'mid-blue-semi': 'rgba(4,104,177,.75)',
	'light-blue': '#32BEE1',

	'dark-red': '#A51E41',
	'mid-red': '#FA1C26',
	'light-red': '#F03C8C',

	'dark-green': '#418246',
	'mid-green': '#61B233',
	'light-green': '#B4DC28',

	'dark-yellow': '#FA7814',
	'mid-yellow': '#FFC10E',
	'light-yellow': '#FFF32A',

	'dark-grey': '#000000',
	'mid-grey': '#646464',
	'light-grey': '#969696'
}

// DISPLAY VARIABLES
exports.map = true
exports.lazyload = false
exports.page_content_limit = 25
exports.followup_count = 1
	// OPTIONS: 'columns', 'rows'
exports.browse_display = 'rows'
exports.view_display = 'page'
	// OPTIONS: 'mosaic', 'carousel'
exports.welcome_module = 'carousel'
