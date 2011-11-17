// Tests extracted from the Python email package's test_email.py.

let {parseaddrlist, parseaddr, formataddr} = require("email/addressutils");

function assertAddrsEqual(test, ad1, ad2) {
  // each elt should be an array of [name, address]
  if (ad1.length != 2) {
    return test.fail("Each addresslist item should be an array of 2 items: " + ad1);
  }
  if (ad2.length != 2) {
    return test.fail("Each addresslist item should be an array of 2 items: " + ad2);
  }
  if (ad1[0] != ad2[0] || ad1[1] != ad2[1]) {
    return test.fail("Address list elements are different: " + ad1 + " != " + ad2);
  }
  test.pass(ad1 + " == " + ad2);
  return true;
}

function assertAddrListsEqual(test, al1, al2) {
  if (al1.length != al2.length) {
    return test.fail("Different address lengths: " + al1 + "/" + al2);
  }
  for (let i=0; i<al1.length; i++) {
    let ad1 = al1[i];
    let ad2 = al2[i];
    if (!assertAddrsEqual(test, ad1, ad2)) {
      return undefined;
    }
  }
  test.pass(al1 + "==" + al2);
  return undefined;
}

exports.testParseEmpty = function(test) {
  assertAddrListsEqual(test, parseaddrlist('<>'), [['', '']]);
};

exports.testNoQuote = function(test) {
  test.assertEqual(formataddr(['A Silly Person', 'person@dom.ain']),
                   'A Silly Person <person@dom.ain>');
};

exports.testQuote = function(test) {
  test.assertEqual(formataddr(['A (Very) Silly Person', 'person@dom.ain']),
                   '"A \\(Very\\) Silly Person" <person@dom.ain>');
  let a = 'A \\(Special\\) Person'
  let b = 'person@dom.ain';
  assertAddrsEqual(test, parseaddr(formataddr([a, b])), [a, b]);
};

exports.testEscapeBackslashes = function(test) {
  test.assertEqual(formataddr(['Arthur \\Backslash\\ Foobar', 'person@dom.ain']),
                   '"Arthur \\\\Backslash\\\\ Foobar" <person@dom.ain>');
  let a = 'Arthur \\Backslash\\ Foobar';
  let b = 'person@dom.ain';
  assertAddrsEqual(test, parseaddr(formataddr([a, b])), [a, b]);
};

exports.testNameWithDot = function(test) {
  let x = 'John X. Doe <jxd@example.com>';
  let y = '"John X. Doe" <jxd@example.com>';
  let a = 'John X. Doe';
  let b = 'jxd@example.com';
  assertAddrsEqual(test, parseaddr(x), [a, b]);
  assertAddrsEqual(test, parseaddr(y), [a, b]);
  // formataddr() quotes the name if there's a dot in it
  test.assertEqual(formataddr([a, b]), y);
};

exports.testMultiLine = function(test) {
  let x = "\r\nFoo\r\n\tBar <foo@example.com>";
  assertAddrsEqual(test, parseaddr(x), ['Foo Bar', 'foo@example.com']);
};

exports.testSemiColon = function(test) {
  test.assertEqual(formataddr(['A Silly; Person', 'person@dom.ain']),
                   '"A Silly; Person" <person@dom.ain>');
  
};

exports.testComments = function(test) {
  addrs = parseaddr('User ((nested comment)) <foo@bar.com>');
  test.assertEqual(addrs[1], "foo@bar.com");
};
