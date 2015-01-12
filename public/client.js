$(document).ready(function() {

	//============
	//===WEBRTC===
	//============
	channelOpen = false;
	
	var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || null;
	var SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || null;
	var RTCIceCandidate = window.mozRTCIceCandidate || window.webkitRTCIceCandidate || null;

	if(!PeerConnection)
		alert("Your browser does not support WebRTC. Get Firefox to use DrawNChat!");
	
	
	//Stores peerConnection and dataChannel
	var ConnectionObj = {
		create: function() {
			var self = Object.create(this);
			self.name = "";
			
			var configuration = {
			  'iceServers': [
				{'url':'stun:stun.l.google.com:19302'},
				{'url':'stun:stun1.l.google.com:19302'},
				{'url':'stun:stun2.l.google.com:19302'},
				{'url':'stun:stun3.l.google.com:19302'},
				{'url':'stun:stun4.l.google.com:19302'},
			  ]
			};
			self.pc = new PeerConnection(configuration);
			self.pc.onicecandidate = function(event) {
				if(self.pc.remoteDescription == undefined || self.pc.remoteDescription == null) {
					console.log("!!!REMOTE UNDEFINED!!!");
				}
				else {
					console.log("!!!REMOTE IZ DEFINED!!!");
				}
				if(event.candidate) {
					console.log("Sending new ICE Candidate");
					console.log(event.candidate);
					socket.emit("iceCandidate", JSON.stringify({
						room: roomId,
						candidate: event.candidate
					}));
				}
			}
			self.pc.onnegotiationneeded = function () {
				console.log("ON NEGOTIATION NEEDED");
				sendOfferToGroupmates(gpsIDs);
			}
			self.dataChannel = null;
			
			self.pc.ondatachannel = function(event) {
				console.log("GOT A DATA CHANNEL!!!");
				self.dataChannel = event.channel;
				setChannelEvents(self.dataChannel);
			}
			
			return self;
		},
		
		makeOwnDataChannel : function() {
			this.dataChannel = this.pc.createDataChannel("dataChannel");
			setChannelEvents(this.dataChannel);
		},
		
		setDataChannel : function(channel) {
			this.dataChannel = channel
		}
	};
	conObjs = {}; //clientID : connectionObj
	ownName = "";
	
	//============
	//============
	//============

	console.log("connecting...");
	
	//var socket = io.connect("drawandchat.jit.su:80"); //use this if uploading to nodejitsu
	var socket = io.connect("localhost:80"); //use this if running locally

	//Sketchpad initialization
	var canvas = document.getElementById('canvas');
	var padContext = canvas.getContext('2d');
	var sketchpad = new Sketchpad(padContext);
	var drawingInterval = null;

	$('#size-selector').on('change', function(){
		sketchpad.setWidth($('#size-selector').val());
	});

	$('#size-selector').on('keydown', function(){
	    sketchpad.setWidth($('#size-selector').val());
	});

	$('#color-selector').on('change', function(){
	    sketchpad.setColor($('#color-selector').val());
	});

	//-----------------------

	var roomId = getRoomIdFromUrl();
	//console.log("ROOM ID = " + roomId);
	if(roomId) {
		showLoading();
		
		socket.emit("doesroomexist", JSON.stringify({
			room: roomId
		}));
		
	} else {
		showHome();
		socket.emit("createid");
	}

	socket.on("iceCandidateUpdate", function(data) {
		data = JSON.parse(data);
		console.log("ICE Candidate update");
		console.log("Got ICE Candidate from " + data.peerID);
		if(conObjs[data.peerID] != undefined) {
			console.log("client found");
			conObjs[data.peerID].pc.addIceCandidate(new RTCIceCandidate(data.iceCandidate));
		}
	});
	
	socket.on("createid", function(data) {
		console.log("CREATEID HERE");
		data = JSON.parse(data);
		$("#input-room-id").val(document.URL + "?i=" + data.id);
		roomId = data.id;
		console.log("Room ID = " + roomId);
	});

	socket.on("setname", function(data) {
		data = JSON.parse(data);
		if(data.result) {
			ownName = $("#name-input").val();
			showChatRoom();
		} else {
			alert(data.error);
		}
	});

	//&&!!&&
	socket.on("getCanvasData", function(data) {
		console.log("getCanvasData");
		data = JSON.parse(data);
		
		var imageData = sketchpad.getImageData();
		socket.emit("giveCanvasData", JSON.stringify({
			peerID: data.requesterID,
			image: imageData,
		}));
	});
	//&&!!&&
	socket.on("HereIsCanvasData", function(data) {
		console.log("HereIsCanvasData");
		data = JSON.parse(data);
		sketchpad.setImageData(data.image);
	});
	
	gpsIDs = [];
	socket.on("roomExists", function(data) {
		console.log("Room Exists, Sending Offer to groupmates");
		data = JSON.parse(data);
		gpsIDs = data.groupmatesIDs;
		sendOfferToGroupmates(data.groupmatesIDs);
	});

	socket.on("disconnect", function() {
		console.log("Server has been disconnected. It may now be impossible for users to join.");
	});
	function createOfferSendingFunction(grpMtID) {
		return function(offer) {
				conObjs[grpMtID].pc.setLocalDescription(new SessionDescription(offer), 
				function() {
					//send the offer to a server to be forwarded to the friend you're calling
					socket.emit("signalOffer", JSON.stringify({
						targetID: grpMtID,
						clientOffer: offer
					}));
				}, error);
		};
	}
	function sendOfferToGroupmates(groupmatesIDs) {
		for(var i=0; i<groupmatesIDs.length; i++) {
			var grpMtID = groupmatesIDs[i];
			conObjs[grpMtID] = ConnectionObj.create();
			conObjs[grpMtID].makeOwnDataChannel();
			
			//prevent using variables that are from outer scope
			//http://conceptf1.blogspot.ca/2013/11/javascript-closures.html
			//http://javascriptissexy.com/understand-javascript-closures-with-ease/

			conObjs[grpMtID].pc.createOffer(createOfferSendingFunction(grpMtID), error);
			/*
			conObjs[grpMtID].pc.createOffer(function(offer) {
				conObjs[grpMtID].pc.setLocalDescription(new SessionDescription(offer), 
				function() {
					//send the offer to a server to be forwarded to the friend you're calling
					socket.emit("signalOffer", JSON.stringify({
						targetID: idGetter(),
						clientOffer: offer
					}));
				}, error);
			}, error);
			*/
		}
	}
	
	socket.on("roomDoesNotExist", function() {
		alert("The room does not exist!");
		document.location.href = '../';
	});
	
	socket.on("doesroomexist", function(data) {
		data = JSON.parse(data);
		if(data.result) {
			showNameForm();
		} else {
			alert("The room does not exist!");
			document.location.href = '../';
		}
	});
	
	socket.on("offerFromClient", function(data) {
		console.log("OFFER RECEIVED!!! SENDING ANSWER");
		data = JSON.parse(data);
		console.log(data.offer);
		
		console.log("from client " + data.offererID);
		
		conObjs[data.offererID] = ConnectionObj.create();
		
		//if(conObjs[data.offererID] != undefined) {
		conObjs[data.offererID].pc.setRemoteDescription(new SessionDescription(data.offer), function() {
			console.log("in setRemoteDescription");
			conObjs[data.offererID].pc.createAnswer(function(answer) {
				console.log("in createAnswer");
				conObjs[data.offererID].pc.setLocalDescription(new SessionDescription(answer), function() {
					console.log("in setLocalDescription");
					//https://github.com/ESTOS/strophe.jingle/issues/35
					//send the answer to a server to be forwarded back to the caller
					socket.emit("signalAnswer", JSON.stringify({
						clientName: ownName,
						clientAnswer: answer,
						targetID: data.offererID 
					}));
				}, error);
			}, error);
		}, error);
		//}
		
	});

	socket.on("answerToOffer", function(data) {
		console.log("ANSWER RECEIVED!!!");
		data = JSON.parse(data);	
		
		conObjs[data.answererID].pc.setRemoteDescription(new SessionDescription(data.answer), function() {}, error);
		conObjs[data.answererID].name = data.answererName;
		showNameForm();

	});
	
	socket.on("deleteMember", function(data) {
		data = JSON.parse(data);
		console.log("DELETING MEMBER " + data.memberToDelete);

		$("#convo").append(">" + conObjs[data.memberToDelete].name + " has left!\n");
		convoHasChanged();
		
		delete conObjs[data.memberToDelete];
		
		console.log("group so far---");
		for(var id in conObjs) {
			console.log(conObjs[id].name);
		}
	});
	
	$("#create-button").click(function() {
		if(roomId == null) {
			console.log("No room id. Cannot create room.")
			return;
		}

		var string = "?i=".concat(roomId);
		history.replaceState(null, "", string);
		showNameForm();
	});

	function setName() {
		socket.emit("setname", JSON.stringify({
			name: $("#name-input").val(),
		}));
		
		console.log("channelOpen = " + channelOpen);
		if(channelOpen == true) {
			console.log("SENDING A NAME");
			sendToGroup("name", $("#name-input").val());
		}
	}

	$("#name-button").click(function() {
		setName();
	});
	$("#name-input").keypress(function(e) {
		if(e.which == 13) {
			setName();
		}
	});

	$("#url-button").click(function() {
		window.prompt("Copy URL to clipboard: Ctrl+C", document.URL);
	});

	$("#convo-header").click(function() {
		if($(this).hasClass("collapsed")){
			var chevron = $("#convo-header").find("i");
			chevron.removeClass("fa-chevron-up");
			chevron.addClass("fa-chevron-down");
		} else {
			var chevron = $(this).find("i");
			chevron.removeClass("fa-chevron-down");
			chevron.addClass("fa-chevron-up");
		}
		$("#convo").scrollTop($("#convo")[0].scrollHeight);
		$(".exclamation").remove();
	});

	$("#user-list-button").click(function() {
		var list = $("#user-list");
		list.empty();
		list.append('<li><a href="#"><i class="fa fa-user" style="margin-right: 5px"></i>You</a></li>');
		console.log("CONOBJS " + conObjs);
		for (var id in conObjs) {
			var obj = conObjs[id];
			if(obj.name)
				list.append('<li class="' + obj.name + '"><a href="#"><i class="fa fa-user" style="margin-right: 5px"></i>' + obj.name + '</a></li>');
		}
	});
	
	var sendChatMessage = function() {
		var msg = $("#msg").val();
		var convo = $("#convo");
		convo.append(ownName + ": " + msg + "\n");
		convo.scrollTop(convo[0].scrollHeight);
		sendToGroup("chatMessage", msg);
		$("#msg").val("");
	};
	$("#send").click(function() {
		sendChatMessage();
	});
	
	$("#msg").keypress(function(e) {
		if(e.which == 13) {
			sendChatMessage();
		}
	});

	drawingInterval = setInterval(function() {
		var array = sketchpad.toArray();
		if(array.length > 0)
			sendToGroup("draw", array);
	},30);

	function convoHasChanged() {
		var header = $("#convo-header");
		if(header.hasClass("collapsed") && $(".exclamation").length == 0) {
			header.prepend("<div class='exclamation dark-green'><i class='fa fa-exclamation fa-1x'></i></div>");
		}
	}

	function getRoomIdFromUrl() {
		var url = document.URL,
			n = url.indexOf("?i="),
			m = url.indexOf("&");

		if(n > -1 && n + 3 < url.length) {
			return url.substring(n + 3);
		}
		else
			return null;
	}

	function showChatRoom() {
		hide();
		$("#chat-room").show();
		$("#navbar").show();
		var navigation = $("#navigation");
		navigation.animate({
			height: 50,
		}, 1000);
		navigation.addClass("navbar-fixed-top");
		navigation.removeClass("navbar-static-top");
		$(".navbar-brand").css("padding", "5px");
		sketchpad.resize();
		socket.emit("requestCanvasData", null);

	}

	function showHome() {
		hide();
		$("#home").show();
	}

	function showNameForm() {
		hide();
		$("#name-form").show();
		$("#name-input").focus();
	}

	function showLoading() {
		hide();
		$("#loading").show();
	}

	function hide() {
		$("#name-form").hide();
		$("#home").hide();
		$("#chat-room").hide();
		$("#navbar").hide();
		$("#loading").hide();
	}

	function error(err) { console.log("ERROR OCCURRED!!!"); console.log(err); endCall(); }

	function setChannelEvents(channel) {
		console.log("!!!!!SETTING CHANNEL EVENTS!!!!!");
		channel.onmessage = function(event) {
			var data = JSON.parse(event.data);
			console.log("received command: " + data.command);
			console.log("received dataObj: ");
			console.log(data.dataObj);
			commandFunctions[data.command](this, data);
		};
		channel.onopen = function() {
			console.log("channel open");
			channelOpen = true;
		}
		channel.onclose = function() {
			console.log("channel close");
		}
	}
		
	function sendToGroup(theCommand, theData) {
		for(var id in conObjs) {
			//console.log(conObjs[id]);
			conObjs[id].dataChannel.send(JSON.stringify({
				command: theCommand,
				dataObj: theData
			}));
		}
	}
		
	function findConObj(dataChannel) {
		for(var id in conObjs) {
			if(conObjs[id].dataChannel == dataChannel) {
				return conObjs[id];
			}
		}
		return null;
	}
		
	var commandFunctions = {};
	commandFunctions["name"] = function(dataChannel, data) {
		var theConObj = findConObj(dataChannel);
		if(theConObj != null) {
			theConObj.name = data.dataObj;
			console.log("received name = " + theConObj.name);
			$("#convo").append(">" + theConObj.name + " has joined!\n")
			convoHasChanged();
		}
	};

	commandFunctions["chatMessage"] = function(dataChannel, data) {
		var theConObj = findConObj(dataChannel);
		if(theConObj != null) {
			var convo = $("#convo");
			convo.append(theConObj.name + ": " + data.dataObj + "\n");
			convo.scrollTop(convo[0].scrollHeight);
			convoHasChanged();
		}
	};

	commandFunctions["draw"] = function(dataChannel, data) {
		var theConObj = findConObj(dataChannel);
		if(theConObj != null) {
			sketchpad.drawFromArray(data.dataObj);
		}
	}

	/*
	commandFunctions[" <YOUR COMMAND> "] = function(dataChannel, data) {
		var theConObj = findConObj(dataChannel);
		if(theConObj != null) {
			//YOUR STUFF TO DO
			
			//
		}
	};
	*/
});