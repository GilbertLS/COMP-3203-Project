function LinkedList() {
	var firstNode	= null,
		lastNode	= null,
		size		= 0;
		
	function pushFront(data) {
		var newNode  = new Node();
		newNode.data = data;
		newNode.next = firstNode;
		newNode.prev = null;
		
		if(firstNode)
			firstNode.prev = newNode;
		else
			lastNode = newNode;
			
		firstNode = newNode;
		
		++size;
	}
		
	function pushEnd(data) {
		var newNode  = new Node();
		newNode.data = data;
		newNode.next = null;
		newNode.prev = lastNode;
		
		if(lastNode)
			lastNode.next = newNode;
		else
			firstNode = newNode;
			
		lastNode = newNode;
		
		++size;
	}
	
	function popFront() {
		if(!firstNode)
			return null;
			
		var node = firstNode;
		
		firstNode = firstNode.next;
		
		if(firstNode)
			firstNode.prev = null;
		else
			lastNode = null;
			
		--size;
			
		return node.data;
	}
	
	function popEnd() {
		if(!lastNode)
			return null;
			
		var node = lastNode;
		
		lastNode = lastNode.prev;
		
		if(lastNode)
			lastNode.next = null;
		else
			firstNode = null;
			
		--size;
			
		return node.data;
	}
	
	function peekFront() {
		if(firstNode)
			return firstNode.data;
		else
			return null;
	}
	
	function peekEnd() {
		if(lastNode)
			return lastNode.data;
		else
			return null;
	}
	
	function getSize() {
		return size;
	}
	
	function toString() {
		var string  = "List: [",
			node    = firstNode;
		
		if(node) {
			string += node.toString();
			node = node.next;
		}
		
		while(node) {
			string += " ," + node.toString();
			node = node.next;
		}
		
		string += "].";
		return string;
	}

	function Node() {
		var data = null,
			next = null,
			prev = null;
	
		return {
			data: data,
			next: next,
			prev: prev,
			toString: this.toString
		};
	}
	
	Node.prototype.toString = function() {			
		if(!isNaN(this.data))
			return this.data;
			
		if(typeof(this.data) === 'string' || this.data instanceof String)
			return data;
			
		if(this.data.toString())
			return this.data.toString();
			
		return "Err";
	};
	
	return {
		pushFront: pushFront,
		pushEnd: pushEnd,
		popFront: popFront,
		popEnd: popEnd,
		peekFront: peekFront,
		peekEnd: peekEnd,
		toString: toString,
		getSize: getSize
	};
}
