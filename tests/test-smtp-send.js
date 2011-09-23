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
  senderName: environ.get("FXSHARE_TEST_SMTP_SENDER_NAME")
};

let authArgs = {
  plain: {
    username: environ.get("FXSHARE_TEST_SMTP_USERNAME"),
    password: environ.get("FXSHARE_TEST_SMTP_PASSWORD")
  },
  xoauth: null // we build this manually...
};


exports.testSmtpSuccessfulSend = function(test) {
  dump("testSmtpSuccessfulSend\n");
  // first sort out the auth stuff.
  if (environ.get("FXSHARE_TEST_OAUTH_TOKEN")) {
    // looks like oauth.
    // We keep the actual signing process out of smtp itself to keep the
    // signing mechanism from being a dependency of the smtp api.
    let {OAuth} = require("OAuth");
    let accessor = {
      consumerSecret: environ.get("FXSHARE_TEST_OAUTH_CONSUMER_SECRET") || 'anonymous',
      consumerKey: environ.get("FXSHARE_TEST_OAUTH_CONSUMER_KEY") || 'anonymous',
      tokenSecret: environ.get("FXSHARE_TEST_OAUTH_TOKEN_SECRET"),
      token: environ.get("FXSHARE_TEST_OAUTH_TOKEN")
    };
    let action = "https://mail.google.com/mail/b/" + smtpArgs.email + "/smtp/";
    let message = {method: 'GET', parameters: {
            'oauth_signature_method': "HMAC-SHA1",
            'oauth_token': environ.get("FXSHARE_TEST_OAUTH_TOKEN")
      }, action: action};
    OAuth.completeRequest(message, accessor);

    // much like OAuth.getAuthorizationHeader except that does the realm etc.
    let data = [];
    let list = OAuth.getParameterList(message.parameters);
    list.sort();
    for (var p = 0; p < list.length; ++p) {
      let value = list[p][1];
      if (value == null) value = "";
      data.push(OAuth.percentEncode(list[p][0]) + '="' + OAuth.percentEncode(value) + '"');
    }
    authArgs.xoauth = "GET " + action + " " + data.join(",");
    console.log("xoauth data is", authArgs.xoauth);
  } else if (authArgs.plain.username && authArgs.plain.password) {
    // the auth structure is ready to go for plain authentication
    ;
  } else {
    // no concept of skipping a test, so just say it passed.
    dump("skipping the test!\n");
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
dump("try to send an email!\n");
  let client = new SslSmtpClient(on_disconnect);
  let on_connected = function() {
    console.log("connected - starting login");
    client.authenticate(authArgs,
      function() {
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
