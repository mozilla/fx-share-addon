/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

function test() {
  waitForExplicitFinish();
  openTab(PAGE_URL, function() {
    run_next_test();
  });
}

Services.scriptloader.loadSubScript(CHROME_PREFIX + "keyvaluestore_tests.js",
                                    this);

gTests.push(function tearDown() {
  gBrowser.removeCurrentTab();
  cleanup(finish);
});
