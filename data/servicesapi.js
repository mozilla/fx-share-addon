
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

unsafeWindow.navigator.wrappedJSObject.mozActivities.services.formatEmailAddresses = {
  call: function(data, callback) {
    callid++;
    let resultName = "owa.service.formatEmailAddresses.call.result."+callid;
    self.port.once(resultName, function(result) {
      callback(result);
    });
    self.port.emit('owa.service.formatEmailAddresses.call', {
      data: data,
      result: resultName
    });
  }
};

// the service is making an oauth call, setup a result callback mechanism then make the call.
// the service will already have oauth credentials from an early login process initiated by
// our mediator
unsafeWindow.navigator.wrappedJSObject.mozActivities.services.oauth = {
  call: function(svc, data, callback) {
    callid++;
    self.port.once("owa.service.oauth.call.result."+callid, function(result) {
      callback(result);
    });
    self.port.emit('owa.service.oauth.call', {
      svc: svc,
      data: data,
      result: "owa.service.oauth.call.result."+callid
    });
  }
};
