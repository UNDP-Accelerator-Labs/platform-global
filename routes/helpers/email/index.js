const nodeMailer = require('nodemailer');

module.exports = async (kwargs) => {
	if (process.env.NODE_ENV !== "production" || !process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER) {
		console.log('working locally so no need to send email', kwargs);
		return new Promise(resolve => resolve(null));
	}
	const { to, subject, html } = kwargs;
	const from = `"No Reply" <no-reply@sdg-innovation-commons.org>`
	if (!to) return { status: 500, message: 'The message has no recipient.' }
	if (!subject) return { status: 500, message: 'The message has no subject.' }
	if (!html) return { status: 500, message: 'There is no message to send.' }

	let transporter = nodeMailer.createTransport({
		host: process.env.SMTP_HOST,
		port: process.env.SMTP_PORT,
		service: process.env.SMTP_SERVICE,
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASSWD,
		}
	})
	const mailOptions = {
		from,
		to,
		subject,
		html,
	};

	// console.log('SENDING EMAIL', from, to, subject);
	return new Promise(resolve => {
		transporter.sendMail(mailOptions, (err, info) => {
			if (err) {
				console.log('SENDING EMAIL FAILED', from, to, subject, err);
				resolve({ status: 500, message: err });
				return;
			}
			resolve({ status: 200, message: `Message ${info?.messageId} sent: ${info?.response}` })
		})
	})
}

// const sgMail = require('@sendgrid/mail');

// module.exports = (kwargs) => {
// 	if (process.env.NODE_ENV === "production") {
// 		const { SENDGRID_API_KEY, SENDER_IDENTITY, EMAIL_REPLY_RECIPEINT } = process.env;
// 		sgMail.setApiKey(SENDGRID_API_KEY);

// 		let { to, subject, html } = kwargs

// 		if (!to) return { status: 500, message: 'The message has no recipient.' }
// 		if (!subject) return { status: 500, message: 'The message has no subject.' }
// 		if (!html) return { status: 500, message: 'There is no message to send.' }

// 		try {
// 			const msg = {
// 			to,
// 			from: `${app_title} <${SENDER_IDENTITY}>`,
// 			subject,
// 			html,
// 			replyTo: EMAIL_REPLY_RECIPEINT
// 			};

// 			return new Promise(resolve => {
// 				if (process.env.NODE_ENV === "production") {
// 					sgMail.send(msg)
// 					.then(() => {}, error => {
// 						if (error.response) {
// 							resolve({ status: 500, message: error.response })
// 						}
// 						resolve({ status: 200, message: `Message sent!` })
// 					  });
// 				} else {
// 					console.log('should not send email because not in production')
// 					resolve(null)
// 				}
// 			})
// 		} catch (error) {
// 			console.error('Error sending email:', error);
// 		}
// 	} else {
// 		console.log('working locally so no need to send email')
// 		return new Promise(resolve => resolve(null))
// 	}
// }
