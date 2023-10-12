const jwt = require("jsonwebtoken");
const { email: sendEmail, sessionupdate } = include("routes/helpers/");
const { DB } = include("config/");

exports.confirmEmail = async (_kwarg) => {
  const { uuid, email, name, old_email, req } = _kwarg;

  const { host } = req.headers || {};
  const protocol = req.protocol;

  const token = await jwt.sign(
    { email, uuid, name, old_email, action: "confirm-email" },
    process.env.APP_SECRET,
    { expiresIn: "1h", issuer: host }
  );

  const confirmationLink = `${protocol}://${host}/confirm-email/${token}`;

  // Send the email to the user
  // TO DO: translate
  return sendEmail({
    to: email,
    subject: `Email Address Confirmation`,
    html: `
            <div>
              <p>Dear ${name},</p>
              <br/>
              <p>We have noticed that you recently attempted to change your email address.</p>
              <p>To confirm your new email address, please click on the link below:</p>
              <a href="${confirmationLink}">Confirm Email Address</a>
              <br/>
              <p>This link expires in 1 hour. If you did not initiate this change, please ignore this email or contact our support team.</p>
              <br/>
              <p>Best regards,</p>
              <p>AccLab Global Team</p>
            </div>`,
  });
};

exports.updateRecord = (_kwarq) => {
  const { data, conn } = _kwarq;
  return conn.none(
    `
      UPDATE users
      SET name = $1,
          position = $3,
          $4:raw
          iso3 = $5,
          language = $6,
          secondary_languages = $7,
          $8:raw
          notifications = $9,
          reviewer = $10
      WHERE uuid = $11
      ;`,
    data
  );
};

function verifyTokenFields(decoded, res) {
  const { email, action, uuid, name } = decoded;
  if (!email || !uuid || !name || action !== "confirm-email") {
    return false;
  }
  return true;
}

exports.updateNewEmail = async (req, res, next) => {
  const { token } = req.params;
  const { referer } = req.headers || {}

  req.session.errormessage = "";
  jwt.verify(token, process.env.APP_SECRET, async function (err, decoded) {
    if (decoded) {
      if (!verifyTokenFields(decoded, res)) {
        return res.status(401).send("invalid token");
      }
      const { email, action, uuid, name, old_email } = decoded;

      await DB.general
        .tx(async (t) => {
          await t.none(
            `
            UPDATE users 
            SET email = $1
            WHERE uuid = $2
        `,
            [email, uuid]
          );
          await sessionupdate({
            conn: t,
            queryValues: [uuid],
            whereClause: `sess ->> 'uuid' = $1`,
          });
        })
        .then(() => {
          sendEmail({
            to: old_email,
            subject: `Email Address Update Notification`,
            html: `
                    <div>
                      <p>Dear ${name},</p>
                      <br/>
                      <p>We are writing to inform you that your email address has been updated.</p>
                      <p>If you made this change, please disregard this notification.</p>
                      <p>However, if you did not authorize this change, please contact our support team immediately.</p>
                      <br/>
                      <p>Best regards,</p>
                      <p>AccLab Global Team</p>
                    </div>`,
          });
        })
        .catch((err) => console.log(err));

        req.session.errormessage = 'Email changed successful.'

      if(req.session.uuid === uuid){
        req.session.destroy()
        return res.redirect("/login");
      }
      else res.render(referer || '/');
    } else {
      req.session.errormessage = "Invalid or expired token.";
      return res.redirect("/login");
    }
  });
};
