// from https://github.com/Mobisocial/socialbar/blob/master/chrome/content/email.js

const {Cc, Ci, Cu} = require("chrome");
const {Socket} = require("./socket");
const {setTimeout} = require("timer");
const {base64Encode, base64Decode} = require("api-utils/utils/data")
const {OAuth} = require("oauthorizer/oauth");

function encode_utf8( s )
{
  return unescape( encodeURIComponent( s ) );
}

function decode_utf8( s )
{
  return decodeURIComponent( escape( s ) );
}

function SslSmtpClient(on_disconnect) {
    this.clearState();
    this.on_disconnect = on_disconnect;
};

exports.SslSmtpClient = SslSmtpClient;

SslSmtpClient.prototype.clearState = function() {
    this.smtpArgs = undefined;
    this.socket = undefined;
    this.on_disconnect = undefined;
    this.commands = undefined;
    this.pending_command = undefined;
    this.response_data = undefined;
    this.current_reply = undefined;
    this.fully_connected = undefined;
    this.logging = undefined;
};


SslSmtpClient.prototype.connect = function(smtpArgs, cb, cberr, logging) {
    if(this.socket)
        throw "already connected";
    this.clearState();
    if (!smtpArgs.username) {
        smtpArgs.username = smtpArgs.email.split('@', 1)[0];
    }
    this.smtpArgs = smtpArgs;
    this.logging = logging;

    this.socket = new Socket();
    try {
        this.socket.open(smtpArgs.server, smtpArgs.port, smtpArgs.connectionType, this.onConnect.bind(this));
        var client = this;
        setTimeout(function() {
            if(!client.fully_connected) {
                client.on_disconnect = undefined;
                client.disconnect();
                cberr({type: 'timeout', message: "Unable to contact server! Check you server settings."});
            }
        }, 15000);
    } catch(err) {
        cberr({code: 'runtime_error', message: err.toString()});
        return;
    }
    this.commands = []
    this.response_data = "";
    this.current_reply = [];
    this.pending_command = {handler: this.onAckConnect, args:[cb, cberr]};
};

SslSmtpClient.prototype.onAckConnect = function(reply, cb, cberr) {
    this.fully_connected = true;
    this.sendCommand('EHLO localhost', this.onShake, [cb, cberr]);
};
SslSmtpClient.prototype.onShake = function(reply, cb, cberr) {
    // alert("on shake");
    if (this.smtpArgs.connectionType === "starttls") {
        // must set the server to tls mode before logging in.
        this.sendCommand("STARTTLS", this.onStartTls, [cb, cberr]);
    } else {
        cb(reply);
    }
};

SslSmtpClient.prototype.onStartTls = function(reply, cb, cberr) {
    var code = reply[0].split(" ", 1);
    if(code == "220") {
        this.socket.starttls();
        // after STARTTLS we resend EHLO, after which we can check the
        // security status of the connection.
        function onEhlo(reply) {
            if (!this.socket.isConnectionSecure()) {
                cberr({type: "security_error",
                      message: "Could not establish a secure connection."}
                )
                return;
            }
            // we have a secure connection, so off we go!
            cb(reply);
        }
        this.sendCommand('EHLO localhost', onEhlo);
    } else {
        //this.on_disconnect = undefined;
        // XXX - error callback?
        cberr({type: 'server_error', reply: reply});
    }
};

SslSmtpClient.prototype.build_xauth_string = function(xoauth) {
    let accessor = {
      consumerSecret: xoauth.consumerSecret,
      consumerKey: xoauth.consumerKey,
      tokenSecret: xoauth.tokenSecret,
      token: xoauth.token
    };
    let action = xoauth.serviceProvider.emailUrl.replace('%s', this.smtpArgs.email);
    let message = {method: 'GET', parameters: {
            'oauth_signature_method': xoauth.serviceProvider.signatureMethod,
            'oauth_token': xoauth.token
      }, action: action};
    OAuth.completeRequest(message, accessor);

    // much like OAuth.getAuthorizationHeader except that does the realm etc.
    let data = [];
    let list = OAuth.getParameterList(message.parameters);
    list.sort();
    for (var p = 0; p < list.length; ++p) {
      let value = list[p][1];
      if (value == null) value = "";
      data.push(OAuth.percentEncode(list[p][0]) + '="' + OAuth.percentEncode(value) + '"');
    }
    return "GET " + action + " " + data.join(",");
}

SslSmtpClient.prototype.authenticate = function(args, cb, cberr) {
    let type, auth, xoauth;
    if ('xoauth' in args && args.xoauth) {
        // We expect xoauth to hold the already escaped string with all the
        // oauth magic necessary - we just base64 encode it and pass it on.
        xoauth = this.build_xauth_string(args.xoauth)
        auth = base64Encode(xoauth);
        type = "XOAUTH"
    } else if ('plain' in args) {
        type = "PLAIN"
        var u = encode_utf8(args.plain.username);
        var p = encode_utf8(args.plain.password);
        var auth = base64Encode("\0" + u + "\0" + p);
    } else {
        cberr({type: 'value_error', message: 'no supported authentication method'});
    }
    this.sendCommand("AUTH " + type + " " + auth, this.onLogin, [cb, cberr]);
};

SslSmtpClient.prototype.sendMessage = function(to, payload, on_success, on_error) {
    if(!this.fully_connected) {
        on_error({type: 'state_error', message: "SMTP is not fully connected"});
        return;
    }
    if(to.length < 1)
        on_error({type: 'value_error', message: "at least one destination email is required"});
    var data = payload + ".";
    var send_cmd = {"to":to.slice(0), "data":data, "success":on_success, "error":on_error};
    var client = this;
    client.sendCommand("MAIL FROM: <" + encode_utf8(this.smtpArgs.email) + "> BODY=8BITMIME", function(reply) {
        var code = reply[0].split(" ", 1);
        if(code != "250" && code != "354") {
            send_cmd["error"]({type: 'server_error', reply: reply.join("\n")});
            return;
        }
        if("to" in send_cmd && send_cmd["to"].length > 0) {
            //send recipients 1 by 1
            client.sendCommand("RCPT TO: <" + encode_utf8(send_cmd.to.pop()) + ">", arguments.callee, [], true);
        } else if("to" in send_cmd) {
            //then send the data message
            delete send_cmd["to"];
            client.sendCommand("DATA", arguments.callee, [], true);
        } else if("data" in send_cmd){
            //then send actual data
            var data = send_cmd["data"];
            delete send_cmd["data"];
            client.sendCommand(data, arguments.callee, [], true)
        } else {
            send_cmd["success"](reply); // XXX - correct reply?
        }
    });
};
SslSmtpClient.prototype.onLogin = function(reply, cb, cberr) {
    var code = reply[0].split(" ", 1);
    if(code == "235") {
        cb(reply);
    } else {
        cberr({type: 'server_error', reply: reply});
    }
};

SslSmtpClient.prototype.sendCommand = function(command, on_response, extra_args, continuation) {
    if(!continuation)
        this.commands.push({"command":command, "handler":on_response, "args": extra_args});
    else
        this.commands.unshift({"command":command, "handler":on_response, "args": extra_args});
    this.internalNextCommand();
};
SslSmtpClient.prototype.internalNextCommand = function() {
    if(this.pending_command)
        return;
    if(this.commands.length == 0)
        return;
    var cmd = this.commands.shift();
    var data_bit = cmd["command"] + "\r\n";
    if(this.logging)
        console.log("SMTP OUT @ " + new Date() + ":\n" + data_bit);
    this.socket.write(data_bit);
    this.pending_command = cmd;
};
SslSmtpClient.prototype.disconnect = function() {
    if(this.socket == undefined)
        return;
    this.socket.close();
    this.socket = undefined;
};
SslSmtpClient.prototype.onConnect = function() {
    // alert('connected');
    var client = this;
    var socket_cbs = {
        "streamStarted": function (socketContext){
            //do nothing, this just means data came in... we'll
            //get it via the receiveData callback
        },
        "streamStopped": function (socketContext, status, msg){
            client.onDisconnect();
        },
        "receiveData":   function (data){
            client.onData(data);
        }
    };
    this.socket.async(socket_cbs);
    this.internalNextCommand();
};
SslSmtpClient.prototype.onDisconnect = function() {
    if(this.socket) {
        this.socket.close();
        this.socket = undefined;
    }
    if(this.on_disconnect)
        this.on_disconnect();
};
SslSmtpClient.prototype.onData = function(data) {
    if(this.logging)
        console.log("SMTP IN @ " + new Date() + ":\n" + data);
    this.response_data += data;
    for(;;) {
        var ofs = this.response_data.indexOf('\n');
        //not complete
        if(ofs == -1) {
            // alert("bailing\n" + this.response_data);
            return;
        }
        //TODO: handle gibbrish respone (not a 3 dig number with a space or - after it)
        var reply = this.response_data.slice(0, ofs - 1);
        this.response_data = this.response_data.slice(ofs + 1);
        this.current_reply.push(reply);
        // alert("adding\n" + reply);
        if(reply[3] == "-")
            continue;
        // alert("issuing\n" + this.current_reply);
        if(this.pending_command) {
            let handler = this.pending_command.handler;
            let args = [this.current_reply];
            if (this.pending_command.args) {
                args = args.concat(this.pending_command.args);
            }
            try {
              handler.apply(this, args);
            } catch (ex) {
                console.error("exception in", handler.name, ": ", ex, "\n", ex.stack);
                throw(ex);
            }
        }else {
            var code = this.current_reply[0].split(" ", 1)[0];
            if(code == "451" || code == "421") {
                this.disconnect();
                //SMTP timeout, just pass on the disconnect message
            } else {
                console.error("unexpected reply from smtp server: " + this.current_reply);
            }
        }
        this.current_reply = []
        this.pending_command = undefined;
        this.internalNextCommand();
    }
};
