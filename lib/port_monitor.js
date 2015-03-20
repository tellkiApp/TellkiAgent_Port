/**
* This script was developed by Guberni and is part of Tellki's Monitoring Solution
*
* February, 2015
* 
* Version 1.0
*
* DESCRIPTION: Monitor Port utilization
*
* SYNTAX: node port_monitor.js <HOST> <METRIC_STATE> <CIR_IDS> <PARAMS>
* 
* EXAMPLE: node port_monitor.js "10.10.2.5" "1,1" "2611" "new;180#new#0#"
*
* README:
*		<HOST> Hostname or ip address to check
* 
*		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
*		1 - metric is on ; 0 - metric is off
*		
*		<CIR_IDS> is generated internally by Tellki and its only used by Tellki default monitors
*
*		<PARAMS> are 4 fields separeted by "#" and it contains the monitor's configuration, is generated internally
*		by Tellki and it's only used by Tellki's default monitors.
**/

//METRICS IDS
var metricStatusId = '35:Status:9';
var metricResponseTimeId = '201:Response Time:4';


// ############# INPUT ###################################
//START
(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidParametersError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	
	if(args.length != 4)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}

/*
* Process the passed arguments and send them to monitor execution (monitorPORT)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	//<HOST> 
	var host = args[0];
	
	//<METRIC_STATE> 
	var metricState = args[1];
	
	var tokens = metricState.split(",");
	
	// metric Status state
	var checkStatus = false;
	// metric Response time state
	var checkTimeout = false;
	
	if (tokens[0] == "1")
	{
		checkStatus = true;
	}

	if (tokens[1] == "1")
	{
		checkTimeout = true;
	}
	

	//<CIR_IDS> 
	var cirUUDIS = args[2].split(",");
	
	// <PARAMS>
	var portTestsRepresentation = args[3].split(",");
	
	
	var portTestRequests = [];

	//create port tests
	var i = 0;
	for (var j in portTestsRepresentation)
	{
		var tokens = portTestsRepresentation[j].split("#", 4);
		
		// Port.
		var port = 0;
		port = parseInt(tokens[0].split(";")[1]);
		
		if(isNaN(port))
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
		
		var protocols = tokens[2];

		// Protocols (0 - TCP; 1 - UDP; 2 - BOTH).
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
		
		//create test representation object
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

		i++;
	}
	
	//call monitor
	monitorPORT(portTestRequests);
}



// ################# PORT CHECK ###########################
/*
* Retrieve metrics information.
* Receive: Test's list
*/
function monitorPORT(portTestRequests) {

	/*
	* TCP test
	* Receive:
	* - test configuration
	* - callback function
	*/
    this.getTCP = function getTCP(testRequest, callback) {
        if (testRequest != undefined) {

            var net = require('net');
            var s = new net.Socket();
            var timeout = 4000;
            
			var result = 0;

            //Connection!
            s.setTimeout(timeout, function () {
                callback(result, testRequest);
                s.destroy();
            });

            s.connect(testRequest.port, testRequest.host, function () {
                result = 1;
                if (!testRequest.testString) {
                    callback(result, testRequest);
                    s.destroy();
                }
            });

            //Result of the connection

            s.on('error', function (e) {
                //silently catch all errors - assume the port is closed
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

	/*
	* UDP test
	* Receive:
	* - test configuration
	* - callback function
	*/
    this.getUDP = function getUDP(testRequest, callback) {
        if (testRequest != undefined) {
            var dgram = require('dgram');
            var message = new Buffer('My KungFu is Good!');
            var client = dgram.createSocket('udp4');
			
			
            client.send(message, 0, message.length, testRequest.port, testRequest.host, function (err, bytes) {
                if (err)
                {
					client.close();
					return callback(0, testRequest);
				}
                client.close();
                callback(1, testRequest);
            });
        }
    }

	/*
	* Process tests response
	* Receive:
	* - test result
	* - start time, to calculate execution time
	* - test configuration
	* - callback function
	*/
    this.response = function response(fail, start, testRequest, callback) {
        metrics = [];

        if (fail) {
            //Status
            if (testRequest.checkStatus) {
                var metric = new Object();
                metric.id = metricStatusId;
                metric.val = '1';
                metric.ts = start;
                metric.exec = Date.now() - start;
                metric.obj = testRequest.port;
                
				metrics.push(metric);
            }
            //Response Time
            if (testRequest.checkTimeout) {
                var metric = new Object();
                metric.id = metricResponseTimeId;
                metric.val = Date.now() - start;
                metric.ts = start;
                metric.exec = Date.now() - start;
                metric.obj = testRequest.port;
                
				metrics.push(metric);
            }
            
			return callback(metrics, testRequest.cirUUDI);
        
		} else {
			if (testRequest.checkStatus) {
				var metric = new Object();
				//Status
				metric.id = metricStatusId;
				metric.val = '0';
				metric.ts = start;
				metric.exec = Date.now() - start;
				metric.obj = testRequest.port;
				
				metrics.push(metric);
			}

			return callback(metrics, testRequest.cirUUDI);
        }

    }

	//execute tests
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



//################### OUTPUT METRICS ###########################
/*
* Send metrics to console
* Receive: 
* - metrics list to output
* - 
*/
function output(metrics, targetId)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += targetId
		out += "|";
		out += metric.id;
		out += "|";
		out += metric.val;
		out += "|";
		out += metric.obj;
		out += "|";
		
		console.log(out);
	}
}


//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;


function InvalidParametersError() {
    this.name = "InvalidParametersError";
    this.message = "Invalid value in parameters.";
	this.code = 10;
}
InvalidParametersError.prototype = Object.create(Error.prototype);
InvalidParametersError.prototype.constructor = InvalidParametersError;
