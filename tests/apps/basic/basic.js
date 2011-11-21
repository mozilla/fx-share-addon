// A simple, testable web-app implementing the link share service.

// Most of the calls in this app "block" until told by the test framework to
// "resume" (where "block" means the callback isn't called).
// pendingCalls is calls made into the service where the 'result' of the call
// hasn't yet been specified by the test framework.
var pendingCalls = {};
var isFinished = false;

// A 'test' service used by the tests to control this app.
navigator.mozActivities.services.registerHandler('test', 'resume', function(activity, credentials) {
  // resume from a 'blocked' call.
  var args = activity.data;
  var attemptNum = 0;
  function doit() {
    if (isFinished) {
      activity.postException({code: "test_suite_error", message: "this app has been finalized"});
      return;
    }
    if (!(args.method in pendingCalls)) {
      // so the call hasn't yet been made to the app - sleep and retry later.
      if (++attemptNum > 100) {
        activity.postException({code: "test_error", message: "gave up waiting for a call to '" + args.method + "'"});
        return;
      }
      setTimeout(doit, 100);
      return;
    }
    var pendingRec = pendingCalls[args.method];
    delete pendingCalls[args.method];
  
    // make the pending callback with the args supplied by the test suite
    if (args.successArgs) {
      pendingRec.postResult(args.successArgs);
    } else {
      pendingRec.postException({code: args.errorType, message: args.errorValue});
    }
    // and return ther original args presented to the method back to the test
    // suite so it can validate if necessary.
    activity.postResult(pendingRec.data);
  }
  doit();
});

navigator.mozActivities.services.registerHandler('test', 'finish', function(activity, credentials) {
  isFinished = true;
  if (pendingCalls.length) {
    activity.postException({code:"test_suite_error", message:"finalized while pending calls are available"})
  } else {
    activity.postResult();
  }
});

// The helper for all the "real" methods to wait for instructions from the
// test suite.
function waitForResumeInstructions(methodName, activity, credentials) {
  if (isFinished) {
    activity.postException({code:"test_suite_error", message:"this app has been finalized"});
    return;
  }
  if (methodName in pendingCalls) {
    activity.postException({code:"test_suite_error", message:"already a pending call for '" + methodName + "'\n"});
    return;
  }
  pendingCalls[methodName] = activity;
};


// The 'link.send' service used by F1 while under test.
navigator.mozActivities.services.registerHandler('link.send', 'getParameters', function(activity, credentials) {
  waitForResumeInstructions('getParameters', activity, credentials);
});

navigator.mozActivities.services.registerHandler('link.send', 'getLogin', function(activity, credentials) {
  waitForResumeInstructions('getLogin', activity, credentials);
});

navigator.mozActivities.services.ready();
