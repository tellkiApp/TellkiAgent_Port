//java -jar port-monitor.jar 1438 MACGYVER "1,1" "1440,1441,1442,1443" "80#testPortChecker#0#,5001#testPortChecker#1#,5000#testPortChecker#2#,5000#testPortChecker#2#"aaaaaaaaa"" ""


//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Error.prototype;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid value in metric state.");
}
InvalidMetricStateError.prototype = Error.prototype;

function InvalidParametersError() {
    this.name = "InvalidParametersError";
    this.message = ("Invalid value in parameters.");
}
InvalidParametersError.prototype = Error.prototype;



// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		console.log(err.message);
		process.exit(1);
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 6)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	//host
	var host = args[1];
	
	//metric state
	var metricState = args[2].replace("\"", "");
	
	var tokens = metricState.split(",");

	var checkStatus = false;
	var checkTimeout = false;
	
	if (tokens.length == 2)
	{
		if (tokens[0] == "1")
		{
			checkStatus = true;
		}

		if (tokens[1] == "1")
		{
			checkTimeout = true;
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}
	
	
	//cir uuids
	var cirUUDIS = args[3].replace("\"", "").split(",");
	
	// PROTOCOLS

	var portTestsRepresentation = args[4].split(",");
	
	//console.log(portTestsRepresentation)
	
	var portTestRequests = [];

	var i = 0;
	for (var j in portTestsRepresentation)
	{
		var tokens = portTestsRepresentation[j].split("#", 4);
		
		if (tokens.length == 4)
		{
			// Port.
			var port = 0;
			port = parseInt(tokens[0]);

			if(port === 'NaN')
			{
				var exception = new InvalidParametersError();
				exception.message = "Invalid value in parameters (port).";
				throw exception;
			}

			if (port < 0 || port > 65535)
			{
				var exception = new InvalidParametersError();
				exception.message = "Invalid port number in parameters.";
				throw exception;
			}
			
			var testName = tokens[1];
			
			// Protocols.
			var protocols = tokens[2];

			if (protocols === "0" || protocols ==="1" || protocols === "2")
			{
				testProtocol = protocols;
			}
			else
			{
				var exception = new InvalidParametersError();
				exception.message = "Invalid value in parameters (protocols).";
				throw exception;
			}

			// Test string.
			
			var testString = null;
			
			if (tokens[3] !== '')
			{
				testString = tokens[3];
			}
			
			
			var portTestRepresentation = new Object();
			portTestRepresentation.cirUUDI = cirUUDIS[i];
			portTestRepresentation.testName = testName;
			portTestRepresentation.port = port;
			portTestRepresentation.host = host;
			portTestRepresentation.protocol = testProtocol;
			portTestRepresentation.testString = testString;
			portTestRepresentation.checkStatus = checkStatus;
			portTestRepresentation.checkTimeout = checkTimeout;
			
			portTestRequests.push(portTestRepresentation);
		}
		else
		{
			throw new InvalidParametersError();
		}

		i++;
	}
	
	
	monitorPORT(portTestRequests);
	
}




//################### OUTPUT ###########################

function output(metrics, targetId)
{
	
	
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += new Date(metric.ts).toISOString();
		out += "|";
		out += targetId;
		out += "|";
		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		out += metric.obj
		//out += "\n";
		console.log(out);
	}
	
}



// ################# MONITOR ###########################
function monitorPORT(portTestRequests) {

    this.getTCP = function getTCP(testRequest, callback) {
        if (testRequest != undefined) {

            var net = require('net');
            var s = new net.Socket();
            var timeout = 4000;
            //console.log('Host:' + testRequest.host + " Port:" + testRequest.port + " Service:" + testRequest.testName + "->" + testRequest.cirUUDI + "->" + testRequest.testString);
            var result = 0;

            //Connection!
            s.setTimeout(timeout, function () {
                //console.log('timeout: ' + service + "->" + t.Host + ':' + p + "->" + t.Id);
                callback(result, testRequest);
                s.destroy();
            });

            s.connect(testRequest.port, testRequest.host, function () {
                //console.log('OPEN: ' + service + ':' + p);
                result = 1;
                if (!testRequest.testString) {
                    callback(result, testRequest);
                    s.destroy();
                }
            });

            //Result of the connection

            s.on('error', function (e) {
                //silently catch all errors - assume the port is closed
                //console.log('error: ' + t.Host + ':' + p);
                callback(0, testRequest);
                s.destroy();
            });

            //if any data is written to the client on connection, show it
            s.on('data', function (data) {
                var welcomeMessage = data + "";
                if (testRequest.testString)
                    if (welcomeMessage.indexOf(testRequest.testString) === -1)
                        result = 0;

                callback(result, testRequest);
                s.destroy();
            });

            s.on('close', function (e) {
            });
        }
    }

    this.getUDP = function getUDP(testRequest, callback) {
        if (testRequest != undefined) {
            var dgram = require('dgram');
            var message = new Buffer('My KungFu is Good!');
            var client = dgram.createSocket('udp4');
            client.send(message, 0, message.length, testRequest.port, testRequest.host, function (err, bytes) {
                if (err)
                    callback(0, testRequest);
                //console.log('UDP message sent to ' + testRequest.host + ':' + testRequest.port);
                client.close();
                callback(1, testRequest);
            });
        }
    }

    this.response = function response(fail, start, testRequest, callback) {
        metrics = [];

        if (fail) {
            //Status
            if (testRequest.checkStatus) {
                var metric = new Object();
                metric.id = '35:9';
                metric.val = '1';
                metric.ts = start;
                metric.exec = Date.now() - start;
                metric.obj = testRequest.port;
                
				metrics.push(metric);
            }
            //Response Time
            if (testRequest.checkTimeout) {
                var metric = new Object();
                metric.id = '201:7';
                metric.val = Date.now() - start;
                metric.ts = start;
                metric.exec = Date.now() - start;
                metric.obj = testRequest.port;
                
				metrics.push(metric);
            }
            
			return callback(metrics, testRequest.cirUUDI);
        
		} else {
            var metric = new Object();
            //Status
            metric.id = '35:9';
            metric.val = '0';
            metric.ts = start;
            metric.exec = Date.now() - start;
            metric.obj = testRequest.port;
            
			metrics.push(metric);

			return callback(metrics, testRequest.cirUUDI);
        }

    }


    for (var i in portTestRequests) {

		var portTestRequest = portTestRequests[i];

        var type = parseInt(portTestRequest.protocol);
		
		//TCP
        if (type == 0) {
            (function (portTestRequest) {
                var start = Date.now();
                this.getTCP(portTestRequest, function (result, testRequest) {
                    this.response((result == 1), start, testRequest, function (metrics, ciruuid) {
						output(metrics, ciruuid);
                    });
                });
            })(portTestRequest);
        }
		
		//UDP
        if (type == 1) {
            (function (portTestRequest) {
                var start = Date.now();
                this.getUDP(portTestRequest, function (result, testRequest) {
                    this.response((result == 1), start, testRequest, function (metrics, ciruuid) {
                        output(metrics, ciruuid);
                    });
                });
            })(portTestRequest);
        }
		
		//BOTH
        if (type == 2) {
            (function (portTestRequest) {
                var start = Date.now();
                this.getTCP(portTestRequest, function (result, testRequest) {
                    if (result == 1) {
                        this.getUDP(portTestRequest, function (result, testRequest) {
                            this.response((result == 1), start, testRequest, function (metrics, ciruuid) {
                                output(metrics, ciruuid);
                            });
                        });
                    } else {
                        this.response((result == 1), start, testRequest, function (metrics, ciruuid) {
                            output(metrics, ciruuid);
                        });
                    }
                });
            })(portTestRequest);
        }
    }
}