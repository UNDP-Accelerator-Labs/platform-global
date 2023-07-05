const axios = require('axios')

exports.get = (kwargs) => {
	let { req, url, params } = kwargs;

	return axios.get(url, {
		params,
		headers: {
			'Content-Type': 'application/json', 
			"Custom-Fetch": "aclab-platform-fetch"
			// 'Authorization': 'Bearer <your_token>' 
		}
	})
	.then( ({ data } )=> data)
	.catch(err=> {
        console.log('err ', err)
        return {}
    })
}