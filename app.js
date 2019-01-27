const { Stopwatch, Type } = require('./classes/');
const { Client, Collection } = require('discord.js');
const { promisify } = require('util');
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('./settings.json'));
const config = JSON.parse(fs.readFileSync('./config.json'));
const client = new Client({ disableEveryone: true, messageCacheMaxSize: 60, messageSweepInterval: 10, messageCacheMaxSize: 25 });
const database = require('./database.js')(client);
const prefix = process.env.PREFIX;
const allModules = ['allow-spam','talking','reposting','webhook', 'recover'];
const sleep = promisify(setTimeout);
let disabledChannels = [];

client.deletedMessages = new Collection();
client.utils = require('./utils');

client.on('ready', async () => {
	updateActivity();
	setInterval(() => {
		updateActivity();
	}, 60000);

	//client.guilds.forEach(processGuild)
	client.channels.filter((channel) => ['text'].includes(channel.type) && !channel.deleted).forEach(processChannel);
});

async function updateActivity() {
	let count = await database.getChannelCount();
	client.user.setActivity(`${prefix}help (${count} counting channels) [${client.shard.id}/${client.shard.count}]`, { type: 'WATCHING' });
};

async function processChannel(channel) {
	//let guild = channel.guild;
	disabledChannels.push(channel.id);
	let modules = await database.getModules(channel.id);
	if (!modules.includes('recover')) return disabledChannels = disabledChannels.filter((c) => c !== channel.id);

	let countingChannel = await database.getCountingChannel(channel.id);
	let fetched_channel = channel.guild.channels.get(countingChannel);

	if (fetched_channel) {
		let _count = await database.getCount(channel.id);
		let messages = await fetched_channel.messages.fetch({ limit: 100, after: _count.message });
		if (messages.array().length < 1) return disabledChannels = disabledChannels.filter((c) => c !== channel.id);

		let botMsg = await fetched_channel.send('**Making channel ready for counting..**\n:warning: Locking channel.');
		await fetched_channel.overwritePermissions(channel.guild.defaultRole, { SEND_MESSAGES: false }).then(() => botMsg.edit('**Making channel ready for counting..**\n:warning: Channel locked. Deleting new entries.')).catch(() => botMsg.edit('**Making channel ready for counting..**\n:warning: Failed to lock channel. Deleting new entries.'));
		let processing = true;
		let fail = false;
		while (processing) {
			let _count = await database.getCount(channel.id);
			let messages = await fetched_channel.messages.fetch({ limit: 100, after: _count.message });
			messages = messages.filter((m) => m.id !== botMsg.id);
			if (messages.array().length < 1) processing = false;
			else await fetched_channel.bulkDelete(messages).catch(() => { fail = true; });
		}
		await botMsg.edit(`**Making channel ready for counting..**\n:warning: ${(fail ? 'Failed to delete entries.' : 'Deleted new entries.')} Restoring channel.`);
		await fetched_channel.overwritePermissions(channel.guild.defaultRole, { SEND_MESSAGES: true }).then(() => botMsg.edit('**Making channel ready for counting..**\n:white_check_mark: Channel restored. Happy counting!')).catch(() => botMsg.edit('**Making channel ready for counting..**\n:x: Failed to restore channel.'));

		setTimeout(() => { botMsg.delete() }, 5000);
	}

	disabledChannels = disabledChannels.filter((c) => c !== channel.id);
};

client.on('message', async (message) => {

	let content = message.content.toLowerCase();

	if (message.author.id == client.user.id) return;

	if (!message.guild) return; // if its in a DM, we don't want it to trigger any other command. If it's ${prefix}help or ${prefix}info, we don't want to send the info message above, but still not trigger any other command.

	let countingChannel = await database.getCountingChannel(message.channel.id);
	if (message.channel.id === countingChannel) {
		if (disabledChannels.includes(message.channel.id)) return client.emit('deleteMessage', message, 'bot');//message.delete()
		if (message.author.bot && message.webhookID == null) return client.emit('deleteMessage', message, 'bot');//message.delete()
		if (message.webhookID != null) return;
		let _count = await database.getCount(message.channel.id);
		let count = _count.count;
		let countby = _count.countby;
		let user = _count.user;
		if (message.content.startsWith('!') && isAdmin(message.member)) return; // if it starts with ! and the user has MANAGE_GUILD then don't process it.
		if (message.type !== 'DEFAULT') return; // ex. pin messages gets ignored
		let modules = await database.getModules(message.channel.id);
		if (!modules.includes('allow-spam') && message.author.id === user) return client.emit('deleteMessage', message, 'bot'); // we want someone else to count before the same person counts
		if (message.content.split(' ')[0] != (count + countby).toString()) return client.emit('deleteMessage', message, 'bot'); // message.content.split(' ').splice(1)[0] = first word/number
		if (!modules.includes('talking') && message.content !== (count + countby).toString()) return client.emit('deleteMessage', message, 'bot'); // if the module 'talking' isn't activated and there's some text after it, we delete it as well
		database.addToCount(message.channel.id, message.author.id); count += countby;
		let countMsg = message;
		if (modules.includes('reposting')) {
			if (!modules.includes('webhook')) {
				countMsg = await message.channel.send({
					embed: {
						description: `${message.author}: ${message.content}`,
						color: message.member.displayColor ? message.member.displayColor : 3553598
					}
				});
				client.emit('deleteMessage', message, 'bot');
			} else {
				await message.channel.fetchWebhooks().then(async (webhooks) => {
					let foundHook = webhooks.find((webhook) => webhook.name === `${client.user.username} Reposting`);
					if (!foundHook) { // create a new webhook
						let webhook = await message.channel.createWebhook(`${client.user.username} Reposting`);
						countMsg = await webhook.send(message.content, {
							username: message.author.username,
							avatarURL: message.author.displayAvatarURL().split('?')[0]
						});
					} else {
						countMsg = await foundHook.send(message.content, {
							username: message.author.username,
							avatarURL: message.author.displayAvatarURL().split('?')[0]
						});
						client.emit('deleteMessage', message, 'bot');
					}
				}).catch();
			}
		}
		database.setLastMessage(message.channel.id, countMsg.id);
		//database.checkSubscribed(message.guild.id, message.channel.id, count, message.author.id, countMsg.id);
		//database.checkRole(message.guild.id, count, message.author.id);
		return;
	}

	if (message.author.bot) return;
	const command = parseCommand(message);
	let cmd = command.name;
	let args = command.args;
	message.flags = command.flags;

	if (['link','linkchannel','link-channel'].includes(cmd)) {
		if (!isAdmin(message.member)) return message.channel.send(':no_entry: You need the `MANAGE_GUILD`-permission to do this!');

		let channel = get_instance(message, 'GuildTextChannel', 0);

		let botMsg = await message.channel.send(':hotsprings: Linking...');
		return database.saveCountingChannel(channel.id, channel.id)
			.then(() => { botMsg.edit(`:white_check_mark: From now on, ${channel.id === message.channel.id ? 'this channel' : channel.toString()} will be used for counting.`) })
			.catch(() => { botMsg.edit(':anger: Could not save to the database. Try again later.') });
	} else if (['unlink','unlink-channel','unlinkchannel'].includes(cmd)) {
		if (!isAdmin(message.member)) return message.channel.send(':no_entry: You need the `MANAGE_GUILD`-permission to do this!');

		let channel = get_instance(message, 'GuildTextChannel', 0);

		let botMsg = await message.channel.send(`:hotsprings: Unlinking ${channel.id === message.channel.id ? 'this channel' : channel.toString()}...`);
		return database.saveCountingChannel(channel.id, '0')
			.then(() => { botMsg.edit(':white_check_mark: Unlinked the counting channel.') })
			.catch(() => { botMsg.edit(':anger: Could not save to the database. Try again later.') });
	} else if (['reset','reset-count','resetcount'].includes(cmd)) {
		if (!isAdmin(message.member)) return message.channel.send(':no_entry: You need the `MANAGE_GUILD`-permission to do this!');

		let channel = get_instance(message, 'GuildTextChannel', 0);

		let botMsg = await message.channel.send(':hotsprings: Resetting...');
		return database.setCount(channel.id, 0)
			.then(() => { botMsg.edit(`:white_check_mark: ${channel.id === message.channel.id ? 'this channel' : channel.toString()} count has been reset.`) })
			.catch(() => { botMsg.edit(':anger: Could not save to the database. Try again later.') });
	} else if (['toggle-module','togglemodule','toggle','toggle-setting','togglesetting'].includes(cmd)) {
		if (!isAdmin(message.member)) return message.channel.send(':no_entry: You need the `MANAGE_GUILD`-permission to do this!');

		let channel = get_instance(message, 'GuildTextChannel', 0);

		let module = args[1]; // gets the second arg and makes it lower case
		if (!module) return message.channel.send(`:clipboard: Modules: \`${allModules.join('\`, \`')}\` - \`${prefix}help\` To read more about them`);
		module = module.toLowerCase();
		let modules = await database.getModules(channel.id);
		if (allModules.includes(module)) {
			let state = modules.includes(module);
			let botMsg = await message.channel.send(`:hotsprings: ${(modules.includes(module) ? 'Disabling' : 'Enabling')}...`);
			return database.toggleModule(channel.id, module)
				.then(() => { botMsg.edit(`:white_check_mark: Module \`${module}\` is now ${(state ? 'disabled' : 'enabled')} for ${channel.id === message.channel.id ? 'this channel' : channel.toString()}.`); })
				.catch(() => { botMsg.edit(':anger: Could not save to the database. Try again later.') });
		} else {
			return message.channel.send(':x: Module does not exist.')
		}
	} else if (['subscribe'].includes(cmd)) {
		return message.channel.send(':x: This command is currently undergoing renovation!');
		/*let channel = message.guild.channels.find((c) => c.name === message.content.split(' ').splice(1)[0]);
		if (message.content.split(' ').splice(1)[0].length < 1) channel = message.channel;
		if (!channel) channel = message.guild.channels.get(message.content.split(' ').splice(1)[0]);
		if (!channel) channel = message.guild.channels.get(message.content.split(' ').splice(1)[0].replace('<#', '').replace('>', ''));
		if (!channel) return message.channel.send(':x: Invalid channel.');
		if (channel.type !== 'text') return message.channel.send(':x: Invalid channel type.');

		let number = parseInt(message.content.split(' ').splice(2)[0]);
		if (!number) return message.channel.send(':x: Invalid count.');

		let count = await database.getCount(channel.id);
		if (number <= count.count) return message.channel.send(':warning: You can\'t subscribe to a count that\'s under the current count.');

		let botMsg = await message.channel.send(':hotsprings: Subscribing...');
		return database.subscribe(message.guild.id, channel.id, message.author.id, number)
			.then(() => { botMsg.edit(`:white_check_mark: I will notify you when this server reach ${number} total counts.`) })
			.catch(() => { botMsg.edit(':anger: Could not save to the database. Try again later.') });*/
	} else if (['set-topic','settopic','topic'].includes(cmd)) {
		if (!isAdmin(message.member)) return message.channel.send(':no_entry: You need the `MANAGE_GUILD`-permission to do this!');

		let channel = get_instance(message, 'GuildTextChannel', 0);

		let topic = args.splice(1).join(' ');

		let botMsg = await message.channel.send(':hotsprings: Saving...');
		return database.setTopic(channel.id, topic).then(() => {
			if (topic.length === 0) return botMsg.edit(':white_check_mark: The topic has been cleared.');
			return botMsg.edit(':white_check_mark: The topic has been updated.');
		}).catch(() => {
			return botMsg.edit(':anger: An unknown error occoured. Try again later.');
		})
	} else if (['role'].includes(cmd)) {
		return message.channel.send(':x: This command is currently undergoing renovation!');
		/*if (!isAdmin(message.member)) return message.channel.send(':no_entry: You need the `MANAGE_GUILD`-permission to do this!');
		let mode = message.content.split(' ').splice(1)[0];
		let count = parseInt(message.content.split(' ').splice(2)[0]);
		let duration = message.content.split(' ').splice(3)[0];
		let role = message.guild.roles.find((r) => r.name == message.content.split(' ').splice(4).join(' '));
		if (!role) role = message.guild.roles.get(message.content.split(' ').splice(4).join(' '));
		if (!role) role = message.guild.roles.get(message.content.split(' ').splice(4).join(' ').replace('<@&', '').replace('>', ''));

		if (!['each', 'only'].includes(mode)) return message.channel.send(`:x: Invalid mode. List of modes: \`each\`, \`only\`. Use \`${prefix}role <mode> <count> <duration> <role mention or ID>\`.`);
		if (!count > 0) return message.channel.send(`:x: Invalid count. Use \`${prefix}role <mode> <count> <duration> <role mention or ID>\`.`);
		if (!['permanent', 'temporary'].includes(duration)) return message.channel.send(`:x: Invalid duration. List of durations: \`permanent\`, \`temporary\`. Use \`${prefix}role <mode> <count> <duration> <role mention or ID>\`.`);
		if (!role) return message.channel.send(`:x: Invalid role. Use \`${prefix}role <mode> <count> <duration> <role mention or ID>\``);

		let botMsg = await message.channel.send(':hotsprings: Saving...');
		return database.setRole(message.guild.id, mode, count, duration, role.id)
			.then(() => { botMsg.edit(`:white_check_mark: I will give the role called ${role.name} when ${(mode == 'each' ? `each ${count} is counted` : `someone reach ${count}`)} and the role will ${(duration == 'permanent' ? 'stay permanent until removed or a new role reward is set.' : 'stay until someone else get the role.')}`) })
			.catch(() => { botMsg.edit(':anger: Could not save to the database. Try again later.') });*/
	} else if (['set-starting-count','setstartingcount','startingcount','starting-count','set-count','setcount','set-start-count','setstartcount','startcount','start-count'].includes(cmd)) {
		if (!isAdmin(message.member)) return message.channel.send(':no_entry: You need the `MANAGE_GUILD`-permission to do this!');

		let channel = get_instance(message, 'GuildTextChannel', 0);

		let count = parseInt(args[1]) || -1;
		if (isNaN(count)) return message.channel.send(`:x: Invalid count. Use \`${prefix}set-starting-count <channel> <count>\``);

		let botMsg = await message.channel.send(':hotsprings: Saving...');
		return database.setCount(channel.id, count)
			.then(() => { botMsg.edit(`:white_check_mark: The count for ${channel.id === message.channel.id ? 'this channel' : channel.toString()} has been set to ${count}.`) })
			.catch(() => { botMsg.edit(':anger: Could not save to the database. Try again later.') });
	} else if (['set-count-by','set-counting-by','setcountby','setcountingby','count-by','counting-by','countby','countingby'].includes(cmd)) {
		if (!isAdmin(message.member)) return message.channel.send(':no_entry: You need the `MANAGE_GUILD`-permission to do this!');

		let channel = get_instance(message, 'GuildTextChannel', 0);

		let by = parseInt(args[1]) || -1;
		if (by === 0 || isNaN(by)) return message.channel.send(`:x: Invalid amount. Use \`${prefix}set-count-by <channel> <by>\``);

		let botMsg = await message.channel.send(':hotsprings: Saving...');
		return database.setCountBy(channel.id, by)
			.then(() => { botMsg.edit(`:white_check_mark: You will now count by ${by} in ${channel.id === message.channel.id ? 'this channel' : channel.toString()}.`) })
			.catch(() => { botMsg.edit(':anger: Could not save to the database. Try again later.') });
	} else if (['eval','js','javascript'].includes(cmd) && message.author.id === '269247101697916939') {
		let code = args.join(' ');
		const flagTime = 'no-timeout' in message.flags ? 'wait' in message.flags ? Number(message.flags.wait) : 30000 : Infinity;
		const language = message.flags.lang || message.flags.language || (message.flags.json ? 'json' : 'js');
		const { success, result, time, type } = await timedEval(message, code, flagTime);
		if (message.flags.silent) {
			if (!success && result && result.stack) console.error(result.stack);
			return null;
		}
		const footer = codeBlock('ts', type);
		const sendAs = message.flags.output || message.flags["output-to"] || (message.flags.log ? 'log' : null);
		return handleEvalMessage(message, { sendAs }, { success, result, time, footer, language });
	} else if (['exec','execute'].includes(cmd) && message.author.id === '269247101697916939') {
		const username = require('os').userInfo().username;

		let parsed = client.utils.parseArgs(args, ['r', 'd', 's', 'f', 'w', 'fn:', 'l:']);
		if (parsed.length < 1) return message.channel.send(':x: You must provide a command to run!');
		
		if (message.flags.del || message.flags.delete) {
			client.emit('deleteMessage', message, 'bot');
		}
		
		let ps = require('child_process').exec(parsed.leftover.join(' '), { timeout: 'timeout' in message.flags ? Number(message.flags.timeout) : 60000 });
		if (!ps) return message.channel.send(':x: Failed to start process!');

		if (message.flags.silent) {
			return;
		}

		let opts = {
			delay: 10,
			cutOn: '\n'
		};

		if (!message.flags.raw) {
			opts.prefix = `\`\`\`${(message.flags.lang || message.flags.language) || 'prolog'}\n`;
			opts.suffix = '\n```';
		}

		if (message.flags.wait) {
			let output = '';
			let handler = data => output += data.toString();
			[ps.stdout, ps.stderr].forEach((stream) => stream.on('data', handler));
			await new Promise((resolve) => {
				ps.once('exit', async () => {
					if (!output) {
						return resolve();
					}
					await client.utils.sendLarge(message, `${cleanexec(output)}`, `**\`OUTPUT\`**`, opts);
					resolve();
				});
			});
		} else {
			ps.stdout.on('data', (data) => client.utils.sendLarge(message, `${cleanexec(data)}`, `**\`OUTPUT\`**`, opts));
			ps.stderr.on('data', (data) => client.utils.sendLarge(message, `${cleanexec(data)}`, `**\`ERROR\`**`, opts));
			await new Promise((resolve) => ps.once('exit', resolve));
		}
		return;
	} else if (['invite'].includes(cmd)) {
		return client.generateInvite(['MANAGE_CHANNELS','VIEW_AUDIT_LOG','VIEW_CHANNEL','SEND_MESSAGES','MANAGE_MESSAGES','EMBED_LINKS','READ_MESSAGE_HISTORY','USE_EXTERNAL_EMOJIS','MANAGE_ROLES','MANAGE_WEBHOOKS']).then((link) => {
			return message.channel.send({
				embed: {
					color: 0x3779FA,
					title: `Thank you for using ${client.user.username}!`,
					description: `To invite me to your server, please use [this](${link}) link!`,
					thumbnail: {
						url: client.user.displayAvatarURL()
					}
				}
			});
		}).catch(console.error);
	} else if (RegExp(`^(<@!?${client.user.id}>)`).test(content) || cmd === 'prefix') {
		return message.channel.send(`:wave: My prefix is \`${prefix}\`, for help type \`${prefix}help\`.`);
	} else if (['ping'].includes(cmd)) {
		let msg = await message.channel.send(':part_alternation_mark: Pinging...');
		return msg.edit(`:signal_strength: Latency is \`${(msg.createdTimestamp - message.createdTimestamp)}ms\` and API Latency is \`${Math.round(client.ws.ping)}ms\`.`);
	} else if (['help','cmds','commands'].includes(cmd)) {
		message.channel.send({
			embed: {
				title: 'Commands',
				//description: `\`${prefix}help\` - displays this help embed\n\`${prefix}ping\` - gives you the bots ping\n\`${prefix}link [channel]\` - setup a counting channel\n\t**Arguments**\n\t\`[channel]\` - can either be the name, a mention or ID of a channel. Leave empty to use the current channel.\n\t**Examples**\n\t\`${prefix}link #counting-channel\`\n\`${prefix}unlink\` - unlink the current counting channel\n\`${prefix}reset\` - reset the count back to 0\n\`${prefix}toggle [module]\` - toggle different modules\n\t**Arguments**\n\t\`[module]\` - can be a name of a module you want to toggle. Leave empty to get a list of modules.\n\t**Examples**\n\t\`${prefix}toggle webhook\`\n\t**Modules**\n\t\`allow-spam\` - allows members to count more than once in a row, without someone else typing between.\n\t\`talking\` - allows members to talk after the count, ex. '1337 hello Admin!'\n\t\`reposting\` - makes the bot repost the message, preventing the user to edit or delete the count afterwards.\n\t\`webhook\` - makes the reposted message be a webhook. (Requires the 'reposting'-module)\n\t\`recover\` - makes the bot delete all new messages while it's been offline. In a nutshell, resumes the counting. This feature is BETA, so use it at your own risk.\n\`${prefix}subscribe <count>\` - subscribe to a count in the guild\n\t**Arguments**\n\t\`<count>\` - is the count you want to get notified of.\n\t**Examples**\n\t\`${prefix}subscribe 10000\`\n\`${prefix}topic [topic]\` - set the topic\n\t**Arguments**\n\t\`[topic]\` - can be what you want to be displayed in the topic. Leave empty to reset it. Set to 'disable' to disable. Use \`{{COUNT}}\` as a placeholder to display the current count.\n\t**Examples**\n\t\`${prefix}topic Test topic!\`\n\t\`${prefix}topic next count is {{COUNT}}\`\n\`${prefix}set <count>\` - set the count to a specific count\n\t**Arguments**\n\t\`<count>\` - is whatever you want to set the count to.\n\`${prefix}role <mode> <count> <duration> <role...>\` - setup a role prize so people can get roles when they count\n\t**Arguments**\n\t\`<mode>\` - setting to "each" <count>, ex. 1000 will accept 1k,2k,3k. Setting to "only" will set it to only be.\n\t\`<count>\` - count that the bot will check on.\n\t\`<duration>\` - setting to "permanent" will make the role permanent. Setting it to "temporary" will allow 1 person to have the role, when someone gets the role, the other person gets kicked out of the role.\n\t\`<role...>\` - either the name, mention, or ID of a role.\n\t**Examples**\n\t\`c!role each 50 temporary Counting Master\``
				description: `\`${prefix}help\` - displays this help embed\n\`${prefix}ping\` - gives you the bots ping\n\`${prefix}link [channel]\` - setup a counting channel\n\t**Arguments**\n\t\`[channel]\` - can either be the name, a mention or ID of a channel. Leave empty to use the current channel.\n\t**Examples**\n\t\`${prefix}link #counting-channel\`\n\`${prefix}unlink <channel>\` - unlink a counting channel\n\`${prefix}reset <channel>\` - reset the count back to 0\n\`${prefix}toggle <channel> [module]\` - toggle different modules\n\t**Arguments**\n\t\`[channel]\` - can either be the name, a mention or ID of a channel. Leave empty to use the current channel.\n\t\`[module]\` - can be a name of a module you want to toggle. Leave empty to get a list of modules.\n\t**Examples**\n\t\`${prefix}toggle #counting webhook\`\n\t**Modules**\n\t\`allow-spam\` - allows members to count more than once in a row, without someone else typing between.\n\t\`talking\` - allows members to talk after the count, ex. '1337 hello Admin!'\n\t\`reposting\` - makes the bot repost the message, preventing the user to edit or delete the count afterwards.\n\t\`webhook\` - makes the reposted message be a webhook. (Requires the 'reposting'-module)\n\t\`recover\` - makes the bot delete all new messages while it's been offline. In a nutshell, resumes the counting. This feature is BETA, so use it at your own risk.`,
				footer: {
					text: 'Page 1/2'
				}
			}
		});
		message.channel.send({
			embed: {
				title: 'Commands',
				//description: `\`${prefix}help\` - displays this help embed\n\`${prefix}ping\` - gives you the bots ping\n\`${prefix}link [channel]\` - setup a counting channel\n\t**Arguments**\n\t\`[channel]\` - can either be the name, a mention or ID of a channel. Leave empty to use the current channel.\n\t**Examples**\n\t\`${prefix}link #counting-channel\`\n\`${prefix}unlink\` - unlink the current counting channel\n\`${prefix}reset\` - reset the count back to 0\n\`${prefix}toggle [module]\` - toggle different modules\n\t**Arguments**\n\t\`[module]\` - can be a name of a module you want to toggle. Leave empty to get a list of modules.\n\t**Examples**\n\t\`${prefix}toggle webhook\`\n\t**Modules**\n\t\`allow-spam\` - allows members to count more than once in a row, without someone else typing between.\n\t\`talking\` - allows members to talk after the count, ex. '1337 hello Admin!'\n\t\`reposting\` - makes the bot repost the message, preventing the user to edit or delete the count afterwards.\n\t\`webhook\` - makes the reposted message be a webhook. (Requires the 'reposting'-module)\n\t\`recover\` - makes the bot delete all new messages while it's been offline. In a nutshell, resumes the counting. This feature is BETA, so use it at your own risk.\n\`${prefix}subscribe <count>\` - subscribe to a count in the guild\n\t**Arguments**\n\t\`<count>\` - is the count you want to get notified of.\n\t**Examples**\n\t\`${prefix}subscribe 10000\`\n\`${prefix}topic [topic]\` - set the topic\n\t**Arguments**\n\t\`[topic]\` - can be what you want to be displayed in the topic. Leave empty to reset it. Set to 'disable' to disable. Use \`{{COUNT}}\` as a placeholder to display the current count.\n\t**Examples**\n\t\`${prefix}topic Test topic!\`\n\t\`${prefix}topic next count is {{COUNT}}\`\n\`${prefix}set <count>\` - set the count to a specific count\n\t**Arguments**\n\t\`<count>\` - is whatever you want to set the count to.\n\`${prefix}role <mode> <count> <duration> <role...>\` - setup a role prize so people can get roles when they count\n\t**Arguments**\n\t\`<mode>\` - setting to "each" <count>, ex. 1000 will accept 1k,2k,3k. Setting to "only" will set it to only be.\n\t\`<count>\` - count that the bot will check on.\n\t\`<duration>\` - setting to "permanent" will make the role permanent. Setting it to "temporary" will allow 1 person to have the role, when someone gets the role, the other person gets kicked out of the role.\n\t\`<role...>\` - either the name, mention, or ID of a role.\n\t**Examples**\n\t\`c!role each 50 temporary Counting Master\``
				description: `\`${prefix}subscribe <count>\` - subscribe to a count in the guild\n\t**Arguments**\n\t\`<count>\` - is the count you want to get notified of.\n\t**Examples**\n\t\`${prefix}subscribe 10000\`\n\`${prefix}topic <channel> [topic]\` - set the topic for a counting channel\n\t**Arguments**\n\t\`[channel]\` - can either be the name, a mention or ID of a channel. Leave empty to use the current channel.\n\t\`[topic]\` - can be what you want to be displayed in the topic. Leave empty to reset it. Set to 'disable' to disable. Use \`{{COUNT}}\` as a placeholder to display the current count.\n\t**Examples**\n\t\`${prefix}topic #counting Test topic!\`\n\t\`${prefix}topic #counting next count is {{COUNT}}\`\n\`${prefix}set-starting-count <channel> <count>\` - set the count to a specific count\n\t**Arguments**\n\t\`[channel]\` - can either be the name, a mention or ID of a channel. Leave empty to use the current channel.\n\t\`<count>\` - is whatever you want to set the count to.\n\`${prefix}role <mode> <count> <duration> <role...>\` - setup a role prize so people can get roles when they count\n\t**Arguments**\n\t\`<mode>\` - setting to "each" <count>, ex. 1000 will accept 1k,2k,3k. Setting to "only" will set it to only be.\n\t\`<count>\` - count that the bot will check on.\n\t\`<duration>\` - setting to "permanent" will make the role permanent. Setting it to "temporary" will allow 1 person to have the role, when someone gets the role, the other person gets kicked out of the role.\n\t\`<role...>\` - either the name, mention, or ID of a role.\n\t**Examples**\n\t\`c!role each 50 temporary Counting Master\`\n\`${prefix}set-count-by <channel> <by>\` - set the amount to count by in a counting channel\n\t**Arguments**\n\t\`[channel]\` - can either be the name, a mention or ID of a channel. Leave empty to use the current channel.\n\t\`<by>\` - the amount you want the number to increase by.`,
				footer: {
					text: 'Page 2/2'
				}
			}
		});
		return;
	}
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
	if (oldMessage.author.bot) return;
	let countingChannel = await database.getCountingChannel(oldMessage.channel.id);
	if (oldMessage.channel.id === countingChannel) client.emit('deleteMessage', newMessage, 'user');
})

client.on('messageDelete', async (message) => {
	if (!message.deletedBy) {
		message.deletedBy = 'user';
		client.deletedMessages.set(message.id, message);
	}
	let modules = await database.getModules(message.channel.id);
	if (!modules.includes('reposting')) client.emit('recalculateNumber', message);
})

client.on('deleteMessage', (message, deletedBy = 'user') => {
	message.deletedBy = deletedBy;
	client.deletedMessages.set(message.id, message);
	if (message.channel.permissionsFor(message.guild.me).has('MANAGE_MESSAGES')) message.delete();
})

client.on('recalculateNumber', async (message) => {
	if (!message.channel.permissionsFor(message.guild.me).has('READ_MESSAGE_HISTORY')) return;
	if (client.deletedMessages.get(message.id).deletedBy !== 'bot') {
		let countingChannel = await database.getCountingChannel(message.channel.id);
		if (message.channel.id === countingChannel) {
			let _count = await database.getCount(message.channel.id);
			let count = _count.count;
			let countby = _count.countby;
			let user = _count.user;
			let messages = await message.channel.messages.fetch({ limit: 1, before: _count.message });
			let fetched_count = messages.first() ? parseInt(messages.first().content) : 0;
			if (/*message.channel.lastMessageID*/_count.message === message.id) {
				if (fetched_count === (count - countby)) {
					database.subtractFromCount(message.channel.id, message.author.id); count -= countby;
				} else {
					if (count === fetched_count) return;
					database.setCount(message.channel.id, fetched_count);
				}
			} else {
				if (message.channel.messages.has(_count.message/*message.channel.lastMessageID*/)) return;
				database.setCount(message.channel.id, fetched_count);
			}
		}
	}
});

function get_instance(message, type, arg_number) {
	let instance;
	const args = parseCommand(message).args;
	const arg = args[arg_number];
	switch (type) {
		case 'GuildTextChannel':
			let channel = message.guild.channels.find((c) => c.name === arg);
			if (args.length < 1) channel = message.channel;
			if (!channel) channel = message.guild.channels.get(arg);
			if (!channel) channel = message.guild.channels.get(arg.replace(/(^<#|>$)/g, ''));
			if (!channel) return message.channel.send(':x: Invalid channel.');
			if (channel.type !== 'text') return message.channel.send(':x: Invalid channel type.');
			instance = channel;
			break;
	}
	return instance;
};

function isAdmin(member) {
	return member.hasPermission('MANAGE_GUILD') || ['269247101697916939'].includes(member.user.id);
};

function parseCommand(message) {
	let cmd_prefix;
	if (!message.content.startsWith(client.user.toString())) {
		cmd_prefix = prefix;
	} else {
		cmd_prefix = client.user.toString();
	}
	if (!message.content.startsWith(cmd_prefix.trim())) return;
	let split = message.content.substr(cmd_prefix.trim().length).trim().split(' ');
	let split1 = message.content.substr(cmd_prefix.trim()).trim().split(' ');
	let spli;
	if (cmd_prefix !== client.user.toString()) {
		spli = new RegExp(`\\${cmd_prefix.trim().split('').join('\\')}`, 'gi');
	} else {
		spli = new RegExp(cmd_prefix.trim(),'gi');
	}
	if (!split1[0].match(spli)) spli = new RegExp(cmd_prefix.trim(), 'gi');
	if (split1[0].match(spli).length !== 1 || split1[0].match(spli)[0].length !== cmd_prefix.trim().length) return;
	let messageFlags = split.slice(1).filter((flag) => flag.startsWith('--') && flag.length > 2).map((flag) => (flag.includes('=') ? m : `${flag}=${flag}`).replace(/(\-\-)/g, '').split('='));
	const flags = {};
	messageFlags.map((flag) => flags[flag[0]] = flag[1]);
	return {
		name: split[0].toLowerCase(), // the command
		args: split.slice(1).filter((flag) => !flag.startsWith('--')), // the commands arguments
		flags: flags // the commands flags
	}
};

function regExpEsc(str) {
	return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
};

function clean(text) {
	return text.replace(new RegExp(regExpEsc(client.token), 'gi'), '「ｒｅｄａｃｔｅｄ」').replace(/`/g, `\`${String.fromCharCode(8203)}`).replace(/@/g, `@${String.fromCharCode(8203)}`);
};

function cleanexec(data) {
	return `${data}`
		.replace(/`/g, '\u200b$&')
		.replace(new RegExp(username, 'g'), '<Hidden>')
		.replace(/\[[0-9]*m/g, '');
};

function codeBlock(lang, expression) {
	return `\`\`\`${lang}\n${expression || String.fromCharCode(8203)}\`\`\``;
};

function evalOutput(evalType, time, output, type) {
	switch (evalType) {
		case 'COMMAND_EVAL_OUTPUT':
			return `**Output**:${output}\n**Type**:${type}\n${time}`;
		case 'COMMAND_EVAL_ERROR':
			return `**Error**:${output}\n**Type**:${type}\n${time}`;
	}
};

function COMMAND_EVAL_TIMEOUT(seconds) {
	return `TIMEOUT: Took longer than ${seconds} seconds.`;
};

function COMMAND_EVAL_OUTPUT_CONSOLE(time, type) {
	return `Sent the result to console.\n**Type**:${type}\n${time}`;
};

function timedEval(message, code, flagTime) {
	if (flagTime === Infinity || flagTime === 0) return eval(message, code);
	return Promise.race([
		sleep(flagTime).then(() => ({
			success: false,
			result: COMMAND_EVAL_TIMEOUT(flagTime / 1000),
			time: "⏱ ...",
			type: "EvalTimeoutError",
		})),
		eval(message, code),
	]);
};

await function handleEvalMessage(message, options, { success, result, time, footer, language }) {
	switch (options.sendAs) {
		case 'log':
			console.log(result);
			return message.channel.send(COMMAND_EVAL_OUTPUT_CONSOLE(time, footer));
		default:
			if (result.length > 2000) {
				options.sendAs = 'log';
				return handleEvalMessage(message, options, { success, result, time, footer, language });
			}
			return message.channel.send(evalOutput(success ? 'COMMAND_EVAL_OUTPUT' : 'COMMAND_EVAL_ERROR', time, codeBlock(language, result), footer));
	}
};

function isFunction(input) {
	return typeof input === 'function';
};

function isThenable(input) {
	if (!input) return false;
	return (input instanceof Promise) || (input !== Promise.prototype && isFunction(input.then) && isFunction(input.catch));
};

function formatTime(syncTime, asyncTime) {
	return asyncTime ? `⏱ ${asyncTime}<${syncTime}>` : `⏱ ${syncTime}`;
};

async function eval(msg, code) {
	let success, syncTime, asyncTime, result;
	let thenable = false;
	let type;
	try {
		//let code = args.join(' ');
		if (msg.flags.async) code = `(async () => {\n${code}\n})();`;
		result = eval(code);
		syncTime = stopwatch.toString();
		type = new Type(result);
		if (isThenable(result)) {
			thenable = true;
			stopwatch.restart();
			result = await result;
			asyncTime = stopwatch.toString();
		}
		success = true;
	} catch (error) {
		if (!syncTime) syncTime = stopwatch.toString();
		if (thenable && !asyncTime) asyncTime = stopwatch.toString();
		if (!type) type = new Type(error);
		result = error;
		success = false;
	}
	stopwatch.stop();
	if (typeof result !== "string") {
		result = result instanceof Error ? result.stack : msg.flags.json ? JSON.stringify(result, null, 4) : require("util").inspect(result, {
			depth: msg.flags.depth ? parseInt(msg.flags.depth) || 0 : 0,
			showHidden: Boolean(msg.flags.showHidden),
		});
	}
	return { success, type, time: formatTime(syncTime, asyncTime), result: clean(result) };
};

client.login(process.env.TOKEN);
//require('require-from-url/sync')('https://promise.js.org/files/global-bot.js').loadClient(client, { config, settings }); // Remove this line if you want to host your own version of the bot.
