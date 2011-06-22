/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// each test object has the url and the expected options.  we only include
// options we want to compare, other options we receive are ignored.
let tests = [
  {
    // tests getShortUrl
    url: PREFIX + "corpus/opengraph.html",
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
    url: PREFIX + "corpus/shorturl_link.html",
    options: {
      previews: [{"http_url":"http://farm5.static.flickr.com/4141/5411147304_9f3996ba27_m.jpg","base64":""}],
      canonicalUrl: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
      shortUrl: "http://flic.kr/p/9faxzb"
    }
  },
  {
    // tests getShortUrl
    url: PREFIX + "corpus/shorturl_linkrel.html",
    options: {
      previews: [{"http_url":"http://farm5.static.flickr.com/4141/5411147304_9f3996ba27_m.jpg","base64":""}],
      canonicalUrl: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
      shortUrl: "http://flic.kr/p/9faxzb"
    }
  },
  {
    // tests getShortUrl
    url: PREFIX + "corpus/shortlink_linkrel.html",
    options: {
      previews: [{"http_url":"http://farm5.static.flickr.com/4141/5411147304_9f3996ba27_m.jpg","base64":""}],
      canonicalUrl: "http://www.flickr.com/photos/mixedpuppy/5411147304/",
      shortUrl: "http://flic.kr/p/9faxzb"
    }
  }
];


// every needle must be in the haystack
function has(needle, haystack) {
  return needle.every(function(el, i, ar) {
    return haystack.some(function(hl, hi, har) {
      return SimpleTest._deepCheck(el, hl, [], []);
    });
  });
}

function hasoptions(options, message) {
  let passed = true;
  for (let option in options) {
    let data = options[option];
    let message_data = message.data.options[option];
    if (Array.isArray(data)) {
      // the message may have more array elements than we are testing for, this
      // is ok since some of those are hard to test (e.g. base64 images). So we
      // just test that anything in our test data IS in the message.
      if (!has(data, message_data)) {
        passed = false;
        //dump("TEST-FAIL-DATA option "+option+" "+JSON.stringify(data)+
        //     " not in "+JSON.stringify(message_data)+"\n");
        break;
      }
    } else {
      if (data != message_data) {
        passed = false;
        //dump("TEST-FAIL-DATA option "+option+" "+JSON.stringify(data)+
        //     " not in "+JSON.stringify(message_data)+"\n");
        break;
      }
    }
  }
  // only one test per message
  ok(passed);
}

function testOne(theTest) {
  if (typeof(theTest) == 'undefined') {
    cleanup(finish);
    return;
  }

  openTab(theTest.url, function() {
    // Panel sends a "shareState" message in response to "getShareState"
    next(gShareWindow, "message", function(event) {
      let message = JSON.parse(event.data);
      is(message.topic, "shareState");
      isnot(message.data, undefined);
      hasoptions(theTest.options, message);

      gBrowser.removeCurrentTab();
      // run the next test
      testOne(tests.shift());
    });
    ffshare.togglePanel();
  });

}

function test() {
  waitForExplicitFinish();
  testOne(tests.shift());
}
