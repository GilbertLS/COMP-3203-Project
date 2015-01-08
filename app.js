var http = require("http");
var path = require("path");
var url = require("url");
var fs = require('fs');
var io = require("socket.io");
 
 
var mimeTypes = {
    "html": "text/html",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "js": "text/javascript",
    "css": "text/css"
};
 
//read and store all the necessary static files to be sent to the client
var contentData = {};
var dirPath = "./public";
var filenames = fs.readdirSync(dirPath);
//console.log("!!!filenames!!!");
for(var i=0; i<filenames.length; i++) {
    //console.log(filenames[i]);
    contentData["/"+filenames[i]] = fs.readFileSync(dirPath+"/"+filenames[i]); 
}

 
var server = http.createServer(function(request, response) {
     
    console.log(request.url);
     
    var extname = path.extname(request.url);
    var contentType = 'text/html';
    var pathname = url.parse(request.url).pathname;
    //console.log("pathname = " + pathname);
    //console.log("extname = " + extname);
    //console.log("extname = " + extname.substring(1, extname.length));
     
    if(pathname != "/") { //give the other files
        extname = extname.substring(1, extname.length);
        if(extname == "ico") {
            return;
        }
        contentType = mimeTypes[extname];
         
        if(typeof contentData[pathname] != "undefined") {
            response.writeHeader(200, {"Content-Type": contentType});
            response.write(contentData[pathname]);
            response.end();
        }
    }
    else { //give the starting page
        response.writeHeader(200, {"Content-Type": contentType});
        response.write(contentData["/client.html"]);
        response.end();
    }
     
}).listen(80); //use this if uploading to nodejitsu
//}).listen(8080); //use this if running locally
 
     
 
     
//=====================
//===socket.io stuff===
//=====================
var socket = io.listen(server);
 
//var hosts = {};

//Represents a group of clients in the same chatroom
var groups = {}; //roomID : list of client ids

socket.on("connection", function(client) {
 
    console.log("client id = " + client.id);
    client.name = "Unknown";
    client.locked = true;
     
    client.on("createid", function() {
        if(client.room) {
            client.emit("createid", JSON.stringify({
                id: client.room,
            }));
            return;
        }
        client.room = "";

		//Ensure uniqueness of UUID
        var UUID = getUUID();
        while(groups[UUID]) {
            UUID = getUUID();
        }

        client.room = UUID;
        groups[UUID] = [];
		groups[UUID].push(client);
        client.name = "Host";

        client.emit("createid", JSON.stringify({
            id: UUID,
        }));
    });

    client.on("setname", function(data) {
        data = JSON.parse(data);
        var result = false;
        var message = "";

        if(data.name.length < 3) {
            message = "Name must be at least 3 characters long.";
        } else if (data.name.length > 20) {
        	message = "Name cannot be more than 20 characters long."
        } else {
            client.name = data.name;
            result = true;
            message = "Name is good."
        }

        client.emit("setname", JSON.stringify({
			result: result,
            error: message 
        }));
    });

    client.on("togglelock", function() {
        if(client.room) {
            if(client.locked) {
                client.locked = false;
            } else
                client.locked = true;

            client.emit("toggledlock");
        }
    });

    client.on("requestCanvasData", function() {
    	socket.to(groups[client.room][0].id).emit("getCanvasData", JSON.stringify({
			requesterID: client.id
		}));
    });

	//&&!!&&
	client.on("giveCanvasData", function(data) {
		console.log("giveCanvasData");
		data = JSON.parse(data);
		socket.to(data.peerID).emit("HereIsCanvasData", JSON.stringify({
			image: data.image,
		}));
	});
	
    client.on("doesroomexist", function(data) {
        data = JSON.parse(data);
        var result = groups[data.room] ? true: false;
		if(result) {
			
			//group exists
			//send number of ppl there and their clientIDs
			var otherClientsIDs = [];
			for(var i=0; i<groups[data.room].length; i++) {
				otherClientsIDs.push(groups[data.room][i].id);
			}
			
			client.emit("roomExists", JSON.stringify({
				groupmatesIDs: otherClientsIDs
			}));
			
			//add to group
			var found = false;
			if(groups[data.room] != undefined) {
				for(var i=0; i<groups[data.room].length; i++) {
					if(groups[data.room][i].id == client.id) {
						found = true;
					}
				}
				if(!found) {
					console.log("added " + client.id + " to group");
					groups[data.room].push(client);
					client.room = data.room;
				}
				
				console.log("GROUP SO FAR:");
				for(var i=0; i<groups[data.room].length; i++) {
					console.log(groups[data.room][i].id);
				}
				console.log("+++++++++++++++++++++++++++");
			}
		
		}
		else {
			client.emit("roomDoesNotExist");
		}
		/*
        socket.emit("doesroomexist", JSON.stringify({
            result: hosts[data.room] ? true : false,
        }));
		*/
    });
	client.on("signalOffer", function(data) {
		data = JSON.parse(data);
		//console.log("!!!IN SIGNAL OFFER with target id = " + data.targetID);
		//console.log("the offer is = " + data.clientOffer);
	
		socket.to(data.targetID).emit("offerFromClient", JSON.stringify({
			offer: data.clientOffer,
			offererID: client.id
		}));
		
	});
	
	
	client.on("signalAnswer", function(data) {
		data = JSON.parse(data);
		
		//console.log("client room = " + client.room);
		socket.to(data.targetID).emit("answerToOffer", JSON.stringify({
			roomID: client.room,
			answer: data.clientAnswer,
			answererID: client.id,
			answererName: data.clientName
		}));
		
	});

	client.on("iceCandidate", function(data) {
		data = JSON.parse(data);
		
		console.log("ICE candidate from " + client.id);
		console.log("For room " + data.room);
		if(groups[data.room] != undefined) {
			for(var i=0; i<groups[data.room].length; i++) {
				if(groups[data.room][i].id != client.id) {
					console.log("Sending ICE Candidate to " + groups[data.room][i].id);
					socket.to(groups[data.room][i].id).emit("iceCandidateUpdate", JSON.stringify({
						peerID: client.id,
						iceCandidate: data.candidate
					}));
				}
			}
			console.log();
		
		}
	});
	
    client.on("disconnect", function() {
        if(client.room) {
			console.log("deleting client " + client.id + " from group");

			//delete client from group
			var index = groups[client.room].indexOf(client);
			groups[client.room].splice(index,1);
			
			//tell all other clients in the group to delete this client
			for(var i=0; i<groups[client.room].length; i++) {
				console.log("HERE with " + groups[client.room][i].id);
				socket.to(groups[client.room][i].id).emit("deleteMember", JSON.stringify({
					memberToDelete: client.id
				}));
			}
			
			if(groups[client.room].length == 0) {
				console.log("group member count == 0 so deleting entire group");
				delete groups[client.room];
			}
			delete client;
        }
    });
});

function getUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
}