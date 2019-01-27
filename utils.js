const multiSend = (channel, messages, delay) => {
	delay = delay || 100;
	messages.forEach((m, i) => {
		setTimeout(() => {
			channel.send(m);
		}, delay * i);
	});
};


const sendLarge = (channel, largeMessage, status = '', options = {}) => {
	let message = largeMessage;
	let messages = [];
	let prefix = options.prefix || '';
	let suffix = options.suffix || '';
	let max = 2000 - prefix.length - suffix.length;
	while (message.length >= max) {
		let part = message.substr(0, max);
		let cutTo = max;
		if (options.cutOn) {
			/*
			 Prevent infinite loop where lastIndexOf(cutOn) is the first char in `part`
			 Later, we will correct by +1 since we did lastIndexOf on all but the first char in `part`
			 We *dont* correct immediately, since if cutOn is not found, cutTo will be -1, and we dont want that
			 to become 0
			 */
			cutTo = part.slice(1).lastIndexOf(options.cutOn);

			// Prevent infinite loop when cutOn isnt found in message
			if (cutTo === -1) {
				cutTo = max;
			} else {
				// Correction necessary from a few lines above
				cutTo += 1;

				if (options.cutAfter) {
					cutTo += 1;
				}
				part = part.substr(0, cutTo);
			}
		}
		messages.push(status + prefix + part + suffix);
		message = message.substr(cutTo);
	}

	if (message.length > 1) {
		messages.push(status + prefix + message + suffix);
	}

	multiSend(channel, messages, options.delay);
};

module.exports = {
	multiSend,
	sendLarge
};
