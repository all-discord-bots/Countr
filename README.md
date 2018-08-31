<div style="background:white url(https://i.imgur.com/QiCG7sd.png) repeat fixed;">
<div align="center">
  
[![Discord Bots](https://discordbots.org/api/widget/status/467377486141980682.svg)](https://discordbots.org/bot/467377486141980682) [![Discord Bots](https://discordbots.org/api/widget/servers/467377486141980682.svg)](https://discordbots.org/bot/467377486141980682) [![Discord Bots](https://discordbots.org/api/widget/upvotes/467377486141980682.svg)](https://discordbots.org/bot/467377486141980682) [![Discord Bots](https://discordbots.org/api/widget/lib/467377486141980682.svg)](https://discordbots.org/bot/467377486141980682) [![Discord Bots](https://discordbots.org/api/widget/owner/467377486141980682.svg)](https://discordbots.org/bot/467377486141980682)

[![Discord Bots](https://discordbots.org/api/widget/467377486141980682.svg)](https://discordbots.org/bot/countr)

</div>

**Countr** is a simple counting bot and can be set up in 3 simple steps, explained.
1. Add the bot using [this](https://discordapp.com/api/oauth2/authorize?client_id=467377486141980682&permissions=11280&scope=bot) link. 
2. Make a channel (for example #counting-channel)
3. Type `c!channel` in the channel you created

That's it!

We have also made a bot tutorial on how to use the bot. [Watch the video on Vimeo.](https://vimeo.com/280228205)
** **
<big>Purpose</big>

There are different purposes:
- Guild administrators can give out prizes for each X counts
- They can also hype the members up by trying to get a milestone
- Or just have fun while counting to infinity.

** **
<big>Commands</big>

| Command & Usage       | Description                                           | Permissions    |
|:----------------------|:------------------------------------------------------|:---------------|
| `c!help` or `c!info`  | Get information about the bot                         |
| `c!channel`           | Set the channel to the guild's counting channel.      | `MANAGE_GUILD` |
| `c!channel none`      | Unlink the current channel.                           | `MANAGE_GUILD` |
| `c!reset`             | Reset the count back to 0.                            | `MANAGE_GUILD` |
| `c!toggle [module]`   | Toggle modules. Leave empty to get a list of modules. | `MANAGE_GUILD` |
| `c!subscribe <count>` | Subscribe to a count in the guild.                    |
| `c!topic [topic]`     | Set the topic. Leave empty to clear topic.            | `MANAGE_GUILD` |
| `c!set <count>`       | Set the count to a specific count                     | `MANAGE_GUILD` |

** **
<big>Modules</big>

| Module      | Description                                                                          | Bot Permissions   |
|:------------|:-------------------------------------------------------------------------------------|:------------------|
| `talking`   | Allow users to send a message after the count. Ex. `20 blabla`.                      |
| `reposting` | Make the bot repost the message, preventing the user to edit or delete the message.  | `EMBED_LINKS`     |
| `webhook`   | Make the bot send webhooks (requires the module `reposting`)                         | `MANAGE_WEBHOOKS` |

The *Bot Permissions* column shows what permissions the bot requires including the default ones. The default bot permissions are shown below.

** **
<big>Permissions</big>

If you're super pecky about giving bots permissions, read this:
- Read Messages
	- A basic permission that you should allow everyone to have. It requires to read the counting channel to see if there are any messages that are not part of the counting. It also requires to look for commands.
- Send Messages
	- Another basic permission. It requires to respond to the commands.
- Manage Channels
	- The topic of the channel is used to display the next number.
	- If you're going to restrict the bot's permissions to only work in the channel, you also need to give Countr "Manage Channels" in the category the channel is in. If it's not in a category, it's fine. (Bug report: https://github.com/discordjs/discord.js/issues/2533) 
- Manage Messages
	- If a message is not part of the counting or not the next number in the counting, it deletes it.

If you want to, you can make these permissions only work in the counting channel.

** **
<big>Contributors</big>

- `Main Developer and Designer` Promise - Gleeny (110090225929191424)
- `Helper and Beta Tester` GamesForDays (332209233577771008)

Since we can change our names on Discord whenever we want, you can find us on the [support server](https://discord.gg/JbHX5U3).

** **
<big>Vote for us</big>

To support us free, please vote on our bot at these bot sites:
- [DiscordBots.org](https://discordbots.org/bot/countr) (main bot site)

I don't like money donations, but a vote would mean a lot :)

** **
<big>Keep in mind!</big>

- To avoid spam of the bot and the channel, you can only send a number after someone else has.
- You can reset the counter with `c!reset` and change the count with `c!set`.
- If you want to bypass the deletion of a message, type `!` before the message. You can edit the message afterwards.
- The only information we store in our systems are:
	- The counting channel ID
	- How many counts in that channel
	- The user ID of the last count in that channel
	- Global counts (for the activity of the bot)
- By using our bot you also agree that changes can be made and downtime can occour.

Any other questions can go to our [support server](https://discord.gg/JbHX5U3).

** **

|:--|:--|
| [![Discord Bots](https://discordbots.org/api/widget/467377486141980682.svg)](https://discordbots.org/bot/countr) | Test 1 kek a lot abnout the bot aaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbb cccccccccccccccccccccccccc dddddddddddddddddddddddddddd eeeeeeeeeeeeeeeeeeeeeeeeee |
| [![Discord Bots](https://discordbots.org/api/widget/472842075310653447.svg)](https://discordbots.org/bot/472842075310653447) | hi |
| [![Discord Bots](https://discordbots.org/api/widget/475041313515896873.svg)](https://discordbots.org/bot/475041313515896873) | hi |