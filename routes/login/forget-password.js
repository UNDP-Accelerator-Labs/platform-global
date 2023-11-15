const sendEmail = require('../helpers').email
const { DB } = include('config/')
const { datastructures, sessionupdate } = include('routes/helpers/')
const jwt = require('jsonwebtoken');

 // Function to send password reset email
async function sendResetEmail(email, html) {
  await sendEmail({
    to: email,
    subject: 'Password reset',
    html
  });
}

 // Generate and send password reset token
 exports.forgetPassword = async (req, res, next) => {
  const { email } = req.body;
   // Check if the provided email exists in the database
  const user = await DB.general.oneOrNone(`
    SELECT * FROM users WHERE email = $1;
  `, [email]);
   if (!user) {
    req.session.errormessage = 'Email not found.';
    res.redirect('/login');
    return;
  }
  const { host, protocol } = req
  const mainHost = host.split(".").slice(-2).join(".");
  // Generate a password reset token and save it in the database
  const token = await jwt.sign(
    { email, action: 'password-reset' },
    process.env.APP_SECRET,
    { expiresIn: '24h', issuer: mainHost })

  // Generate the password reset link with the extracted token and base URL
  const resetLink = `${protocol}://${host}/reset/${token}`;
  const html = `
  <div>
      <p>Dear User,</p>
      <br/>
      <p>We have received a request to reset your password. Please click the link below to proceed:</p>
      <p><a href="${resetLink}">Reset Password</a></p>
      <p>This link will expire in 24 hours.</p>

      <p>If you did not request a password reset, please ignore this email.</p>
      <br/>
      <p>Best regards,</p>
      <p>AccLab Global Team</p>
  </div`

  // Send the password reset email
  await sendResetEmail(email, html);

  req.session.errormessage = 'Password reset link has been successfully sent to your email. Please check your email inbox/spam to use the reset link.'

   // Redirect the user to a page indicating that the reset email has been sent
  res.redirect('/forget-password');
};

function verifyTokenFields(decoded, res) {
  const { email, action } = decoded;
  if (!email || action !== 'password-reset') {
    return false;
  }
  return true;
}

 // Reset password page
exports.getResetToken = async (req, res, next) => {
  const { token } = req.params;
  req.session.errormessage = '';

  jwt.verify(token, process.env.APP_SECRET, async function(err, decoded) {
    if(decoded) {
      if (!verifyTokenFields(decoded, res)) {
        return res.status(401).send('invalid token');
      }
      // Render the reset password form
      const { originalUrl, path } = req || {}
      const { errormessage, successmessage } = req.session || {}
      const metadata = await datastructures.pagemetadata({ req, res })
      const data = Object.assign(metadata, { originalUrl, errormessage, successmessage, token })

      return res.render('reset-password', data );
    } else {
      req.session.errormessage = 'Invalid or expired token.';
      return res.redirect('/login');
    }
  });
};

// Update password after reset
exports.updatePassword = async (req, res, next) => {
  const { password, confirmPassword, token } = req.body;
  req.session.errormessage = '';

  const { originalUrl, path } = req || {}

  jwt.verify(token, process.env.APP_SECRET, async function(err, decoded) {
    if(decoded) {
      if (!verifyTokenFields(decoded, res)) {
        return res.status(401).send('invalid token');
      }
      const { originalUrl, path } = req || {}
        // Check if the password and confirm password match
        if (password !== confirmPassword) {
          req.session.errormessage = 'Password and confirm password do not match.';

          const { errormessage, successmessage } = req.session || {}
          const metadata = await datastructures.pagemetadata({ req, res })

          let data = Object.assign(metadata, { originalUrl, errormessage, successmessage, token })

          return res.render('reset-password', data );
        }

        let checkPass = isPasswordSecure(password)
        if(Object.keys(checkPass).some((key) => !checkPass[key])){
            const msgs = {
              'pw-length': 'Password is too short!',
              'pw-upper': 'Password requires at least one uppercase letter!',
              'pw-lower': 'Password requires at least one lowercase letter!',
              'pw-number': 'Password requires at least one numberal!',
              'pw-special': 'Password requires at least one of the special characters: !@#$%^&*()',
              'pw-common': 'Password cannot be a commonly used password!',
            };
            req.session.errormessage = Object.keys(checkPass).filter((key) => !checkPass[key]).map((key) => msgs[key]).join('\n');

            const { errormessage, successmessage } = req.session || {}
            const metadata = await datastructures.pagemetadata({ req, res })
            let data = Object.assign(metadata, { originalUrl, errormessage, successmessage, token })

            return res.render('reset-password', data );
        }

        // Update the password and clear the reset token
          await DB.general.none(`
          UPDATE users SET password = CRYPT($1, password) WHERE email = $2;
        `, [password, decoded.email]);

        //UPDATE ALL ACTIVE SESSION
        sessionupdate({
          conn: DB.general,
          whereClause: `sess ->> 'email' = $1`,
          queryValues: [decoded.email]
        })

        // Redirect the user to the login page
        res.redirect('/login');
    } else {
      req.session.errormessage = 'Invalid or expired token.';
      return res.redirect('/login');
    }
  });
};


const isPasswordSecure = (password) => {
  // Check complexity (contains at least one uppercase, lowercase, number, and special character)
  const uppercaseRegex = /[A-Z]/;
  const lowercaseRegex = /[a-z]/;
  const numberRegex = /[0-9]/;
  const specialCharRegex = /[!@#$%^&*\(\)]/;
  // Check against common passwords (optional)
  const commonPasswords = ['password', '123456', 'qwerty'];
  return {
    'pw-length': !(password.length < 8),  // Check length
    'pw-upper': uppercaseRegex.test(password),
    'pw-lower': lowercaseRegex.test(password),
    'pw-number': numberRegex.test(password),
    'pw-special': specialCharRegex.test(password),
    'pw-common': !commonPasswords.includes(password),
  };
}
