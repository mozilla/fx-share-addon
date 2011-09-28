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

  setPayload: function(payload, charset) {
    // This is the *input* charset.
    if (charset && charset != "utf-8")
      throw("only utf-8 is supported (got " + charset + ")");
    if (charset === "utf-8") {
      payload = decode_utf8(payload);
    }
    let utf8_payload = encode_utf8(payload);
    if (payload === utf8_payload) {
      // just normal 7bit ascii.
      this._payload = payload
      this.setHeader('Content-Transfer-Encoding', "7bit");
    } else {
      // 8bit - to be safe we encode it as base64
      this._payload = base64Encode(utf8_payload);
      this.setHeader('Content-Transfer-Encoding', "base64");
    }
},

  setCharset: function(charset) {
    this._charset = charset;
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
      bits.push('--' + this.boundary + "\r\n")
      for (let i=0; i<this._payload.length; i++) {
        let subpart = this._payload[i];
        bits.push(subpart.toString());
        bits.push('--' + this.boundary);
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

function MimeBase(mainType, subType, params) {
  Message.call(this);
  this.addHeader('MIME-Version', '1.0')
  let ctype = mainType + "/" + subType
  this.addHeader('Content-Type', ctype, params)
}

MimeBase.prototype = {
  __proto__: Message.prototype
}


function MimeMultipart(subType) {
  this.boundary = divider = "============xxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, function(c) { return (Math.random()*16|0).toString(10); });
  MimeBase.call(this, 'multipart', subType, {charset: 'utf-8', boundary: this.boundary});
  this._payload = [];
}
exports.MimeMultipart = MimeMultipart


MimeMultipart.prototype = {
  __proto__: MimeBase.prototype
}


function MimeText(text, subtype, charset) {
  charset = charset || 'utf-8';

  MimeBase.call(this, 'text', subtype, {charset: charset});
  this.setPayload(text);
}
exports.MimeText = MimeText;

MimeText.prototype = {
  __proto__: MimeBase.prototype
}

// For already-encoded mime portions - eg, an image already in base64 format.
function MimeEncoded(mainType, subType, data, encoding) {
  MimeBase.call(this, mainType, subType);
  this.setPayload(data);
  this.setHeader('Content-Transfer-Encoding', encoding);
}
exports.MimeEncoded = MimeEncoded;

MimeEncoded.prototype = {
  __proto__: MimeBase.prototype
}
