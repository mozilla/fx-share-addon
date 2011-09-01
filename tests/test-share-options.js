/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */
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
      //url: this.gBrowser.currentURI.spec,
      // og:url
      canonicalUrl: "http://f1.mozillamessaging.com/",
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
      return getTestUrl("corpus/shorturl_link.html")
    },
    options: {
      previews: [{"http_url":"http://farm5.static.flickr.com/4141/5411147304_9f3996ba27_m.jpg","base64":""}],
      canonicalUrl: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
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
      canonicalUrl: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
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
      canonicalUrl: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
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
