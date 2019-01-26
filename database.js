const mongoose = require("mongoose");
mongoose.connect(process.env.database_uri/*JSON.parse(require("fs").readFileSync("./config.json")).database_uri*/, { useNewUrlParser: true });

/*const guildSchema = mongoose.Schema({
  guildid: String,
  countingchannels: {
    channelid: String,
    guildid: String,
    count: Number,
    countby: Number,
    user: String,
    modules: [],
    subscriptions: {},
    channeltopic: String,
    message: String
  }*/
  //channel: String,
  //count: Number,
  //countby: Number,
  //user: String,
  //modules: [],
  //subscriptions: {}, // deprecated
  //topic: String,
  //message: String
//}, { minimize: false })

const channelSchema = mongoose.Schema({
  channelid: String,
  count: Number,
  countby: Number,
  //guildid: String,
  message: String,
  modules: [],
  subscriptions: {}, // deprecated
  channeltopic: String,
  user: String
}, { minimize: false })

const subscribeSchema = mongoose.Schema({
  channelid: String,
  count: Number,
  guildid: String,
  user: String
}, { minimize: false })

const roleSchema = mongoose.Schema({
  count: Number,
  duration: String,
  guildid: String,
  mode: String,
  roleid: String
}, { minimize: false })

let savedChannels = {}
let timeoutChannels = {}

//const Guild = mongoose.model("Guild", guildSchema);
const Channel = mongoose.model("Channel", channelSchema);
const Subscribe = mongoose.model("Subscribe", subscribeSchema);
const Role = mongoose.model("Role", roleSchema);

module.exports = function(client) { return {
    saveCountingChannel(channelid, newchannelid) {
        return new Promise(async function(resolve, reject) {
            await cacheChannel(channelid);
            savedChannels[channelid].channelid = newchannelid;

            let channel = await getChannel(channelid);
            channel.channelid = savedChannels[channelid].channelid;
            channel.save().then(resolve).catch(reject);
        });
    },
    getCountingChannel(channelid) {
        return new Promise(async function(resolve, reject) {
            let channel = await cacheChannel(channelid);
            resolve(channel.channelid)
        })
    },
    addToCount(channelid, userid) {
        return new Promise(async function(resolve, reject) {
            await cacheChannel(channelid);
            savedChannels[channelid].count += savedChannels[channelid].countby;
            savedChannels[channelid].user = userid;
          
            let channel = await getChannel(channelid);
            channel.count = savedChannels[channelid].count;
            channel.user = savedChannels[channelid].user;
            await channel.save().then(resolve).catch(reject);
            updateTopic(channelid, client)
        })
    },
    setLastMessage(channelid, message) {
        return new Promise(async function(resolve, reject) {
            await cacheChannel(channelid);
            savedChannels[channelid].message = message;
          
            let channel = await getChannel(channelid);
            channel.message = savedChannels[channelid].message;
            await channel.save().then(resolve).catch(reject);
        })
    },
    getCount(channelid) {
        return new Promise(async function(resolve, reject) {
            let channel = await cacheChannel(channelid);
            resolve({ "count": channel.count, "countby": channel.countby, "user": channel.user, "message": channel.message })
        })
    },
    setCount(channelid, count) {
        return new Promise(async function(resolve, reject) {
            await cacheChannel(channelid);
            savedChannels[channelid].count = count;
            savedChannels[channelid].user = '';
          
            let channel = await getChannel(channelid);
            channel.count = savedChannels[channelid].count;
            channel.user = savedChannels[channelid].user;
            await channel.save().then(resolve).catch(reject);
            updateTopic(channelid, client)
        })
    },
    setCountBy(channelid, by) {
      return new Promise(async function(resolve, reject) {
            await cacheChannel(channelid);
            savedChannels[channelid].countby = by;
            savedChannels[channelid].user = '';
          
            let channel = await getChannel(channelid);
            channel.countby = savedChannels[channelid].countby;
            channel.countingchannels[channelid].user = savedChannels[channelid].user;
            await channel.save().then(resolve).catch(reject);
            updateTopic(channelid, client)
        })
    },
    toggleModule(channelid, moduleStr) {
        return new Promise(async function(resolve, reject) {
            await cacheChannel(channelid);
            if (savedChannels[channelid].modules.includes(moduleStr)) savedChannels[channelid].modules = savedChannels[channelid].modules.filter((str) => str !== moduleStr)
            else savedChannels[channelid].modules.push(moduleStr)

            let channel = await getChannel(channelid);
            channel[channelid].modules = savedChannels[channelid].modules
            channel.save().then(resolve).catch(reject);
        })
    },
    getModules(channelid) {
        return new Promise(async function(resolve, reject) {
            let channel = await cacheChannel(channelid);
            resolve(channel.modules);
        })
    },
    /*subscribe(guildid, userid, count) {
        return new Promise(async function(resolve, reject) {
            Subscribe.findOne({
                guildid: guildid,
                user: userid,
                count: count
              }, (err, subscribe) => {
                if (err) return reject(err);
                if (!subscribe) subscribe = new Subscribe({
                  guildid: guildid,
                  user: userid,
                  count: count
                });
                
                subscribe.save().then(resolve).catch(reject);
              });
        })
    },
    checkSubscribed(guildid, count, countUser, messageID) {
        return new Promise(async function(resolve, reject) {
            let guild = await getGuild(guildid);

            let subs = await new Promise(function(resolve, reject) {
                Subscribe.find({
                    guildid: guildid,
                    count: count
                }, (err, subscribes) => {
                    if (err) return reject(err);
                    let subs = [];
                    subscribes.forEach((sub) => {
                        subs.push(sub.user);
                        Subscribe.deleteOne({
                            guildid: guildid,
                            user: sub.user,
                            count: count
                        }, function(err) {})
                    });
            
                    return resolve(subs);
                });
            })

            await subs.forEach(async (userID) => {
                try { await client.guilds.get(guildid).members.get(userID).send("The guild " + client.guilds.get(guildid).name + " just reached " + count + " total counts! :tada:\nThe user who sent it was <@" + countUser + ">\n[<https://discordapp.com/channels/" + guildid + "/" + guild.countingchannels[channelid].channelid + "/" + messageID + ">]"); } catch(e) {}
            });

            resolve(true)
        })
    },*/
    setTopic(channelid, topic) {
        return new Promise(async function(resolve, reject) {
            await cacheChannel(channelid);
            if (['disable', ''].includes(savedChannels[channelid].channeltopic)) savedChannels[channelid].channeltopic = topic; else savedChannels[channelid].channeltopic = topic + (topic.includes("{{COUNT}}") ? "" : (topic == "" ? "" : " | ") + "**Next count:** {{COUNT}}")
          
            let channel = await getChannel(channelid);
            channel.channeltopic = savedChannels[channelid].channeltopic;
            await channel.save().then(resolve).catch(reject);
            updateTopic(channelid, client)
        })
    },
    getTopic(channelid) {
        return new Promise(async function(resolve, reject) {
            let channel = await cacheChannel(channelid);
            resolve(channel.channeltopic)
        })
    },
    getChannelCount() {
        /*return new Promise(async function(resolve, reject) {
            
            Guild.find({}, (err, guilds) => {
                if (err) return reject(err);
                let count = 0;
                guilds.forEach((guild) => { guild.countingchannels.forEach((channel) => { if (channel.channelid) count += 1; }) })

                return resolve(count);
            })
        })*/
        return client.guilds.size;
    },
    /*setRole(guildid, mode, count, duration, roleid) {
        return new Promise(async function(resolve, reject) {
            Role.findOne({
                guildid: guildid,
                roleid: roleid
            }, (err, role) => {
                if (err) return reject(err);
                if (!role) role = new Role({
                    guildid: guildid,
                    roleid: roleid
                })

                role.mode = mode;
                role.count = count;
                role.duration = duration;
                role.save().then(resolve).catch(reject);
            })

        })
    },
    checkRole(guildid, count, userid) {
        return new Promise(async function(resolve, reject) {
            Role.find({
                guildid: guildid
            }, async (err, roles) => {
                if (err) return reject(err);
                roles.forEach((roleInfo) => {
                    if ((roleInfo.mode == 'each' && Number.isInteger(count / roleInfo.count)) || (roleInfo.mode == 'once' && count == roleInfo.count)) {
                        try {
                            if (roleInfo.duration == 'temporary') client.guilds.get(guildid).roles.find((r) => r.id == roleInfo.roleid).members.filter((m) => m.id != userid).forEach((member) => { member.removeRole(client.guilds.get(guildid).roles.find((r) => r.id == roleInfo.roleid), "Counting Role") })
                            client.guilds.get(guildid).members.get(userid).addRole(client.guilds.get(guildid).roles.find((r) => r.id == roleInfo.roleid), 'Counting Role')
                        } catch(e) {}
                    }
                })
            })
        })
    }*/
}}

function getChannel(channelid) {
    return new Promise(function(resolve, reject) {
        Channel.findOne({
          channelid: channelid
        }, (err, channel) => {
            if (err) return reject(err);
            if (!channel) {
                let newChannel = new Channel({
                  channelid: channelid,
                  count: 0,
                  countby: 1,
                  //guildid: guildid,
                  message: '',
                  modules: [],
                  subscriptions: {},
                  channeltopic: '',
                  user: ''
                })

                return resolve(newChannel);
            } else return resolve(channel);
        })
    })
}

function updateTopic(channelid, client) {
    return new Promise(async function(resolve, reject) {
        let channel = await getChannel(channelid);
        try {
            if (channel.channeltopic === "") await client.channels.get(channel.channelid).setTopic("**Next count:** " + (channel.count + channel.countby))
            else if (channel.channeltopic !== "disable") await client.channels.get(channel.channelid).setTopic(channel.channeltopic.replace("{{COUNT}}", (channel.count + channel.countby)))
        } catch(e) {}
        resolve(true);
    })
}

async function cacheChannel(channelid) {
    if (!savedChannels[channelid]) {
        let channel = await getChannel(channelid);
        savedChannels[channelid] = {};
        //savedGuilds[guildid].guildid = guild.guildid;
        //if (!savedGuilds[guildid].countingchannels) {
        //}
        savedChannels[channelid].count = channel.count;
        savedChannels[channelid].countby = channel.countby;
        savedChannels[channelid].guildid = channel.guildid;
        savedChannels[channelid].user = channel.user;
        savedChannels[channelid].modules = channel.modules;
        savedChannels[channelid].channeltopic = channel.channeltopic;
        savedChannels[channelid].message = channel.message;

        /*savedGuilds[guildid] = {};
        savedGuilds[guildid].channel = guild.channel;
        savedGuilds[guildid].count = guild.count;
        savedGuilds[guildid].countby = guild.countby;
        savedGuilds[guildid].user = guild.user;
        savedGuilds[guildid].modules = guild.modules;
        savedGuilds[guildid].topic = guild.topic;
        savedGuilds[guildid].message = guild.message;*/
    }
    timeoutChannels[channelid] = 300;
    return savedChannels[channelid];
}

setInterval(() => { for (var i in timeoutChannels) {
    timeoutChannels[i] -= 1;
    if (timeoutChannels[i] < 1) {
        delete savedChannels[i];
        delete timeoutChannels[i];
    }
}}, 1000)
