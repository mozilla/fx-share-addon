// A simple, testable web-app implementing the link share service.

// Most of the calls in this app "block" until told by the test framework to
// "resume" (where "block" means the callback isn't called).
// pendingCalls is calls made into the service where the 'result' of the call
// hasn't yet been specified by the test framework.
var pendingCalls = {};
var isFinished = false;

// A 'test' service used by the tests to control this app.
navigator.apps.services.registerHandler('test', 'resume', function(args, cb, cberr) {
  // resume from a 'blocked' call.
  var attemptNum = 0;
  function doit() {
    if (isFinished) {
      cberr("test_suite_error", "this app has been finalized");
      return;
    }
    if (!(args.method in pendingCalls)) {
      // so the call hasn't yet been made to the app - sleep and retry later.
      if (++attemptNum > 100) {
        cberr("test_error", "gave up waiting for a call to '" + args.method + "'");
        return;
      }
      setTimeout(doit, 100);
      return;
    }
    var pendingRec = pendingCalls[args.method];
    delete pendingCalls[args.method];
  
    // make the pending callback with the args supplied by the test suite
    if (args.successArgs) {
      pendingRec.cb(args.successArgs);
    } else {
      pendingRec.cberr(args.errorType, args.errorValue);
    }
    // and return ther original args presented to the method back to the test
    // suite so it can validate if necessary.
    cb(pendingRec.methodArgs);
  }
  doit();
});

navigator.apps.services.registerHandler('test', 'finish', function(args, cb, cberr) {
  isFinished = true;
  if (pendingCalls.length) {
    cberr("test_suite_error", "finalized while pending calls are available")
  } else {
    cb();
  }
});

// The helper for all the "real" methods to wait for instructions from the
// test suite.
function waitForResumeInstructions(methodName, args, cb, cberr) {
  if (isFinished) {
    cberr("test_suite_error", "this app has been finalized");
    return;
  }
  if (methodName in pendingCalls) {
    cberr("test_suite_error", "already a pending call for '" + methodName + "'\n");
    return;
  }
  pendingCalls[methodName] = {methodArgs: args, cb: cb, cberr: cberr};
};


// The 'link.send' service used by F1 while under test.
navigator.apps.services.registerHandler('link.send', 'getParameters', function(args, cb, cberr) {
  waitForResumeInstructions('getParameters', args, cb, cberr);
});

navigator.apps.services.registerHandler('link.send', 'getLogin', function(args, cb, cberr) {
  waitForResumeInstructions('getLogin', args, cb, cberr);
});

navigator.apps.services.ready();
