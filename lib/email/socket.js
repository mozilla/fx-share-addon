// from https://github.com/Mobisocial/socialbar/blob/master/chrome/content/socket.js
const {Cc, Ci, components: { classesByID } } = require("chrome");

// from mozilla jslib with a few tweaks
function Socket ()
{
  if (arguments.length)
    this.init(arguments[0]);
  else
    this.init();
}

exports.Socket = Socket;

/**
 *  function: available
 *  purpose:  number of bytes waiting to be read
 *
 *  interface: available()
 *
 *   returns: integer : number of bytes waiting to be read
 */
Socket.prototype.available = function ()
{
  if (!this.isAlive())
      return 0;

  var bytesAvailable = 0;
  try {
      bytesAvailable = this._inputInterface.available();
  } catch(exception) {
      this.isConnected = false;
      this._exception = exception;
  }

  return bytesAvailable;
}

/**
 *  function:  close
 *  purpose:  closes the socket connection
 *  interface: close()
 *
 *  returns: nothing.
 */
Socket.prototype.close = function ()
{
  if (!this.isOpen()) return;

  this.isOpenFlag = false;
  this.isConnected = false;
  this._connect_cb = function() {}

  // calls to _inputStream.close() and _outputStream.close() didn't
  // function.
  if(this._transport)
    this._transport.close(0);
}

/**
 *  function:  init
 *  purpose:   provides initialization for the Socket class.
 *  interface: socket([classID])
 *  arguments: classID : classesByID class-identifier (see Socket for info)
 *  returns:   nothing.
*/
Socket.prototype.init = function ()
{
  this.isOpenFlag = false;
  this.isConnected = false;
  this._connect_cb = function() {}

  this.openInputFlags = 0;
  this.openInputSegmentSize = 0;
  this.openInputSegmentCount = 0;

  this.openOutputFlags = 0;
  this.openOutputSegmentSize = 0;
  this.openOutputSegmentCount = 0;

  var defaultContractID = "@mozilla.org/network/socket-transport-service;1";
  // var defaultClassID = "{c07e81e0-ef12-11d2-92b6-00105a1b0d64}"

  var socketServiceClass;
  switch (arguments.length)
  {
    case 0:
      socketServiceClass = Cc[defaultContractID];
      break;

    case 1:
      socketServiceClass = classesByID[arguments[0]];
      break;

    default:
      throw( "Socket.init: unexpected arguments" );
      break;
  }

  if (!socketServiceClass)
    throw ("Socket constructor: Couldn't get socket service class.");

  var socketService = socketServiceClass.getService();

  if (!socketService)
      throw ("Socket constructor: Couldn't get socket service.");

  this._socketService = socketService.QueryInterface(Ci.nsISocketTransportService);
}

/**
 *  function: isAlive
 *  purpose:  tests the connection to see if it still works.
 *  interface: isAlive()
 *  arguments: none.
 *  returns: boolean : true if the connection still works.
 *
 *  Note:
 *    This function is not accurate if invoked in the same javascript
 *    stack crawl as open().
 */
Socket.prototype.isAlive = function ()
{
    this.isConnected = ( this.isOpen() ? this._transport.isAlive() : false );

    return this.isConnected;
}

/**
 *  function: isOpen
 *  purpose:  returns true if the socket has been opened (which is
 *            different from connect).  Multiple invocations of open will
 *            fail if each old connection is not closed first.
 *  interface: isOpen()
 *  arguments: none.
 *  returns: boolean : true if open() has been invoked without close.
 */
Socket.prototype.isOpen = function () { return this.isOpenFlag; }

/**
 *  function: open
 *  purpose:  opens the socket
 *  interface:  open( host, port [ binary ] )
 *
 *  arguments: host : String, host to connect to
 *             port : int, port number to use
 *             binary : optional, use binary input support, defaults false
 *
 *  returns: nothing.
 */
Socket.prototype.open = function (host, port, type, on_connect)
{
  if (this.isOpen()) return;
  if(type == undefined)
     type = null;
  if(typeof type == "string")
    type = [type];

  this.host = host.toLowerCase();
  this.port = port;
  this.binary = (arguments.length > 2) ? arguments[ 2 ] : false;
  this.isOpenFlag = true;

  // in theory, we'd look up proxy information here.  but we're being
  // a bare socket so....

  // create the transport:
  // socketTypes = null
  // typeCount = 0
  // host
  // port
  // proxy-info = null
  this._transport = this._socketService.createTransport(type, type == null ? 0 : type.length, 
                                                        host, port, null);
  if (!this._transport)
    throw ("Socket.open: Error opening transport.");

  var tm = Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager);
  if(on_connect)
    this._connect_cb = on_connect;
  this._transport.setEventSink(this, tm.mainThread);

  var openFlags = (this.blocking ) && ( typeof document == "object")
      ? 0
      : Ci.nsITransport.OPEN_BLOCKING;

  this._inputStream = this._transport.openInputStream(
                        this.openInputFlags,
                        this.openInputSegmentSize,
                        this.openInputSegmentCount);

  if (!this._inputStream)
    throw ("Socket.open: Error getting input stream.");

  if (this.binary)
    this._inputInterface = this.toBinaryInputStream( this._inputStream );
  else
    this._inputInterface = this.toScriptableInputStream( this._inputStream );

  this._outputStream = this._transport.openOutputStream(
          this.openOutputFlags,
          this.openOutputSegmentSize,
          this.openOutputSegmentCount);
  if (!this._outputStream)
    throw ("Socket.open: Error getting output stream.");

  // We really should call _transport.isAlive (?) but that is never reliable
  // (either always false or always true).
  // Experimentation shows that calls to available() or isAlive() will not
  // catch any problems with the connection until the javascript call
  // stack has completely unwound.
  this.isConnected = true;
}

Socket.prototype.starttls = function () {
  let strans = this._transport.QueryInterface(Ci.nsISocketTransport);
  let secInfo = strans.securityInfo;
  let sslControl = secInfo.QueryInterface(Ci.nsISSLSocketControl);
  sslControl.StartTLS();
}

/**
 *  function: read
 *  purpose: reads data from a socket.
 *
 *  interface: read(bytes)
 *
 *  arguments: bytes : integer, number of bytes to read in
 *
 *  returns: string
 *
 *  Note:
 *    will only return the smaller of specified vs available bytes.
 *
 */
Socket.prototype.read = function (bytes)
{
  if (!this.isAlive())
    throw "Socket.read: Not Connected.";

  var rv = new String;

  if (bytes == 0)
    return rv;

  var availableBytes = this.available();

  if (availableBytes == 0)
    return rv;

  bytes = Math.min(availableBytes, bytes);

  if (bytes) {
    if (this.binary)
      // despite the documentation, this call works
      rv = this._inputInterface.readBytes( bytes );
    else
      rv = this._inputInterface.read( bytes );
  }

    return rv;
}

/**
 *  function: write
 *  purpose: writes the given string to the socket.
 *
 *  interface: write(str)
 *
 *  arguments: str : string to be written.
 *
 *  returns: integer : number of bytes written.
 */
Socket.prototype.write = function (str)
{
  if (!this.isAlive())
    throw "Socket.write: Not Connected.";

  var rv = 0;
  try {
    rv = this._outputStream.write(str, str.length);
  } catch (e) { this.isConnected = false; }

  return rv;
}

/*
 *  function:  toBinaryInputStream
 *  purpose: creates an nsIBinaryInputStream wrapper around the given
 *  inputStream.
 *
 *  interface: toBinaryInputStream(inputStream)
 *
 *  arguments: inputStream : result of openInputStream
 *
 *  returns: nsIBinaryInputStream
 */
Socket.prototype.toBinaryInputStream = function (inputStream)
{
  var rv =   Cc["@mozilla.org/binaryinputstream;1"]
                                 .getService(Ci.nsIBinaryInputStream);
  rv.setInputStream(inputStream);

  return rv;
}

/**
 *  function: toScriptableInputStream
 *  purpose: creates an nsIScriptableInputStream wrapper around the given
 *           inputStream.
 *
 *  interface: toScriptableInputStream( inputStream )
 *
 *  arguments: inputStream : result of openInputStream
 *
 *  returns: nsIScriptableInputStream
 */
Socket.prototype.toScriptableInputStream = function (inputStream)
{
  var rv =   Cc["@mozilla.org/scriptableinputstream;1"]
                                   .getService(Ci.nsIScriptableInputStream);
  rv.init( inputStream );

  return rv;
}

Socket.prototype.onTransportStatus =
function(aTransport, aStatus, aProgress, aProgressMax)
{
  //console.log("transport status", aStatus);
  if(aStatus == Ci.nsISocketTransport.STATUS_CONNECTED_TO)
    this._connect_cb();
}


/**
 *  function: async
 *  purpose:
 *  interface:
 *
 *  returns:
 *  usage:
 *
 *  var aSocket = new Socket;
 *  var observer = {
 *    streamStarted: function (socketContext){ },           //onstart action
 *    streamStopped: function (socketContext, status){ },   //onstop action
 *    receiveData:   function (data){alert(data)}
 *  }
 *  aSocket.open("ftp.mozilla.org", 21);
 *  aSocket.async(observer );
 *
 */
Socket.prototype.async = function (observer)
{
  // to preserve ourselves within necko/async
  this.wrappedJSObject = this;

  this._pump = Cc["@mozilla.org/network/input-stream-pump;1"]
                                   .createInstance(Ci.nsIInputStreamPump);
  this._pump.init(this._inputStream, -1, -1, 0, 0, false);
  this._pump.asyncRead(new SocketListener(observer), this);
}

// async callbacks
function SocketListener(observer) { this._observer = observer; }

SocketListener.prototype.onStartRequest =
  function (channel, socketContext)
  {
    theSocket = socketContext.wrappedJSObject;
    this._observer.streamStarted( theSocket );
  }

SocketListener.prototype.onStopRequest =
  function (channel, socketContext, status, errorMsg)
  {
    theSocket = socketContext.wrappedJSObject;
    this._observer.streamStopped( theSocket, status, errorMsg );
  }

SocketListener.prototype.onDataAvailable =
  function (channel, socketContext, inputStream, sourceOffset, count)
  {
    theSocket = socketContext.wrappedJSObject;
    // try and maintain the connection
    // but read here because Socket.read will fail with HTTP requests due
    // to the socket being closed.
    theSocket._inputStream = inputStream;
    if (theSocket.binary) {
      theSocket._inputInterface =
      theSocket.toBinaryInputStream( theSocket._inputStream );
      // despite the documentation, readBytes works
      this._observer.receiveData( theSocket._inputInterface.readBytes(count) );
    } else {
      theSocket._inputInterface =
      theSocket.toScriptableInputStream( theSocket._inputStream );
      this._observer.receiveData( theSocket._inputInterface.read(count) );
    }
 }
