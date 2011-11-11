const unload = require("unload");
const { Hotkey } = require("hotkeys");
const { Cc, Ci, Cu } = require('chrome');
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
// History/Places interfaces
function getVisits(args, cb) {
  // Note - there was an attempt to use MozStorage directly, hence the async
  // callback.  This is now using synch apis, but the async callback remains.
  let ioService = Cc["@mozilla.org/network/io-service;1"]
                   .getService(Ci.nsIIOService);
  let faviconService = Cc["@mozilla.org/browser/favicon-service;1"]
                        .getService(Ci.nsIFaviconService);
  let historyService = Cc["@mozilla.org/browser/nav-history-service;1"]
                        .getService(Ci.nsINavHistoryService);
  let query = historyService.getNewQuery();
  let options = historyService.getNewQueryOptions();
  options.sortingMode = options.SORT_BY_DATE_DESCENDING;
  options.maxResults = 100; // should probably come from args!

  // execute the query
  let result = historyService.executeQuery(query, options);

  // iterate over the results
  result.root.containerOpen = true;
  let count = result.root.childCount;
  let results = []
  for (let i = 0; i < count; i++) {
    var node = result.root.getChild(i);
    // *sob* - can't workout how to use the faviconService to convert the
    // strange 'moz-anno:favicon:blah' value of node.icon to something we
    // can use - so just use the service directly on the URL.
    let item = {
      url: node.uri,
      displayName: node.title,
      updated: new Date(node.time/1000).toISOString(),
      verb: "visit"
    }
    try {
      item.image = faviconService.getFaviconForPage(ioService.newURI(node.uri, null, null)).spec;
    } catch (ex) {
      ; // no problem
    }
    results.push(item);
  }
  result.root.containerOpen = false;
  // see comments above - this is simulated async just incase we later move
  // to true async
  cb(results);
}

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

function getActivityItems(args, cb, cberr) {
  let thisCallId = callId++;
  storageWorker.port.on(thisCallId, function(response) {
    if (response.error) {
      if (cberr) {
        cberr(response.error);
      } else {
        console.log("Failed to fetch items and no error callback provided:", JSON.stringify(response.error));
      }
    } else {
      cb(response.result);
    }
  });
  storageWorker.port.emit("getActivityItems", {response: thisCallId, args: args});
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

function countActivityItems(name, value, cb, cberr) {
  let thisCallId = callId++;
  storageWorker.port.on(thisCallId, function(response) {
    if (response.error) {
      cberr(response.error);
    } else {
      cb(response.result);
    }
  });
  storageWorker.port.emit("countItems", {response: thisCallId, name: name, value: value});
};

function maybeNotifyMentions(url) {
  getActivityItems({url: url}, function(mentions) {
    console.log("have", mentions.length, "mentions for", url);
    let nId = "social-browsing";
    let window = getBrowserWindow();
    if (!window) {
      // probably shutting down.
      return;
    }
    let nBox = window.gBrowser.getNotificationBox();
    let notification = nBox.getNotificationWithValue(nId);
    if (mentions && mentions.length) {
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
            let contentPath = require("self").data.url("ui/streams");
            let panel = require("addon-kit/panel").Panel({
              contentURL: contentPath + "/mentions.html",
              contentScriptFile: contentPath + "/mentions-worker.js",
              contentScriptWhen: "start"
            });
            panel.port.on("fetchActivityItems", function() {
              panel.port.emit("resultActivityItems", mentions);
            })
            let anchor = getBrowserWindow().document.getElementById('identity-box');
            panel.show(anchor);
          }
        }];
        nBox.appendNotification(message, nId, null,
                    nBox.PRIORITY_WARNING_MEDIUM, buttons);
      }
    } else {
      if (notification) {
        nBox.removeNotification(notification);
      }
    }
  });
};

// A little "demo" of using the stream.  Whenever a new window opens, we add
// a notification bar if anyone has commented on it.
let tabsModule = require("tabs");
tabsModule.on("ready", function(tab) {
  maybeNotifyMentions(tab.url);
});
tabsModule.on("activate", function(tab) {
  maybeNotifyMentions(tab.url);
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
function StreamsAgent(window, methodName) {
  MediatorPanel.call(this, window, methodName);
}

StreamsAgent.prototype = {
  __proto__: MediatorPanel.prototype,

  attachHandlers: function() {
    MediatorPanel.prototype.attachHandlers.apply(this);
    this.panel.port.on("fxas.consume", this.onConsume.bind(this));
    this.panel.port.on("fxas.count", this.onCount.bind(this));
    this.panel.port.on("fxas.result", this.onResult.bind(this));
  },
  onConsume: function(info) {
    // The ActivityStream items find there way to here, where we are able
    // to use mozStorage or other suitable trusted-only storage.
    storeActivityItems(info,
      function(result) {
        console.log("apparently the items were stored!");
        this.panel.port.emit('fxas.consume.result', {result: "ok", app: info.app});
      }.bind(this),
      function(error) {
        console.log("failed to store the items:", JSON.stringify(error));
      }
    );
  },
  onCount: function(req) {
    // The ActivityStream items find there way to here, where we are able
    // to use mozStorage or other suitable trusted-only storage.
    console.log("starting count");
    countActivityItems(req.name, req.value,
      function(result) {
        this.panel.port.emit('fxas.count.result', result);
      }.bind(this),
      function(error) {
        console.log("failed to count the items:", JSON.stringify(error));
      }
    );
  },
  onResult: function(args) {
    getActivityItems(args,
      function(items) {
        console.log("have", items.length, "activitystream items");
        getVisits(args, function(visits) {
          console.log("have", visits.length, "visits");
          // simulate an emit of owa.success (as only the page worker can do
          // the real emit.)
          this.onOWASuccess({activitystream: items, visits: visits});
        }.bind(this));
      }.bind(this),
      function(err) {
        console.log("eeek - failed to fetch the items", JSON.stringify(err));
        this.panel.port.emit('owa.failure', err);
      }.bind(this)
    );
  }

};


exports.main = function(options, callbacks) {
  console.log("streams/main loading");
  loadStorageContent();
  let window = getBrowserWindow();
  let services = window.apps._services;
  services.registerMediator(serviceName, {
    url: require("self").data.url("ui/streams/index.html"),
    notificationErrorText: "There was a problem fetching this stream."
  });
  // and we also act as a trusted "agent" for the service.
  services.registerAgent(serviceName, StreamsAgent);

  // setup a hotkey to invoke this mediator.
  var showHotKey = Hotkey({
    combo: "ctrl-alt-a",
    onPress: function() {
      let activity =     {
        action: serviceName,
        type: "get",
        data: {}
      };
      let svc = services.get(activity, function() {
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
