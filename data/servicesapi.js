
var callid = 0;
unsafeWindow.navigator.wrappedJSObject.mozActivities.services.sendEmail = {
  call: function(svc, data, callback) {
    callid++;
    let resultName = "owa.service.sendEmail.call.result."+callid;
    self.port.once(resultName, function(result) {
      callback(result);
    });
    self.port.emit('owa.service.sendEmail.call', {
      svc: svc,
      data: data,
      result: resultName
    });
  }
};

unsafeWindow.navigator.wrappedJSObject.mozActivities.services.resolveEmailAddresses = {
  call: function(data, callback) {
    callid++;
    let resultName = "owa.service.resolveEmailAddresses.call.result."+callid;
    self.port.once(resultName, function(result) {
      callback(result);
    });
    self.port.emit('owa.service.resolveEmailAddresses.call', {
      data: data,
      result: resultName
    });
  }
};
