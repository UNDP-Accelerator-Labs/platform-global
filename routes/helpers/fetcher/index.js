const fetch = require("node-fetch");
const { checklanguage, datastructures } = include('routes/helpers/');

exports.main = async (req, url, method = 'GET', requestData = null) => {
    if (!req.session.token) { 
        Object.assign(req.session, datastructures.sessiondata());
    } 
    
    const fetchOptions = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'x-access-token-global': req.session.token
        },
        body: requestData ? JSON.stringify(requestData) : null,
    };

    return fetch(url, fetchOptions)
        .then(response => response.json())
        .catch(err=> console.log(err));
};