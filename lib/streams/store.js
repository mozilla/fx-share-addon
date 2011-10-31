// Storage for the activity stream.  JUST A STUB and not well thought out :)
// Not only is it not thought out, it doesn't even use a DB - it is all
// in memory.  My raw-SQL foo failed me

// here is the "database" :)
let store = {}

exports.store = function(items, cbdone)
{
  for each(let item in items) {
    if (!item.object || !item.object.attachments) {
      continue;
    }
    for each (let attachment in item.object.attachments) {
      if (!attachment.url) {
        continue;
      }
      console.log("found url", attachment.url);
      url_entries = store[attachment.url] || {};
      url_entries[item.id] = {
        text: item.content,
        actor: item.actor
      }
      store[attachment.url] = url_entries;
    }
  }
  cbdone({ok: "sure is"});
};

exports.getMentionsOfUrl = function(url, cbresult) {
  // turn the map back into an array.
  let results = [];
  let items = store[url] || {};
  for each (let item in items) {
    results.push(item);
  }
  cbresult({results: results});
}
