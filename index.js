require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
Client,
Collection,
ActivityType,
Events,
Partials
} = require('discord.js');

const {
GoogleGenerativeAI,
HarmCategory,
HarmBlockThreshold
} = require("@google/generative-ai");


// ================= CLIENT =================

const client = new Client({
intents: [1,512,32768,2,4096,16384],
partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.commands = new Collection();

const PREFIX = process.env.PREFIX || ",";
const OWNER_ID = process.env.OWNER_ID;


// ================= PATHS =================

const dbPath = path.join(__dirname,'database.json');
const lydiaPath = path.join(__dirname,'lydia_status.json');


// ================= CACHED DATABASE =================

let database = {};
let lydiaChannels = {};

if(fs.existsSync(dbPath)){
try{
database = JSON.parse(fs.readFileSync(dbPath,"utf8"));
}catch{}
}

if(fs.existsSync(lydiaPath)){
try{
lydiaChannels = JSON.parse(fs.readFileSync(lydiaPath,"utf8"));
}catch{}
}


// ================= MEMORY =================

const lydiaMemory = new Map();


// ================= GEMINI =================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
model: "gemini-2.0-flash",
safetySettings:[
{category:HarmCategory.HARM_CATEGORY_HARASSMENT,threshold:HarmBlockThreshold.BLOCK_NONE},
{category:HarmCategory.HARM_CATEGORY_HATE_SPEECH,threshold:HarmBlockThreshold.BLOCK_NONE},
{category:HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,threshold:HarmBlockThreshold.BLOCK_NONE},
{category:HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,threshold:HarmBlockThreshold.BLOCK_NONE}
]
});


// ================= PLUGIN LOADER =================

function loadPlugins(){

client.commands.clear();

const pluginsFolder = path.join(__dirname,'plugins');

if(!fs.existsSync(pluginsFolder))
fs.mkdirSync(pluginsFolder);

const files = fs.readdirSync(pluginsFolder).filter(f=>f.endsWith(".js"));

for(const file of files){

try{

delete require.cache[require.resolve(`./plugins/${file}`)];

const plugin = require(`./plugins/${file}`);

if(plugin.name){
client.commands.set(plugin.name,plugin);
}

}catch(err){

console.log(`PLUGIN ERROR (${file})`,err.message);

}

}

console.log(`🚀 ${client.commands.size} plugins loaded`);

}

loadPlugins();


// ================= READY =================

client.once(Events.ClientReady,()=>{

console.log(`✅ ${client.user.tag} online`);

const statuses=[
"🎮 CODM Assistant",
"🧠 Lydia AI Online",
"⚙️ Engine Stable"
];

let i=0;

setInterval(()=>{

client.user.setPresence({
activities:[{name:statuses[i],type:ActivityType.Custom}],
status:"online"
});

i=(i+1)%statuses.length;

},10000);

});


// ================= MESSAGE EVENT =================

client.on(Events.MessageCreate, async message => {

if(message.author.bot || !message.guild) return;

const uid = message.author.id;


// ---------- XP SYSTEM ----------

if(!database[uid]){

database[uid]={
xp:0,
level:1,
name:message.author.username
};

}

database[uid].xp += 20;

fs.writeFileSync(dbPath,JSON.stringify(database,null,4));


// ---------- COMMAND SYSTEM ----------

if(message.content.startsWith(PREFIX)){

const args = message.content.slice(PREFIX.length).trim().split(/ +/);

const cmdName = args.shift().toLowerCase();

const command = client.commands.get(cmdName);

if(command){

try{

await command.execute(message,args,client,model);

}catch(err){

console.error("COMMAND ERROR",err);

message.reply("⚠️ Command execution error.");

}

return;

}

}


// ---------- LYDIA CHANNEL CHECK ----------

if(!lydiaChannels[message.channel.id]) return;


// ---------- DETECT MENTION ----------

const mentioned = message.mentions.has(client.user);


// ---------- DETECT REPLY ----------

let replyToBot=false;

if(message.reference){

const ref = await message.channel.messages
.fetch(message.reference.messageId)
.catch(()=>null);

if(ref && ref.author.id===client.user.id)
replyToBot=true;

}

if(!mentioned && !replyToBot) return;


// ---------- AI RESPONSE ----------

try{

await message.channel.sendTyping();

const username = message.member?.displayName || message.author.username;

let history = lydiaMemory.get(uid) || [];

const historyText = history
.map(h=>`User:${h.q}\nLydia:${h.a}`)
.join("\n");

const prompt = `

You are Lydia.

You are an intelligent AI assistant for a Discord gaming server.

Server: CLOUD_GAMING-223
Creator: Moussa Fofana

Personality:
-friendly
-polite
-helpful
-professional
-gaming oriented

Always address the user by their name: ${username}.

Conversation history:
${historyText}

User message:
${message.content}

Respond naturally as Lydia.
`;

const result = await model.generateContent(prompt);

const reply = result.response.text();

if(!reply) return;

history.push({q:message.content,a:reply});

if(history.length>6)
history.shift();

lydiaMemory.set(uid,history);

message.reply(reply);

}catch(err){

console.log("LYDIA ERROR",err.message);

}

});


// ================= LOGIN =================

client.login(process.env.DISCORD_TOKEN);const fs = require('fs');
const path = require('path');

const lydiaPath = path.join(__dirname, '../lydia_status.json');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle Lydia AI (on/off)',

    async execute(message, args) {

        const choice = args[0]?.toLowerCase();

        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try {
                statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8'));
            } catch (err) {
                statusDB = {};
            }
        }

        if (choice === 'on') {

            statusDB[message.channel.id] = true;

            fs.writeFileSync(
                lydiaPath,
                JSON.stringify(statusDB, null, 4)
            );

            return message.reply(
                "🧬 **Lydia AI Activated**\nYou can now mention me to chat!"
            );
        }

        if (choice === 'off') {

            delete statusDB[message.channel.id];

            fs.writeFileSync(
                lydiaPath,
                JSON.stringify(statusDB, null, 4)
            );

            return message.reply(
                "💤 **Lydia AI Deactivated**"
            );
        }

        return message.reply(
            "❓ Usage: `,lydia on` or `,lydia off`"
        );
    },

    async onMessage(message, client) {

        if (message.author.bot) return;

        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try {
                statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8'));
            } catch {}
        }

        if (!statusDB[message.channel.id]) return;

        if (!message.mentions.has(client.user)) return;

        const username = message.member?.displayName || message.author.username;

        const responses = [

            `Hello **${username}** 👋 I'm **Lydia**, your friendly AI assistant.`,
            
            `Nice to see you **${username}**! I'm Lydia, here to help the server.`,
            
            `Greetings **${username}** 😊 Lydia at your service.`,
            
            `Hey **${username}**! Need help with something?`
        ];

        const intro = `✨ **About me**  
I am **Lydia**, an AI assistant designed to help and interact with the community.

👨‍💻 **Creator:** Moussa Fofana  
🤖 **Purpose:** Assist, chat, and make this server more fun!`;

        const randomReply = responses[Math.floor(Math.random() * responses.length)];

        message.reply(`${randomReply}\n\n${intro}`);
    }
};const fs = require('fs');
const path = require('path');

const lydiaPath = path.join(__dirname, '../lydia_status.json');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle Lydia AI (on/off)',

    async execute(message, args) {

        const choice = args[0]?.toLowerCase();

        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try {
                statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8'));
            } catch (err) {
                statusDB = {};
            }
        }

        if (choice === 'on') {

            statusDB[message.channel.id] = true;

            fs.writeFileSync(
                lydiaPath,
                JSON.stringify(statusDB, null, 4)
            );

            return message.reply(
                "🧬 **Lydia AI Activated**\nYou can now mention me to chat!"
            );
        }

        if (choice === 'off') {

            delete statusDB[message.channel.id];

            fs.writeFileSync(
                lydiaPath,
                JSON.stringify(statusDB, null, 4)
            );

            return message.reply(
                "💤 **Lydia AI Deactivated**"
            );
        }

        return message.reply(
            "❓ Usage: `,lydia on` or `,lydia off`"
        );
    },

    async onMessage(message, client) {

        if (message.author.bot) return;

        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try {
                statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8'));
            } catch {}
        }

        if (!statusDB[message.channel.id]) return;

        if (!message.mentions.has(client.user)) return;

        const username = message.member?.displayName || message.author.username;

        const responses = [

            `Hello **${username}** 👋 I'm **Lydia**, your friendly AI assistant.`,
            
            `Nice to see you **${username}**! I'm Lydia, here to help the server.`,
            
            `Greetings **${username}** 😊 Lydia at your service.`,
            
            `Hey **${username}**! Need help with something?`
        ];

        const intro = `✨ **About me**  
I am **Lydia**, an AI assistant designed to help and interact with the community.

👨‍💻 **Creator:** Moussa Fofana  
🤖 **Purpose:** Assist, chat, and make this server more fun!`;

        const randomReply = responses[Math.floor(Math.random() * responses.length)];

        message.reply(`${randomReply}\n\n${intro}`);
    }
};