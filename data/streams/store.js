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
      console.log("setting versuin");
      let request = thisdb.setVersion("0.1");
      request.onerror = function(event) {
        cberr("failed to set the version");
      };
      request.onsuccess = function(event) {
        // Set up the database structure
        // The Activity items themselves, sans attachments.
        let itemStore = thisdb.createObjectStore("items", { keyPath: "id" });
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

function storeItems(items, cbdone, cberr) {
  try {
    _storeItems(items, cbdone, cberr);
  } catch (ex) {
    cberr({code: "runtime_error", message: ex.toString()});
  }
}

function _storeItems(items, cbdone, cberr)
{
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
      let attachments = item.object.attachments;
      delete item.object.attachments;
      // This seems insane, but without the parse/stringify dance, we wind up
      // with NS_ERROR_DOM_DATA_CLONE_ERR - the object can't be cloned.  I
      // originally guessed this was to do with the delete of .attachments,
      // but the same pattern is necessary below for the attachment itself.
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

function getActivityItemsForUrl(url, cbresult, cberr) {
  try {
    _getActivityItemsForUrl(url, cbresult, cberr);
  } catch (ex) {
    cberr({code: "runtime_error", message: ex.toString()});
  }
}

function _getActivityItemsForUrl(url, cbresult, cberr) {
  // TODO: errors!
  getDB(function(db) {
    let transaction = db.transaction(["items", "attachments"]);
    let attachmentStore = transaction.objectStore("attachments");
    let urlIndex = attachmentStore.index("url");
    let itemIds = [];
    let request = urlIndex.openCursor(IDBKeyRange.only(url));
    let allItems = [];
    request.onsuccess = function(event) {
      function getNextItem(itemStore) {
        if (itemIds.length === 0) {
          // no more to fetch
          console.log("getActivityItemsForUrl finished with", allItems.length);
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
        itemIds.push(cursor.value._activityId);
        cursor.continue();
      } else {
        // no more matching entries - get the items.
        getNextItem(transaction.objectStore("items"));
      }
    };
    request.onerror = function(event) {
      cberr(errorEventToObject(event));
    }
  });
}
