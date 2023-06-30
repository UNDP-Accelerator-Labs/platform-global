const { app_title } = include('config/')
const nodeMailer = require('nodemailer')

exports.main = (kwargs) => {
	let { from, to, subject, html } = kwargs
	if (!from) from = `"${app_title}" <myjyby@gmail.com>`
	if (!to) return { status: 500, message: 'The message has no recipient.' }
	if (!subject) return { status: 500, message: 'The message has no subject.' }
	if (!html) return { status: 500, message: 'There is no message to send.' }

	// https://appdividend.com/2022/03/03/send-email-in-node-js/#:~:text=js-,To%20send%20an%20email%20in%20Node.,sending%20email%20messages%20between%20servers.
	let transporter = nodeMailer.createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
		auth: {
			user: process.env.SMTPuser,
			pass: process.env.SMTPpassword
		}
	})
	let mailOptions = {
		from,
		to,
		subject,
		html
	}

	return new Promise(resolve => {
		transporter.sendMail(mailOptions, (err, info) => {
			if (err) resolve({ status: 500, message: err })
			resolve({ status: 200, message: `Message ${info?.messageId} sent: ${info?.response}` })
		})
	})
}