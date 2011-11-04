// This is a 'contentScript' companion for the mentions content.

unsafeWindow.fetchActivityItems = function(callback) {
  self.port.once("resultActivityItems", function(items) {
    callback(items);
  })
  self.port.emit("fetchActivityItems");
}
