// Sadly this is hard to make as a regular unit-test - it would require
// hard-coding an smtp server and credentials into the test suite.
// So for now, this test is enabled when certain magic environment variables
// are set.
const {Cc, Ci} = require("chrome")
const {SslSmtpClient} = require("email/smtp");
const {MimeMultipart, MimeText, MimeEncoded} = require("email/mime");

var environ = Cc["@mozilla.org/process/environment;1"]
              .getService(Ci.nsIEnvironment);

let smtpArgs = {
  server: environ.get("FXSHARE_TEST_SMTP_SERVER") || 'smtp.gmail.com',
  port: environ.get("FXSHARE_TEST_SMTP_PORT") || 587,
  connectionType: environ.get("FXSHARE_TEST_SMTP_CONNECTION_TYPE") || 'starttls',
  email: environ.get("FXSHARE_TEST_SMTP_EMAIL"),
  senderName: environ.get("FXSHARE_TEST_SMTP_SENDER_NAME")
};

let authArgs = {
  plain: {
    username: environ.get("FXSHARE_TEST_SMTP_USERNAME"),
    password: environ.get("FXSHARE_TEST_SMTP_PASSWORD")
  },
  xoauth: null // we build this manually...
};

function sendEmail(test, payload) {
  // first sort out the auth stuff.
  if (environ.get("FXSHARE_TEST_OAUTH_TOKEN")) {
    // this matches the oauthConfig structure that is used in fx-share
    authArgs.xoauth = {
      consumerSecret: environ.get("FXSHARE_TEST_OAUTH_CONSUMER_SECRET") || 'anonymous',
      consumerKey: environ.get("FXSHARE_TEST_OAUTH_CONSUMER_KEY") || 'anonymous',
      tokenSecret: environ.get("FXSHARE_TEST_OAUTH_TOKEN_SECRET"),
      token: environ.get("FXSHARE_TEST_OAUTH_TOKEN"),
      serviceProvider: {
        signatureMethod: "HMAC-SHA1",
        emailUrl: "https://mail.google.com/mail/b/%s/smtp/"
      }
    };
  } else if (authArgs.plain.username && authArgs.plain.password) {
    // the auth structure is ready to go for plain authentication
    ;
  } else {
    // no concept of skipping a test, so just say it passed.
    test.pass("skipping test as required environment variables not configured");
    return;
  }

  // smtp module uses a 15 second connection timeout, so we use a little more.
  test.waitUntilDone(20000);
  let finished = false;
  let on_disconnect = function() {
    if (!finished) {
      test.fail("premature disconnection");
    } else {
      test.pass("apparently we worked!");
    }
  }

  let client = new SslSmtpClient(on_disconnect);
  let on_connected = function() {
    console.log("connected - starting login");
    client.authenticate(authArgs,
      function() {
        // now we can send the message.
        let to = [environ.get("FXSHARE_TEST_EMAIL_TO") || environ.get("FXSHARE_TEST_SMTP_EMAIL")];
        payload.addHeader('To', to);
        payload.addHeader('From', to);
        client.sendMessage(to, payload,
                           function() {
                            finished = true;
                            test.pass("message sent");
                            test.done();
                           },
                           function(why) {
                            test.fail("message delivery failed: " + why);
                            test.done();
                           }
                           );
      },
      function(err) {
        test.fail("authentication failed: " + err.reply);
        test.done();
      }
    )
  }
  let on_error = function(err) {
    test.fail("connection failed: " + err.type + "/" + err.message + "/" + err.reply);
    test.done();
  }
  let logging = true;
  client.connect(smtpArgs, on_connected, on_error, logging);
}

exports.testSmtpSimpleSend = function(test) {
  let msg = new MimeMultipart('alternative');
  msg.addHeader('Subject', "simple test message from fx-share with funny \u00a9 char");

  let part1 = new MimeText("hello there funny \u00a9har", 'plain')
  part1.setCharset('utf-8')

  let part2 = new MimeText("<b>hello</b> there funny \u00a9har", 'html')
  part2.setCharset('utf-8')

  msg.attach(part1);
  msg.attach(part2);
  sendEmail(test, msg);
}

exports.testSmtpImageSend = function(test) {
  let msg = new MimeMultipart('alternative');
  msg.addHeader('Subject', "image test message from fx-share with funny \u00a9 char");

  let part2 = new MimeMultipart('related')
  let html = new MimeText('<b>hello</b><img src="cid:thumbnail">', 'html')
  html.setCharset('utf-8');

  // a small red dot.
  let b64image = "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w\r\n38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";
  let image = new MimeEncoded("image", "png", b64image, "base64")
  image.addHeader('Content-Id', '<thumbnail>');
  image.addHeader('Content-Disposition', 'inline; filename=thumbnail.png');
  part2.attach(html)
  part2.attach(image)

  let part1 = new MimeText("hello", 'plain')
  part1.setCharset('utf-8')

  msg.attach(part1)
  msg.attach(part2)
  sendEmail(test, msg);
}
