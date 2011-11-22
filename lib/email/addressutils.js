// Email address parsing, ported from Python's email._parseaddr module.

function AddrlistParser(field) {
  this.specials = '()<>@,:;.\\"[]'
  this.pos = 0
  this.LWS = ' \t'
  this.CR = '\r\n'
  this.FWS = this.LWS + this.CR
  this.atomends = this.specials + this.LWS + this.CR
  // Note that RFC 2822 now specifies `.' as obs-phrase, meaning that it
  // is obsolete syntax.  RFC 2822 requires that we recognize obsolete
  // syntax, so allow dots in phrases.
  this.phraseends = this.atomends.replace('.', '')
  this.field = field
  this.commentlist = []
};

AddrlistParser.prototype = {
  gotonext: function() {
    // Parse up to the start of the next address.
    while (this.pos < this.field.length) {
      if ((this.LWS + '\n\r').indexOf(this.field[this.pos]) >= 0) {
        this.pos += 1
      } else if (this.field[this.pos] == '(') {
        this.commentlist.push(this.getcomment())
      } else {
        break;
      }
    }
  },

  getaddrlist: function() {
    // Parse all addresses.
    // Returns a list containing all of the addresses.
    let result = [];
    while (this.pos < this.field.length) {
      let ad = this.getaddress();
      if (ad.length) {
        result = result.concat(ad);
      } else {
        result.push(['', '']);
      }
    }
    return result;
  },

  getaddress: function() {
    // Parse the next address.
    this.commentlist = [];
    this.gotonext();

    let oldpos = this.pos;
    let oldcl = this.commentlist;
    let plist = this.getphraselist();

    this.gotonext();
    let returnlist = [];

    if (this.pos >= this.field.length) {
      // Bad email address technically, no domain.
      if (plist.length) {
        // Python difference: Python does:
        // returnlist = [ [this.commentlist.join(" "), plist[0]]]
        returnlist = [ [this.commentlist.join(" "), plist.join(" ")]]
      }
    } else if ('.@'.indexOf(this.field[this.pos]) >= 0) {
      // email address is just an addrspec
      // this isn't very efficient since we start over
      this.pos = oldpos;
      this.commentlist = oldcl;
      let addrspec = this.getaddrspec();
      returnlist = [[this.commentlist.join(' '), addrspec]];
    } else if (this.field[this.pos] == ':') {
      // address is a group
      returnlist = []
      let fieldlen = this.field.length;
      this.pos += 1
      while (this.pos < this.field.length) {
        this.gotonext()
        if (this.pos < fieldlen && this.field[this.pos] == ';') {
          this.pos += 1;
          break;
        }
        returnlist = returnlist.concat(this.getaddress());
      }
    } else if (this.field[this.pos] == '<') {
      // Address is a phrase then a route addr
      let routeaddr = this.getrouteaddr();
      if (this.commentlist.length) {
        returnlist = [[plist.join(" ") + ' (' +
                        this.commentlist.join(" ") + ')', routeaddr]];
      } else {
        returnlist = [[plist.join(" "), routeaddr]];
      }
    } else {
      if (plist.length) {
        returnlist = [[this.commentlist.join(" "), plist[0]]];
      } else if (this.specials.indexOf(this.field[this.pos]) >= 0) {
        this.pos += 1;
      }
    }
    this.gotonext()
    if (this.pos < this.field.length && this.field[this.pos] == ',') {
      this.pos += 1;
    }
    return returnlist;
  },

  getrouteaddr: function() {
    // Parse a route address (Return-path value).
    // This method just skips all the route stuff and returns the addrspec.
    if (this.field[this.pos] != '<') {
      return null;
    }

    let expectroute = false;
    this.pos += 1;
    this.gotonext()
    let adlist = '';
    while (this.pos < this.field.length) {
      if (expectroute) {
        this.getdomain();
        expectroute = false;
      } else if (this.field[this.pos] == '>') {
        this.pos += 1;
        break;
      } else if (this.field[this.pos] == '@') {
        this.pos += 1;
        expectroute = true;
      } else if (this.field[this.pos] == ':') {
        this.pos += 1;
      } else {
        adlist = this.getaddrspec();
        this.pos += 1
        break;
      }
      this.gotonext()
    }
    return adlist;
  },

  getaddrspec: function() {
    // Parse an RFC 2822 addr-spec."""
    let aslist = [];
    this.gotonext()
    while (this.pos < this.field.length) {
      if (this.field[this.pos] == '.') {
        aslist.push('.');
        this.pos += 1;
      } else if (this.field[this.pos] == '"') {
        aslist.push('"' + this.getquote() + '"');
      } else if (this.atomends.indexOf(this.field[this.pos]) >= 0) {
          break
      } else {
        aslist.push(this.getatom());
      }
      this.gotonext();
    }

    if (this.pos >= this.field.length || this.field[this.pos] != '@') {
      return aslist.join('');
    }

    aslist.push('@')
    this.pos += 1
    this.gotonext()
    return aslist.join('') + this.getdomain();
  },

  getdomain: function() {
    // Get the complete domain name from an address."""
    let sdlist = [];
    while (this.pos < this.field.length) {
      if (this.LWS.indexOf(this.field[this.pos]) >= 0) {
        this.pos += 1
      } else if (this.field[this.pos] == '(') {
        this.commentlist.push(this.getcomment());
      } else if (this.field[this.pos] == '[') {
        sdlist.push(this.getdomainliteral());
      } else if (this.field[this.pos] == '.') {
        this.pos += 1;
        sdlist.push('.');
      } else if (this.atomends.indexOf(this.field[this.pos]) >= 0) {
        break
      } else {
        sdlist.push(this.getatom());
      }
    }
    return sdlist.join('');
  },

  getdelimited: function(beginchar, endchars, allowcomments) {
    /*  Parse a header fragment delimited by special characters.

        `beginchar' is the start character for the fragment.
        If this is not looking at an instance of `beginchar' then
        getdelimited returns the empty string.

        `endchars' is a sequence of allowable end-delimiting characters.
        Parsing stops when one of these is encountered.

        If `allowcomments' is non-zero, embedded RFC 2822 comments are allowed
        within the parsed fragment.
    */
    if (allowcomments === undefined) {
      allowcomments = true;
    }
    if (this.field[this.pos] != beginchar) {
      return '';
    }

    let slist = [''];
    let quote = false
    this.pos += 1;
    while (this.pos < this.field.length) {
      if (quote) {
        slist.push(this.field[this.pos]);
        quote = false;
      } else if (endchars.indexOf(this.field[this.pos]) >= 0) {
        this.pos += 1;
        break;
      } else if (allowcomments && this.field[this.pos] == '(') {
        slist.push(this.getcomment());
        continue;        // have already advanced pos from getcomment
      } else if (this.field[this.pos] == '\\') {
        quote = true;
      } else {
        slist.push(this.field[this.pos]);
      }
      this.pos += 1;
    }
    return slist.join('');
  },

  getquote: function() {
    // Get a quote-delimited fragment from this's field.
    return this.getdelimited('"', '"\r', false);
  },

  getcomment: function() {
    // Get a parenthesis-delimited fragment from this's field.
    return this.getdelimited('(', ')\r', true);
  },

  getdomainliteral: function() {
    // Parse an RFC 2822 domain-literal.
    return '[' + this.getdelimited('[', ']\r', false) + ']';
  },

  getatom: function(atomends /*=null*/) {
    /** Parse an RFC 2822 atom.

        Optional atomends specifies a different set of end token delimiters
        (the default is to use this.atomends).  This is used e.g. in
        getphraselist() since phrase endings must not include the `.' (which
        is legal in phrases).
    **/
    let atomlist = [''];
    if (!atomends) {
      atomends = this.atomends;
    }
    while (this.pos < this.field.length) {
      if (atomends.indexOf(this.field[this.pos]) >= 0) {
        break;
      } else {
        atomlist.push(this.field[this.pos]);
        this.pos += 1;
      }
    }
    return atomlist.join('');
  },

  getphraselist: function() {
    /** Parse a sequence of RFC 2822 phrases.

        A phrase is a sequence of words, which are in turn either RFC 2822
        atoms or quoted-strings.  Phrases are canonicalized by squeezing all
        runs of continuous whitespace into one space.
    **/
    let plist = [];

    while (this.pos < this.field.length) {
      if (this.FWS.indexOf(this.field[this.pos]) >= 0) {
        this.pos += 1;
      } else if (this.field[this.pos] == '"') {
        plist.push(this.getquote());
      } else if (this.field[this.pos] == '(') {
        this.commentlist.push(this.getcomment());
      } else if (this.phraseends.indexOf(this.field[this.pos]) >= 0) {
        break;
      } else {
        plist.push(this.getatom(this.phraseends));
      }
    }
    return plist
  }
};

exports.parseaddr = function(value) {
  let addrlist = new AddrlistParser(value).getaddrlist();
  if (addrlist.length == 0) {
    return ['', ''];
  }
  return addrlist[0];
}

exports.parseaddrlist = function(value) {
  let addrlist = new AddrlistParser(value).getaddrlist();
  return addrlist;
}

let specialsre = /[\\()<>@,:;".]/;
let escapes = [
  [/\\/g, "\\\\"],
  [/\(/g, "\\("],
  [/\)/g, "\\)"],
  [/"/g, '\\"']
];

exports.formataddr = function(pair) {
  /* The inverse of parseaddr(), this takes a 2-tuple of the form
    (realname, email_address) and returns the string value suitable
    for an RFC 2822 From, To or Cc header.

    If the first element of pair is false, then the second element is
    returned unmodified.
  */
  let name = pair[0];
  let address = pair[1];
  if (name.length === 0) {
    return address;
  }
  let quotes = ''
  if (specialsre.test(name)) {
    quotes = '"'
  }
  // python does this with the re.sub method.
  for (let i = 0; i < escapes.length; i++) {
    name = name.replace(escapes[i][0], escapes[i][1]);
  }
  return quotes + name + quotes + " <" + address + ">";
}
