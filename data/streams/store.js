// Storage for the activity stream.  This is focussed on the use-case of
// "given a URL, return the relevant ActivityStream items for it"
"use strict";

// The built-in console is not useful to us in content
var log = function() {
  dump("store.js: " + Array.prototype.join.call(arguments, ' ') + "\n");
};

var console = {
  log: log,
  info: log,
  warn: log,
  error: log,
  debug: log
};

var _db;

// Given a URL, return the origin
function getOrigin(url) {
  let a =  document.createElement('a');
  a.href = url;
  // remove all the other parts
  a.pathname = a.search = a.hash = "";
  return a.href;
}

// Turn the 'event' object in an onerror handler to an error object suitable
// for calling our error handlers with.
function errorEventToObject(event) {
  // can't find docs on this.
  return {code: "indexeddb", message: "an error occurred"};
}

// Open the DB, creating/updating the schema if necessary,
function getDB(cb, cberr) {
  if (_db) {
    cb(_db);
    return;
  }
  let request = mozIndexedDB.open("activitystream");
  console.log("opening DB");
  request.onerror = function(event) {
    cberr("failed to open the DB");
  };
  request.onsuccess = function(event) {
    console.log("onsuccess");
    let thisdb = event.target.result;
    console.log("opened DB with version", thisdb.version);
    if (thisdb.version != "0.1") {
      console.log("updating database version");
      let request = thisdb.setVersion("0.1");
      request.onerror = function(event) {
        cberr("failed to set the version");
      };
      request.onsuccess = function(event) {
        // Set up the database structure
        // The Activity items themselves, sans attachments.
        let itemStore = thisdb.createObjectStore("items", { keyPath: "id" });
        itemStore.createIndex("modified", "_modified", {unique: false});
        itemStore.createIndex("app", "_app", {unique: false});
        let attachmentStore = thisdb.createObjectStore("attachments", { keyPath: "_id" });
        attachmentStore.createIndex("url", "url", {unique: false});
        attachmentStore.createIndex("origin", "_origin", {unique: false});
        attachmentStore.createIndex("activityId", "_activityId", {unique: false});
        _db = thisdb;
        cb(_db);
      };
    } else {
      _db = thisdb;
      cb(_db);
    }
  }
};

function storeItems(info, cbdone, cberr) {
  try {
    _storeItems(info, cbdone, cberr);
  } catch (ex) {
    cberr({code: "runtime_error", message: ex.toString()});
  }
}

function _storeItems(info, cbdone, cberr)
{
  let app = info.app;
  let items = info.items;
  console.log("storing", items.length, "items");
  getDB(function(db) {
    let transaction = db.transaction(["items", "attachments"], IDBTransaction.READ_WRITE);
    transaction.oncomplete = function(event) {
      console.log("transaction complete");
      cbdone({ok: "sure is"});
    }
    transaction.onerror = function(event) {
      console.log("transaction error");
      cberr(errorEventToObject(event));
    }
    let itemStore = transaction.objectStore("items");
    let attachmentStore = transaction.objectStore("attachments");
    for each (let item in items) {
      if (!item.id && item.url) {
        item.id = item.url;
      }
      if (!item.id || !item.object || !item.object.attachments) {
        continue;
      }
      item._modified = item.published || item.updated;
      item._app = app;
      let attachments = item.object.attachments;
      // This seems insane, but without the parse/stringify dance, we wind up
      // with NS_ERROR_DOM_DATA_CLONE_ERR - the object can't be cloned.  The
      // same pattern is necessary below for the attachment itself.
      itemStore.put(JSON.parse(JSON.stringify(item)));
      for each (let attachment in attachments) {
        if (attachment.id) {
          // this should be globally unique.
          attachment._id = attachment.id;
        } else if (attachment.url) {
          // URL may not be unique, so use the item ID to make it so.
          attachment._id = item.id + "|" + attachment.url;
        } else {
          continue; // don't bother storing this one.
        }
        console.log("have mention of URL", attachment.url);
        attachment._activityId = item.id;
        if (attachment.url) {
          attachment._origin = getOrigin(attachment.url);
        }
        attachmentStore.put(JSON.parse(JSON.stringify(attachment)));
      }
    }
  });
};

function getActivityItems(args, cbresult, cberr) {
  try {
    _getActivityItems(args, cbresult, cberr);
  } catch (ex) {
    dump("getActivityItems failed: " + ex.toString() + " - " + ex.stack + "\n");
    cberr({code: "runtime_error", message: ex.toString()});
  }
}

function _getActivityItems(args, cbresult, cberr) {
  // TODO: errors!
  getDB(function(db) {
    let transaction = db.transaction(["items", "attachments"]);
    let request;
    let processValue;
    let itemIds = [];
    let allItems = [];
    if (args && args.url) {
      let attachmentStore = transaction.objectStore("attachments");
      let urlIndex = attachmentStore.index("url");
      request = urlIndex.openCursor(IDBKeyRange.only(args.url));
      processValue = function(cursor) {
        itemIds.push(cursor.value._activityId);
      }
    } else {
      // TODO: things like date range etc?
      // for now, we want all the items in reverse date order.
      let itemStore = transaction.objectStore("items");
      let index = itemStore.index("modified");
      request = index.openCursor(null, IDBCursor.PREV);
      processValue = function(cursor) {
        allItems.push(cursor.value);
      }
    }
    request.onsuccess = function(event) {
      function getNextItem(itemStore) {
        if (itemIds.length === 0) {
          // no more to fetch
          console.log("getActivityItems (indirectly) finished with", allItems.length);
          cbresult(allItems);
          return;
        }
        let itemId = itemIds.shift();
        let subrequest = itemStore.get(itemId);
        subrequest.onsuccess = function(event) {
          allItems.push(subrequest.result);
          getNextItem(itemStore);
        }
      }
      let cursor = event.target.result;
      if (cursor) {
        processValue(cursor);
        cursor.continue();
      } else {
        // no more matching entries - if we have any itemIds we get the items,
        // otherwise we are done.
        if (itemIds.length !== 0) {
          getNextItem(transaction.objectStore("items"));
        } else {
          console.log("getActivityItems finished with", allItems.length);
          cbresult(allItems);
          return;
        }
      }
    };
    request.onerror = function(event) {
      cberr(errorEventToObject(event));
    }
  });
}

function countItems(args, cbresult, cberr) {
  getDB(function(db) {
    let transaction = db.transaction(["items"]);
    let store = transaction.objectStore("items");
    let index = store.index(args.name);
    let request = index.openCursor(IDBKeyRange.only(args.value));
    let count = 0;
    request.onsuccess = function(event) {
      let cursor = event.target.result;
      if (cursor) {
        count++;
        cursor.continue();
      } else {
        cbresult({name: args.name, value: args.value, count: count});
      }
    }
  });
}
