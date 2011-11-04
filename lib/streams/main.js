const unload = require("unload");
const { Hotkey } = require("hotkeys");
const { Cc, Ci } = require('chrome');
const pageWorkers = require("page-worker");
const {serviceInvocationHandler, MediatorPanel} = require("openwebapps/services");

const serviceName = "activityStream.fetch";

var storageWorker;
var callId = 0;

function getBrowserWindow() {
  let wm = Cc['@mozilla.org/appshell/window-mediator;1'].
    getService(Ci.nsIWindowMediator);
  return wm.getMostRecentWindow('navigator:browser');
};

////////////////////////////////////////////////////////////////////////////////
// Privilege Granting

function makeURI(aURL, aOriginCharset, aBaseURI) {
  var ioService = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
  return ioService.newURI(aURL, aOriginCharset, aBaseURI);
}

// we totally need to perform this authorization step, otherwise things just
// hang while it tries to display a prompt that no one will ever see.
function authIndexedDBForUri(url) {
  // forcibly provide the indexedDB permission.
  let permMgr = Cc["@mozilla.org/permissionmanager;1"]
                  .getService(Ci.nsIPermissionManager);
  let uri = makeURI(url, null, null);
  permMgr.add(uri,
              "indexedDB",
              Ci.nsIPermissionManager.ALLOW_ACTION,
              Ci.nsIPermissionManager.EXPIRE_NEVER);
}


////////////////////////////////////////////////////////////////////////////////
// Storage abstractions

function getActivityItemsForUrl(url, cb, cberr) {
  let thisCallId = callId++;
  storageWorker.port.on(thisCallId, function(response) {
    if (response.error) {
      cberr(response.error);
    } else {
      cb(response.result);
    }
  });
  storageWorker.port.emit("getActivityItemsForUrl", {response: thisCallId, url: url});
}

function storeActivityItems(items, cb, cberr) {
  let thisCallId = callId++;
  storageWorker.port.on(thisCallId, function(response) {
    if (response.error) {
      cberr(response.error);
    } else {
      cb(response.result);
    }
  });
  storageWorker.port.emit("storeItems", {response: thisCallId, items: items});
};


// A little "demo" of using the stream.  Whenever a new window opens, we add
// a notification bar if anyone has commented on it.
require("tabs").on("ready", function(tab) {
  getActivityItemsForUrl(tab.url, function(mentions) {
    console.log("have", mentions.length, "mentions");
    if (mentions && mentions.length) {
      let nId = "social-browsing";
      let window = getBrowserWindow();
      let nBox = window.gBrowser.getNotificationBox();
      let notification = nBox.getNotificationWithValue(nId);
      if (!notification) {
        let message;
        if (mentions.length === 1) {
          message = "There is 1 comment";
        } else {
          message = "There are " + mentions.length + " comments";
        }
        message += " on this site from your social network";
        buttons = [{
          label: "view",
          accessKey: null,
          callback: function () {
            console.log("todo");
          }
        }];
        nBox.appendNotification(message, nId, null,
                    nBox.PRIORITY_WARNING_MEDIUM, buttons);
      }
    }
  });
});

// Our storage is managed by normal HTML content - load that content up as
// a page-worker.
function loadStorageContent() {
  let url = require("self").data.url("streams/store.html");
  authIndexedDBForUri(url);
  storageWorker = pageWorkers.Page({
    contentURL: url,
    contentScriptFile: require("self").data.url("streams/store-worker.js"),
    contentScriptWhen: "ready"
  });
}

// We function as an OpenWebApps "agent", allowing us to receive messages from
// our content.
function StreamsAgent(window, contentWindowRef, methodName, args, successCB, errorCB) {
  MediatorPanel.call(this, window, contentWindowRef, methodName, args, successCB, errorCB);
}

StreamsAgent.prototype = {
  __proto__: MediatorPanel.prototype,

  attachHandlers: function() {
    MediatorPanel.prototype.attachHandlers.apply(this);
    this.panel.port.on("fxas.consume", this.onConsume.bind(this));
  },
  onConsume: function(items) {
    // The ActivityStream items find there way to here, where we are able
    // to use mozStorage or other suitable trusted-only storage.
    storeActivityItems(items,
      function(result) {
        console.log("apparently the items were stored!");
      },
      function(error) {
        console.log("failed to store the items:", error);
      }
    );
  }
};


exports.main = function(options, callbacks) {
  console.log("streams/main loading");
  loadStorageContent();
  // setup a hotkey to invoke this mediator.
  var showHotKey = Hotkey({
    combo: "ctrl-alt-a",
    onPress: function() {
      let window = getBrowserWindow();
      let services = window.apps._services;
      services.registerMediator(serviceName, {
        url: require("self").data.url("ui/streams/index.html"),
        notificationErrorText: "There was a problem fetching this stream."
      });
      // and we also act as a trusted "agent" for the service.
      services.registerAgent(serviceName, StreamsAgent);

      let activity =     {
        action: serviceName,
        type: "get",
        data: {}
      };
      let contentWindow = window.gBrowser.contentWindow;
      let svc = services.get(contentWindow, activity, function() {
        console.log("stream get was success");
      }, function(err) {
        console.error("Failed to invoke activity-stream service", err);
      });
      svc.show();
    }
  });
};

unload.when(function(why) {
  ;
});
