const { DB } = include('config/')

exports.main = (req, res) => {
	const { id, password } = req.body || {}

	DB.general.oneOrNone(`
		SELECT TRUE AS bool FROM users
		WHERE uuid = $1
		AND password = CRYPT($2, password)
	;`, [ id, password ], d => d?.bool)
	.then(result => {
		if (result) res.json({ status: 200, message: 'Passowrd is correct.' })
		else res.json({ status: 401, message: 'Passowrd is incorrect.' })
	}).catch(err => console.log(err))
}