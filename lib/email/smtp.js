// from https://github.com/Mobisocial/socialbar/blob/master/chrome/content/email.js

const {Cc, Ci, Cu} = require("chrome");
const {Socket} = require("./socket");
const {setTimeout} = require("timer");

function encode_utf8( s )
{
  return unescape( encodeURIComponent( s ) );
}

function decode_utf8( s )
{
  return decodeURIComponent( escape( s ) );
}

const AppShellService = Cc["@mozilla.org/appshell/appShellService;1"].
  getService(Ci.nsIAppShellService);
const atob = AppShellService.hiddenDOMWindow.atob;
const btoa = AppShellService.hiddenDOMWindow.btoa;

function SslSmtpClient() {
    this.clearState();
};

exports.SslSmtpClient = SslSmtpClient;

SslSmtpClient.prototype.clearState = function() {
    this.smtpArgs = undefined;
    this.socket = undefined;
    this.on_login = undefined;
    this.on_bad_password = undefined;
    this.on_disconnect = undefined;
    this.commands = undefined;
    this.pending_command = undefined;
    this.response_data = undefined;
    this.current_reply = undefined;
    this.fully_connected = undefined;
    this.logging = undefined;
};


SslSmtpClient.prototype.connect = function(smtpArgs, on_login, on_bad_password, on_error, on_disconnect, logging) {
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
                on_error("Unable to contact server! Check you server settings.");
            }
        }, 15000);
    } catch(err) {
        on_error(err);
        return;
    }
    this.on_login = on_login;
    this.on_bad_password = on_bad_password;
    this.on_disconnect = on_disconnect;
    this.commands = []
    this.response_data = "";
    this.current_reply = [];
    this.pending_command = this.onAckConnect.bind(this);
};
SslSmtpClient.prototype.onAckConnect = function(reply) {
    this.fully_connected = true;
    this.sendCommand('EHLO localhost', this.onShake.bind(this));
};
SslSmtpClient.prototype.onShake = function(reply) {
    // alert("on shake");
    if (this.smtpArgs.connectionType === "starttls") {
        // must set the server to tls mode before logging in.
        this.sendCommand("STARTTLS", this.onStartTls.bind(this));
    } else {
        this.doAuth();
    }
};

SslSmtpClient.prototype.onStartTls = function(reply) {
    var code = reply[0].split(" ", 1);
    if(code == "220") {
        this.socket.starttls();
        this.doAuth();
    } else {
        //this.on_disconnect = undefined;
        // XXX - error callback?
        console.error("failed to set the server to tls mode:", reply);
        this.disconnect();
    }
};

SslSmtpClient.prototype.doAuth = function() {
    var u = encode_utf8(this.smtpArgs.username);
    var p = encode_utf8(this.smtpArgs.password);
    var auth = btoa("\0" + u + "\0" + p);
    this.sendCommand("AUTH PLAIN " + auth, this.onLogin.bind(this));
};

SslSmtpClient.prototype.sendMessage = function(to, subject, html, txt, on_success, on_error) {
    if(!this.fully_connected) {
        on_error("SMTP is not fully connected");
        return;
    }
    if(to.length < 1)
        throw "at least one destination email is required";
    var data = "";

    data += "MIME-Version: 1.0\r\n";
    data += "To:";
    for(var i = 0; i < to.length - 1; ++i) {
        data += " " + encode_utf8(to[i]) + ",";
    }
    data += " " + to[to.length - 1] + "\r\n";

    var from = encode_utf8(this.smtpArgs.senderName ?
                           this.smtpArgs.senderName + " <" + this.smtpArgs.email + ">" :
                           this.smtpArgs.email);
    data += "From: " + from + "\r\n";
    data += "Subject: " + encode_utf8(subject) + "\r\n";

    var divider = "------------xxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, function(c) { return (Math.random()*16|0).toString(10); });

    data += "Content-Type: multipart/alternative; boundary=\"" + divider + "\"\r\n";
    data += "\r\n";
    data += "This is a multi-part message in MIME format.\r\n";

    data += "--" + divider + "\r\n";
    ///////////
    data += "Content-Type: text/plain; charset=\"utf-8\"\r\n"
    data += "Content-Transfer-Encoding: 8bit\r\n";
    data += "\r\n";
    data += encode_utf8(txt.replace(/(^|[^\r])(?=\n)/g, function(c) { return c + "\r"; }));
    data += "\r\n";
    ///////////

    data += "--" + divider + "\r\n";
    ///////////
    data += "Content-Type: text/html; charset=\"utf-8\"\r\n"
    data += "Content-Transfer-Encoding: 8bit\r\n";
    data += "\r\n";
    data += encode_utf8(html.replace(/(^|[^\r])(?=\n)/g, function(c) { return c + "\r"; }));
    data += "\r\n";
    ///////////
    data += "--" + divider + "--\r\n";
    data += ".";

    var send_cmd = {"to":to.slice(0), "data":data, "success":on_success, "error":on_error};
    var client = this;
    client.sendCommand("MAIL FROM: <" + this.smtpArgs.email + "> BODY=8BITMIME", function(reply) {
        var code = reply[0].split(" ", 1);
        if(code != "250" && code != "354") {
            send_cmd["error"](reply.join("\n"));
            return;
        }
        if("to" in send_cmd && send_cmd["to"].length > 0) {
            //send recipients 1 by 1
            client.sendCommand("RCPT TO: <" + send_cmd.to.pop() + ">", arguments.callee, true);
        } else if("to" in send_cmd) {
            //then send the data message
            delete send_cmd["to"];
            client.sendCommand("DATA", arguments.callee, true);
        } else if("data" in send_cmd){
            //then send actual data
            var data = send_cmd["data"];
            delete send_cmd["data"];
            client.sendCommand(data, arguments.callee, true)
        } else {
            send_cmd["success"]();
        }
    });
};
SslSmtpClient.prototype.onLogin = function(reply) {
    var code = reply[0].split(" ", 1);
    if(code == "235") {
        this.on_login();
    } else {
        this.on_disconnect = undefined;
        this.on_bad_password(reply);
        this.disconnect();
    }
};
SslSmtpClient.prototype.sendCommand = function(command, on_response, continuation) {
    if(!continuation)
        this.commands.push({"command":command, "handler":on_response});
    else
        this.commands.unshift({"command":command, "handler":on_response});
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
        Cu.reportError("SMTP OUT @ " + new Date() + ":\n" + data_bit);
    this.socket.write(data_bit);
    this.pending_command = cmd["handler"];
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
        Cu.reportError("SMTP IN @ " + new Date() + ":\n" + data);
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
            try {
              this.pending_command(this.current_reply);
            } catch (ex) {
                console.error("exception in", this.pending_command.name, ": ", ex, "\n", ex.stack);
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
