// Mime utilities with an API stolen shamelessly from Python's email package.
// Would require lots of work to make it complete, but it is good enough for
// us (and for many different requirements)

const {base64Encode, base64Decode} = require("api-utils/utils/data")

function encode_utf8( s )
{
  return unescape( encodeURIComponent( s ) );
}

function decode_utf8( s )
{
  return decodeURIComponent( escape( s ) );
}

// Add quotes around a string.
function quote(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatParam(name, value) {
  return name + '="' + quote(value) + '"';
}

function Message() {
  this._headers = [];
}
exports.Message = Message

Message.prototype = {
  /* addHeader

    Normally the parameters will be added as key="value" unless
    value is null/undefined, in which case only the key will be added.

    eg:
      msg.addHeader('content-disposition', 'attachment', {filename: 'bud.gif'})
  */
  addHeader: function(name, value, params) {
    let parts = [];
    if (params) {
      for (let key in params) {
        let v = params[key];
        if (v==null) {
          parts.push(key)
        } else {
          parts.push(formatParam(key, v))
        }
      }
    }
    if (value != null) {
      parts.unshift(value);
    }
    this._headers.push([name, parts.join("; ")]);
  },

  // like addHeader but removes any existing headers with the same name.
  setHeader: function(name, value, params) {
    let newHeaders = [];
    for each (let [existingname, existingvalue] in this._headers) {
      if (name !== existingname) {
        newHeaders.push([existingname, existingvalue]);
      }
    }
    this._headers = newHeaders;
    this.addHeader(name, value, params);
  },

  attach: function(message) {
    if (!this._payload) {
      this._payload = [];
    }
    this._payload.push(message);
  },

  toString: function() {
    let bits = [];
    for each (let [name, value] in this._headers) {
      bits.push(name + ": " + value + "\r\n");
    }
    bits.push('\r\n'); // blank line after the headers.
    if (typeof this._payload === "string") {
      bits.push(this._payload + "\r\n");
    } else {
      // must be an array of parts
      bits.push('--' + this._boundary + "\r\n")
      for (let i=0; i<this._payload.length; i++) {
        let subpart = this._payload[i];
        bits.push(subpart.toString());
        bits.push('--' + this._boundary);
        if (i==this._payload.length-1) {
          bits.push("--");
        }
        bits.push("\r\n");
      }
      bits.push("\r\n");
    }
    return bits.join('');
  }
};

function MimeBase() {
  Message.call(this);
  this.addHeader('MIME-Version', '1.0')
}

MimeBase.prototype = {
  __proto__: Message.prototype
}


function MimeMultipart(subType) {
  this._boundary = "============xxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, function(c) { return (Math.random()*16|0).toString(10); });
  this.setHeader('Content-Type', "multipart/" + subType, {boundary: this._boundary})
  this._payload = [];
}
exports.MimeMultipart = MimeMultipart


MimeMultipart.prototype = {
  __proto__: MimeBase.prototype
}


function MimeText(text, subtype) {
  // test must be unicode, but there may be a case
  // to specify the input encoding...
  MimeBase.call(this)
  let ctype = "text/" + subtype;
  let charset, cte;

  let utf8_payload = encode_utf8(text);
  if (text === utf8_payload) {
    // just normal 7bit ascii.
    cte = "7bit"
    charset = "us-ascii";
    this._payload = text;
  } else {
    // 8bit - to be safe we encode it as base64
    cte = "base64";
    charset = "utf-8"
    this._payload = base64Encode(utf8_payload);
  }
  this.setHeader('Content-Transfer-Encoding', cte);
  this.setHeader('Content-Type', ctype, {charset: charset})
}

exports.MimeText = MimeText;

MimeText.prototype = {
  __proto__: MimeBase.prototype
}

// For already-encoded mime portions - eg, an image already in base64 format.
function MimeBinary(mainType, subType, data, encoding) {
  MimeBase.call(this);
  this.setHeader('Content-Type', mainType + "/" + subType); // no charset
  this.setHeader('Content-Transfer-Encoding', encoding);
  this._payload = data;
}
exports.MimeBinary = MimeBinary;

MimeBinary.prototype = {
  __proto__: MimeBase.prototype
}
