// Sadly this is hard to make as a regular unit-test - it would require
// hard-coding an smtp server and credentials into the test suite.
// So for now, this test is enabled when certain magic environment variables
// are set.
const {Cc, Ci} = require("chrome")
const {SslSmtpClient} = require("email/smtp");

var environ = Cc["@mozilla.org/process/environment;1"]
              .getService(Ci.nsIEnvironment);

let smtpArgs = {
  server: environ.get("FXSHARE_TEST_SMTP_SERVER") || 'smtp.gmail.com',
  port: environ.get("FXSHARE_TEST_SMTP_PORT") || 587,
  connectionType: environ.get("FXSHARE_TEST_SMTP_CONNECTION_TYPE") || 'starttls',
  email: environ.get("FXSHARE_TEST_SMTP_EMAIL"),
  userName: environ.get("FXSHARE_TEST_SMTP_USERNAME"), // will default based on 'email'
  senderName: environ.get("FXSHARE_TEST_SMTP_SENDER_NAME"),
  password: environ.get("FXSHARE_TEST_SMTP_PASSWORD")
}

exports.testSmtpSuccessfulSend = function(test) {
  if (!smtpArgs.email || !smtpArgs.password) {
    // no concept of skipping a test, so just say it passed.
    test.pass("skipping test as environment variables not configured");
    return;
  }
  // smtp module uses a 15 second connection timeout, so we use a little more.
  test.waitUntilDone(20000);
  let finished = false;
  let client = new SslSmtpClient();
  let on_login = function() {
    console.log("logged in");
    // now we can send the message.
    let to = [environ.get("FXSHARE_TEST_EMAIL_TO") || environ.get("FXSHARE_TEST_SMTP_EMAIL")];
    client.sendMessage(to, "test message from fx-share",
                       "Hello <b>there</b>", // html
                       "Hello there", // txt
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
  }
  let on_bad_password = function(reply) {
    test.fail("password rejected: " + reply);
    test.done();
  }
  let on_error = function(err) {
    test.fail("error callback called: " + err);
    test.done();
  }
  let on_disconnect = function() {
    if (!finished) {
      test.fail("premature disconnection");
    } else {
      test.pass("apparently we worked!");
    }
    test.done();
  }
  let logging = true;
  client.connect(smtpArgs, on_login, on_bad_password, on_error, on_disconnect, logging);
}
