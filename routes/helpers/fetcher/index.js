const fetch = require("node-fetch");
const { checklanguage, datastructures } = include('routes/helpers/');

exports.main = async (req, url, method = 'GET', requestData = null) => {
    const language = checklanguage(req.params?.language || req.session.language);
    
    let { uuid, rights, collaborators, public } = {};
    if (req.session.uuid) { // USER IS LOGGED IN
        ({ uuid, rights, collaborators, public } = req.session);
    } else { // PUBLIC/ NO SESSION
        ({ uuid, rights, collaborators, public } = datastructures.sessiondata({ public: true }) || {});
    }

    const fetchOptions = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Api-Access-Token': req.session.token
        },
        body: requestData ? JSON.stringify(requestData) : null,
    };

    return fetch(url, fetchOptions)
        .then(response => response.json())
        .catch(err=> console.log(err));
};