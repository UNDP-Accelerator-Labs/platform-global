const { app_title } = include('config/')
const sgMail = require('@sendgrid/mail');

module.exports = (kwargs) => {
	if (process.env.NODE_ENV === "production") {
		const { SENDGRID_API_KEY, SENDER_IDENTITY, EMAIL_REPLY_RECIPEINT } = process.env;
		sgMail.setApiKey(SENDGRID_API_KEY);

		let { to, subject, html } = kwargs

		if (!to) return { status: 500, message: 'The message has no recipient.' }
		if (!subject) return { status: 500, message: 'The message has no subject.' }
		if (!html) return { status: 500, message: 'There is no message to send.' }

		try {
			const msg = {
			to,
			from: `${app_title} <${SENDER_IDENTITY}>`,
			subject,
			html,
			replyTo: EMAIL_REPLY_RECIPEINT
			};

			return new Promise(resolve => {
				if (process.env.NODE_ENV === "production") {
					sgMail.send(msg)
					.then(() => {}, error => {
						if (error.response) {
							resolve({ status: 500, message: error.response })
						}
						resolve({ status: 200, message: `Message sent!` })
					  });
				} else {
					console.log('should not send email because not in production')
					resolve(null)
				}
			})
		} catch (error) {
			console.error('Error sending email:', error);
		}
	} else {
		console.log('working locally so no need to send email')
		return new Promise(resolve => resolve(null))
	}
}
