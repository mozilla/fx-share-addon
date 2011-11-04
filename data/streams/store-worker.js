// This is the jetpack 'contentScript' which acts as a bridge between
// the addon and the 'html content' which manages the database.

self.port.on('storeItems', function(req) {
  unsafeWindow.storeItems(req.items,
    function(result) {
      self.port.emit(req.response, {result: result});
    },
    function(err) {
      self.port.emit(req.response, {error: err});
    }
  );
});

self.port.on('getActivityItemsForUrl', function(req) {
  unsafeWindow.getActivityItemsForUrl(req.url,
    function(result) {
      self.port.emit(req.response, {result: result});
    },
    function(err) {
      self.port.emit(req.response, {error: err});
    }
  );
});
