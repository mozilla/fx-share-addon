const {Cc, Ci, Cm, Cu, components} = require("chrome");
const {getSharePanel, getTestUrl, createTab, removeCurrentTab, finalize} = require("./test_utils");
const windowUtils = require("window-utils");


// Return the "openwebapps" object.
exports.getOWA = function() {
  require("openwebapps/main"); // for the side effect of injecting window.apps.
  let repo = require("api").FFRepoImplService;
  let wm = Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(Ci.nsIWindowMediator);
  let window = wm.getMostRecentWindow("navigator:browser");
  return window.apps;
}

function getTestAppOptions(appRelPath) {
  // first find the URL of the app.
  let lastSlash = module.id.lastIndexOf("/");
  let manifest = module.id.substr(0, lastSlash+1) + appRelPath;
  let origin = manifest.substr(0, manifest.lastIndexOf("/")+1);

  return {
    url: manifest,
    origin: origin,
    skipPostInstallDashboard: true // don't want the app panel to appear.
  };
};

// Ensure one of our test apps is installed and ready to go.
exports.installTestApp = function(test, appPath, callback, errback) {
  let repo = exports.getOWA()._repo;
  let options = getTestAppOptions(appPath);
  options.onerror = function(errob) {
    if (errback) {
      errback(errob);
    } else {
      // no errback so they expect success!
      test.fail("failed to install the test app: " + errob.code + "/" + errob.message);
      test.done();
    }
  };
  options.onsuccess = function() {
      callback(options.origin);
  };
  repo.install('http://localhost:8420',
               options,
               undefined); // the window is only used if a prompt is shown.
};

// Uninstall our test app - by default (ie, with no errback passed), errors
// are "fatal".
exports.uninstallTestApp = function(test, appPath, callback, errback) {
  let repo = exports.getOWA()._repo;
  let options = getTestAppOptions(appPath);

  repo.uninstall(options.origin,
    function() { // success CB
      callback();
    },
    function(errob) { //errback
      if (errback) {
        errback(errob);
      } else {
        test.fail("failed to uninstall test app: " + errob.code + "/" + errob.message);
        test.done();
      }
    }
  );
};

// Ensure the test app is not installed.
exports.ensureNoTestApp = function(test, appPath, callback) {
  exports.uninstallTestApp(test, appPath,
                           function() {callback()}, function() {callback()});
}

// Helpers for working with our "test app".

// Install our test app, open a URL in a new tab, open the "share panel" for
// that tab, wait for the panel to become ready, find the test app's iframe
// etc, than callback with all that info.
// Automatically arranges for finalizers to be called to remove the app and
// remove the tab.
exports.getSharePanelWithApp = function(test, args, cb) {
  let appPath = args.appPath || "apps/basic/basic.webapp";
  let pageUrl = args.pageUrl || getTestUrl("page.html");
  let shareArgs = args.shareArgs;
  exports.installTestApp(test, appPath, function(appOrigin) {
    // ensure a teardown method to unregister it!
    finalize(test, function(finish) {
      exports.ensureNoTestApp(test, appPath, function() {
        finish();
      })
    });

    createTab(pageUrl, function(tab) {
      // a finalizer to destroy the tab.
      finalize(test, function(finish) {
        removeCurrentTab(function() {
          finish();
        })
      });

      let panel = getSharePanel(shareArgs);
      panel.panel.port.once("owa.mediation.ready", function() {
        // The mediator reported it is ready - now find the contentWindow for the mediator.
        // We can't get it via the panel, so we use our knowledge of the panel
        // implementation - it appended a XUL panel to the mainPopupSet.
        let lc = windowUtils.activeBrowserWindow.document.getElementById("mainPopupSet").lastChild;
        // and the first child of the XUL panel is the mediator's iframe.
        let iframe = lc.firstChild;
        // check it really is the mediator iframe
        test.assertEqual(iframe.contentWindow.location.href, require("self").data.url("ui/share/index.html"));
        // So get the actual window object for the mediator...
        let cw = iframe.contentWindow.wrappedJSObject;
        // but the mediator might not yet have got around to adding the service
        // iframes to itself - wait until that happens.
        test.waitUntil(function() {return cw.length}
        ).then(function() {
          // loop over the iframes looking for or test app skipping any other
          // link.send apps which may exist.
          for (let index=0; index < cw.length; index++) {
            if (cw[index].location.href.indexOf(appOrigin)===0) {
              // select the app just so we can see what is going on.
              let appFrame = cw[index];
              cw.$('.widgets-TabButton').eq(index).click();
              // and finally package up these bits to the test can use them.
              // Use a 'jq' prefix for the jquery objects.
              let appWidget = cw.$('#tabContent').children()[index]; // *sob* - why eq(index) doesn't work?
              let jqAppWidget = cw.$(appWidget); // for convenience - most tests want this.
              let result = {panel: panel,
                            panelContentWindow: cw,
                            jqPanelContentWindow: cw.$,
                            appFrame: appFrame,
                            appWidget: appWidget,
                            jqAppWidget: jqAppWidget
              };
              cb(result);
              return;
            }
          }
          test.fail("failed to find the app iframe");
        });
      });
      // kick the world off by showing the panel.
      panel.show();
    });
  });
}

/** Test a "sequence" of app calls.
The basic mechanism is this:

* Mediator loads app, app responds with the normal navigator.apps.services.ready()
* Mediator calls first method on the app (in our case, that will normally be
  link.send.getParameters)
* App "blocks" on this call - it doesn't call the callback - so the mediator
  itself is "blocked" waiting for the callback to happen - which means we
  can test initial state of the mediator while it is waiting for the response.
* Then the sequence replay starts, which does:
** Notify the app it should 'return' (ie, callback) from the currently
   "blocked" call with the specified args.
** Makes a callback to the test, passing the actual args the blocked method
   got when it was called (ie, so the test can verify what args where actually
   passed by the mediator)
** As the previous call is unblocked, the mediator will now make the next call
   into the app - this too "blocks" as described above.
** Repeat for all the items in the sequence.

So in effect, we are "stepping" through the calls to the app.  Note this is
actually performed recursively rather than iteratively so we arrange to not
unblock the next call until the test has finished examining the mediator state.

**/

// any exceptions in this replay process can cause confusion unless the error
// is logged.
exports.testAppSequence = function(test, appInfo, seq, cbdone) {
  try {
    _testAppSequence(test, appInfo, seq, cbdone);
  } catch (ex) {
    console.error("testAppSequence failed: " + ex + "\n" + ex.stack);
    test.fail("testAppSequence failed: " + ex);
    test.done();
  }
}

function _testAppSequence(test, appInfo, seq, cbdone) {
  let {appFrame} = appInfo;
  let invokeService = exports.getOWA()._services.invokeService;
  let item = seq.shift();
  let resumeArgs = {method: item.method, successArgs: item.successArgs,
                    errorType: item.errorType, errorValue: item.errorValue};
  // invoke our special "test.resume" method.
  // console.log("test is unblocking call to", item.method);
  invokeService(appFrame, "test", "resume", resumeArgs,
    function(result) {
      // The previously blocked call has returned.
      function cbresume() {
        if (seq.length === 0) {
          // out of items - tell the app we are done and to check itself.
          invokeService(appFrame, "test", "finish", {},
            function() {
              // call the final callback or just finish the test if not specified.
              if (cbdone) {
                try {
                  cbdone();
                } catch (ex) {
                  test.fail("error in test completion callback: " + ex + "\n" + ex.stack);
                  test.done();
                }
              } else {
                test.done();
              }
            },
            function(errob) {
              test.fail("app reported a completion error");
              test.done();
            }
          );
        } else {
          // and now the callback has returned we can play the next item in the
          // sequence.
          exports.testAppSequence(test, appInfo, seq, cbdone);
        }
      };
      if (item.callback) {
        // a callback is specified to perform some tests - it must call cbresume
        try {
          item.callback(cbresume, result);
        } catch (ex) {
          test.fail("error in sequence callback: " + ex + "\n" + ex.stack);
          test.done();
        }
      } else {
        // no callback for this sequence item, so resume immediately.
        cbresume();
      }
    },
    function(err_type, err_value) {
      // Our special "test.resume" method reported an error - this is bad and
      // means something probably went wrong with the test logic rather than
      // with the app itself.
      test.fail("resume callback error: " + err_type + "/" + err_value);
      test.done();
    }
  );
};
