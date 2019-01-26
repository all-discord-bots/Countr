const mongoose = require("mongoose");
mongoose.connect(process.env.database_uri/*JSON.parse(require("fs").readFileSync("./config.json")).database_uri*/, { useNewUrlParser: true });

const guildSchema = mongoose.Schema({
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
    
  }
  //channel: String,
  //count: Number,
  //countby: Number,
  //user: String,
  //modules: [],
  //subscriptions: {}, // deprecated
  //topic: String,
  //message: String
}, { minimize: false })

/*const channelSchema = mongoose.Schema({
  channelid: String,
  count: Number,
  countby: Number,
  guildid: String,
  message: String,
  modules: [],
  subscriptions: {}, // deprecated
  topic: String,
  user: String
}, { minimize: false })*/

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

let savedGuilds = {}
let timeoutGuilds = {}

const Guild = mongoose.model("Guild", guildSchema);
//const Channel = mongoose.model("Channel", channelSchema);
const Subscribe = mongoose.model("Subscribe", subscribeSchema);
const Role = mongoose.model("Role", roleSchema);

module.exports = function(client) { return {
    saveCountingChannel(guildid, channelid) {
        return new Promise(async function(resolve, reject) {
            await cacheGuild(guildid, channelid);
            savedGuilds[guildid] = {
              countingchannels: {},
              guildid: guildid
            };
            savedGuilds[guildid].countingchannels[channelid] = {
              channelid: channelid,
              count: 0,
              countby: 1,
              guildid: guildid,
              message: '',
              modules: [],
              subscriptions: {}, // deprecated
              channeltopic: '',
              user: ''
            };

            let guild = await getGuild(guildid, channelid);
            guild.countingchannels = savedGuilds[guildid].countingchannels;
            guild.save().then(resolve).catch(reject);
        });
    },
    getCountingChannel(guildid, channelid) {
        return new Promise(async function(resolve, reject) {
            let guild = await cacheGuild(guildid, channelid);
            resolve(guild.countingchannels[channelid] ? guild.countingchannels[channelid].channelid : '')
        })
    },
    addToCount(guildid, channelid, userid) {
        return new Promise(async function(resolve, reject) {
            await cacheGuild(guildid, channelid);
            savedGuilds[guildid].countingchannels[channelid].count += savedGuilds[guildid].countingchannels[channelid].countby;
            savedGuilds[guildid].countingchannels[channelid].user = userid;
          
            let guild = await getGuild(guildid, channelid);
            guild.countingchannels[channelid].count = savedGuilds[guildid].countingchannels[channelid].count;
            guild.countingchannels[channelid].user = savedGuilds[guildid].countingchannels[channelid].user;
            await guild.save().then(resolve).catch(reject);
            updateTopic(guildid, channelid, client)
        })
    },
    setLastMessage(guildid, channelid, message) {
        return new Promise(async function(resolve, reject) {
            await cacheGuild(guildid, channelid);
            savedGuilds[guildid].countingchannels[channelid].message = message;
          
            let guild = await getGuild(guildid, channelid);
            guild.countingchannels[channelid].message = savedGuilds[guildid].countingchannels[channelid].message;
            await guild.save().then(resolve).catch(reject);
        })
    },
    getCount(guildid, channelid) {
        return new Promise(async function(resolve, reject) {
            let guild = await cacheGuild(guildid, channelid);
            resolve({ "count": guild.countingchannels[channelid].count, "countby": guild.countingchannels[channelid].countby, "user": guild.countingchannels[channelid].user, "message": guild.countingchannels[channelid].message })
        })
    },
    setCount(guildid, channelid, count) {
        return new Promise(async function(resolve, reject) {
            await cacheGuild(guildid, channelid);
            savedGuilds[guildid].countingchannels[channelid].count = count;
            savedGuilds[guildid].countingchannels[channelid].user = '';
          
            let guild = await getGuild(guildid, channelid);
            guild.countingchannels[channelid].count = savedGuilds[guildid].countingchannels[channelid].count;
            guild.countingchannels[channelid].user = savedGuilds[guildid].countingchannels[channelid].user;
            await guild.save().then(resolve).catch(reject);
            updateTopic(guildid, channelid, client)
        })
    },
    setCountBy(guildid, channelid, by) {
      return new Promise(async function(resolve, reject) {
            await cacheGuild(guildid, channelid);
            savedGuilds[guildid].countingchannels[channelid].countby = by;
            savedGuilds[guildid].countingchannels[channelid].user = '';
          
            let guild = await getGuild(guildid, channelid);
            guild.countingchannels[channelid].countby = savedGuilds[guildid].countingchannels[channelid].countby;
            guild.countingchannels[channelid].user = savedGuilds[guildid].countingchannels[channelid].user;
            await guild.save().then(resolve).catch(reject);
            updateTopic(guildid, channelid, client)
        })
    },
    toggleModule(guildid, channelid, moduleStr) {
        return new Promise(async function(resolve, reject) {
            await cacheGuild(guildid, channelid);
            if (savedGuilds[guildid].countingchannels[channelid].modules.includes(moduleStr)) savedGuilds[guildid].countingchannels[channelid].modules = savedGuilds[guildid].countingchannels[channelid].modules.filter((str) => str !== moduleStr)
            else savedGuilds[guildid].countingchannels[channelid].modules.push(moduleStr)

            let guild = await getGuild(guildid, channelid);
            guild.countingchannels[channelid].modules = savedGuilds[guildid].countingchannels[channelid].modules
            guild.save().then(resolve).catch(reject);
        })
    },
    getModules(guildid, channelid) {
        return new Promise(async function(resolve, reject) {
            let guild = await cacheGuild(guildid, channelid);
            resolve(guild.countingchannels[channelid] ? guild.countingchannels[channelid].modules : []);
        })
    },
    subscribe(guildid, userid, count) {
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
    checkSubscribed(guildid, channelid, count, countUser, messageID) {
        return new Promise(async function(resolve, reject) {
            let guild = await getGuild(guildid, channelid);

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
    },
    setTopic(guildid, channelid, topic) {
        return new Promise(async function(resolve, reject) {
            await cacheGuild(guildid, channelid);
            if (['disable', ''].includes(savedGuilds[guildid].countingchannels[channelid].channeltopic)) savedGuilds[guildid].countingchannels[channelid].channeltopic = topic; else savedGuilds[guildid].countingchannels[channelid].channeltopic = topic + (topic.includes("{{COUNT}}") ? "" : (topic == "" ? "" : " | ") + "**Next count:** {{COUNT}}")
          
            let guild = await getGuild(guildid, channelid);
            guild.countingchannels[channelid].channeltopic = savedGuilds[guildid].countingchannels[channelid].channeltopic;
            await guild.save().then(resolve).catch(reject);
            updateTopic(guildid, channelid, client)
        })
    },
    getTopic(guildid, channelid) {
        return new Promise(async function(resolve, reject) {
            let guild = await cacheGuild(guildid, channelid);
            resolve(guild.countingchannels[channelid].channeltopic)
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
    setRole(guildid, mode, count, duration, roleid) {
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
    }
}}

function getGuild(guildid, channelid) {
    return new Promise(function(resolve, reject) {
        Guild.findOne({
            guildid: guildid
        }, (err, guild) => {
            if (err) return reject(err);
            if (!guild) {
                let newGuild = new Guild({
                    guildid: guildid,
                    countingchannels: {
                      [channelid]: {
                        guildid: guildid,
                        channelid: channelid,
                        count: 0,
                        countby: 1,
                        message: '',
                        modules: [],
                        subscriptions: {},
                        channeltopic: '',
                        user: ''
                      }
                    }
                })

                return resolve(newGuild);
            } else return resolve(guild);
        })
    })
}

function updateTopic(guildid, channelid, client) {
    return new Promise(async function(resolve, reject) {
        let guild = await getGuild(guildid, channelid);
        try {
            if (guild.countingchannels[channelid].channeltopic === "") await client.guilds.get(guildid).channels.get(guild.countingchannels[channelid].channelid).setTopic("**Next count:** " + (guild.countingchannels[channelid].count + guild.countingchannels[channelid].countby))
            else if (guild.countingchannels[channelid].channeltopic !== "disable") await client.guilds.get(guildid).channels.get(guild.countingchannels[channelid].channelid).setTopic(guild.countingchannels[channelid].channeltopic.replace("{{COUNT}}", (guild.countingchannels[channelid].count + guild.countingchannels[channelid].countby)))
        } catch(e) {}
        resolve(true);
    })
}

async function cacheGuild(guildid, channelid) {
    if (!savedGuilds[guildid]) {
        let guild = await getGuild(guildid, channelid);
        savedGuilds[guildid] = {};
        //savedGuilds[guildid].guildid = guild.guildid;
        //if (!savedGuilds[guildid].countingchannels) {
        savedGuilds[guildid].countingchannels = {};
        savedGuilds[guildid].countingchannels[channelid] = {};
        //}
        savedGuilds[guildid].countingchannels[channelid].count = guild.countingchannels[channelid].count;
        savedGuilds[guildid].countingchannels[channelid].countby = guild.countingchannels[channelid].countby;
        savedGuilds[guildid].countingchannels[channelid].guildid = guild.countingchannels[channelid].guildid;
        savedGuilds[guildid].countingchannels[channelid].user = guild.countingchannels[channelid].user;
        savedGuilds[guildid].countingchannels[channelid].modules = guild.countingchannels[channelid].modules;
        savedGuilds[guildid].countingchannels[channelid].channeltopic = guild.countingchannels[channelid].channeltopic;
        savedGuilds[guildid].countingchannels[channelid].message = guild.countingchannels[channelid].message;

        /*savedGuilds[guildid] = {};
        savedGuilds[guildid].channel = guild.channel;
        savedGuilds[guildid].count = guild.count;
        savedGuilds[guildid].countby = guild.countby;
        savedGuilds[guildid].user = guild.user;
        savedGuilds[guildid].modules = guild.modules;
        savedGuilds[guildid].topic = guild.topic;
        savedGuilds[guildid].message = guild.message;*/
    }
    timeoutGuilds[guildid] = 300;
    return savedGuilds[guildid];
}

setInterval(() => { for (var i in timeoutGuilds) {
    timeoutGuilds[i] -= 1;
    if (timeoutGuilds[i] < 1) {
        delete savedGuilds[i];
        delete timeoutGuilds[i];
    }
}}, 1000)
