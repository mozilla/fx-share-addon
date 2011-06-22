const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

// Register resource alias. Normally done in ServicesShare.manifest.
function addResourceAlias() {
  Cu.import("resource://gre/modules/Services.jsm");
  const resProt = Services.io.getProtocolHandler("resource")
                          .QueryInterface(Ci.nsIResProtocolHandler);
  let uri = Services.io.newURI("resource:///modules/services-share/", null, null);
  resProt.setSubstitution("services-share", uri);
}
addResourceAlias();

/**
 * Runs the next test in the gTests array.  gTests should be a array defined in
 * each test file.
 */
let gRunningTest = null;
let gTestIndex = 0; // The index of the currently running test.
function run_next_test()
{
  function _run_next_test()
  {
    if (gTestIndex < gTests.length) {
      do_test_pending();
      gRunningTest = gTests[gTestIndex++];
      print("TEST-INFO | " + _TEST_FILE + " | Starting " +
            gRunningTest.name);
      // Exceptions do not kill asynchronous tests, so they'll time out.
      try {
        gRunningTest();
      }
      catch (e) {
        do_throw(e);
      }
    }
  }

  // For sane stacks during failures, we execute this code soon, but not now.
  do_execute_soon(_run_next_test);

  if (gRunningTest !== null) {
    // Close the previous test do_test_pending call.
    do_test_finished();
  }
}
