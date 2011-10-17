/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

let {validateURL} = require("fx-share-addon/panel");

let bad_urls = [
  "/invalid/path",
  "file:///invalid/path",
  "http://invalid.comhttp://invalid.com",
  "http:///invalid/path",
  "chrome://browser/content/aboutDialog.xul",
  "http://invalid.com:foo/somepath",
  "http://www.invalid.orghttp://s3.www.invalid.org/images/small_logo.png"
  ];

let good_urls = [
  "http://valid/",
  "http://valid.com",
  "http://valid.com/somepath",
  "http://valid.com:80/somepath",
  "https://valid.com:80/somepath#foobar?test=1",
  "http://s3.www.valid.org/images/small_logo.png",
  "ftp://valid/",
  "ftps://valid/"
  ];

exports.runTest = function(test) {
  // First test urls that should fail validation.
  for (var i=0; i < bad_urls.length; i++) {
    test.assertStrictEqual(validateURL(bad_urls[i]), null);
  }

  // Test some good urls now.
  for (var i=0; i < good_urls.length; i++) {
    test.assertStrictEqual(validateURL(good_urls[i]), good_urls[i]);
  }
}
