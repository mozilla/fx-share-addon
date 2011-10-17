/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
const {Cc, Ci} = require("chrome");
const {getSharePanel, getTestUrl, getShareButton, createTab, removeCurrentTab, getContentWindow} = require("./test_utils");
const Assert = require("test/assert").Assert;

// each test object has the url and the expected options.  we only include
// options we want to compare, other options we receive are ignored.
let tests = [
  {
    // tests getShortUrl
    get url() {
      return getTestUrl("corpus/opengraph.html")
    },
    options: {
      // og:title
      title: ">This is my title<",
      // og:description
      description: "A test corpus file for open graph tags we care about",
      //medium: this.getPageMedium(),
      //source: this.getSourceURL(),
      // og:url
      url: "https://f1.mozillamessaging.com/",
      //shortUrl: this.getShortURL(),
      // og:image
      previews: [{"http_url":"http://f1.mozillamessaging.com/favicon.png","base64":""}],
      // og:site_name
      siteName: ">My simple test page<"
    }
  },
  {
    // tests getShortUrl
    get url() {
      return getTestUrl("corpus/og_invalid_url.html")
    },
    options: {
      description: "A test corpus file for open graph tags passing a bad url",
      url: null,
      previews: [],
      siteName: "Evil chrome delivering website"
    }
  },
  {
    // tests getShortUrl
    get url() {
      return getTestUrl("corpus/shorturl_link.html")
    },
    options: {
      previews: [{"http_url":"http://farm5.static.flickr.com/4141/5411147304_9f3996ba27_m.jpg","base64":""}],
      url: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
      shortUrl: "http://flic.kr/p/9faxzb"
    }
  },
  {
    // tests getShortUrl
    get url() {
      return getTestUrl("corpus/shorturl_linkrel.html")
    },
    options: {
      previews: [{"http_url":"http://farm5.static.flickr.com/4141/5411147304_9f3996ba27_m.jpg","base64":""}],
      url: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
      shortUrl: "http://flic.kr/p/9faxzb"
    }
  },
  {
    // tests getShortUrl
    get url() {
      return getTestUrl("corpus/shortlink_linkrel.html")
    },
    options: {
      previews: [{"http_url":"http://farm5.static.flickr.com/4141/5411147304_9f3996ba27_m.jpg","base64":""}],
      url: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
      shortUrl: "http://flic.kr/p/9faxzb"
    }
  },
  // Selection related tests.
  // Simple selection of one element.
  {
    get url() {
      return getTestUrl("page.html");
    },
    options: {
      message: 'This is just another web page'
    },
    cbSetupPage: function(cw) {
      let p1 = cw.document.getElementsByTagName("p")[0];
      let range = cw.document.createRange();
      range.selectNode(p1);
      cw.getSelection().addRange(range);
    }
  },
  // Selection of 2 <p> elements.
  {
    get url() {
      return getTestUrl("page.html");
    },
    options: {
      message: "This is just another web page with a couple of paragraphs"
    },
    cbSetupPage: function(cw) {
      let [p1, p2] = cw.document.getElementsByTagName("p");
      let range = cw.document.createRange();
      range.setStartBefore(p1);
      range.setEndAfter(p2);
      cw.getSelection().addRange(range);
    }
  }
];


function hasoptions(test, testOptions, options) {
  let passed = true;
  let msg;
  for (let option in testOptions) {
    let data = testOptions[option];
    let message_data = options[option];
    if (Array.isArray(data)) {
      // the message may have more array elements than we are testing for, this
      // is ok since some of those are hard to test (e.g. base64 images). So we
      // just test that anything in our test data IS in the message.
      new Assert(test).deepEqual(data, message_data, "option "+option);
    } else {
      test.assertEqual(data, message_data, "option "+option);
    }
  }
}


function testOne(test, theTest) {
  if (typeof(theTest) == 'undefined') {
    test.done();
    return;
  }

  createTab(theTest.url, function(tab) {
    if (theTest.cbSetupPage) {
      theTest.cbSetupPage(getContentWindow());
    }
    let panel = getSharePanel();
    let options = panel.updateargs();
    hasoptions(test, theTest.options, options);

    removeCurrentTab(function() {
      // run the next test
      testOne(test, tests.shift());
    });
  });
}

exports.testShareOptions = function(test) {
  test.waitUntilDone();
  testOne(test, tests.shift());
}

// tests getCanonicalUrl when the link is relative.  We can't test this
// using testShareOptions as the canonical URL resolves to a file:// URL which
// PageOptionsBuilder considers invalid.  So we instantiate a
// PageOptionsBuilder, then monkey-patch its _validURL function to let all
// URLs through.
exports.testRelativeCanonical = function(test) {
  test.waitUntilDone();
  // The test page has a canonical URL with href="/canonical.html".  As the
  // page URL is file:///blah/blah/canonical_relative.html, the final
  // canonical URL is file:///canonical.html
  createTab(getTestUrl("corpus/canonical_relative.html"), function(tab) {
    let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator);
    let topwindow = wm.getMostRecentWindow("navigator:browser");
    let PageOptionsBuilder = require("fx-share-addon/panel").PageOptionsBuilder;
    let pageOptionsBuilder = new PageOptionsBuilder(topwindow.gBrowser);
    pageOptionsBuilder._validURL = function(url) url;
    test.assertEqual(pageOptionsBuilder.getCanonicalURL(), "file:///canonical.html");
    test.done();
  });
}
