require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Partials,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Create client instance with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Set prefix for commands
const PREFIX = "!";

// Configuration for storing welcome channel IDs and member counts
const configPath = path.join(__dirname, "config.json");
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(
    configPath,
    JSON.stringify({
      welcomeChannels: {},
      memberCounts: {},
    })
  );
}

// Load config
let config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Save config function
function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Client ready event
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is in ${client.guilds.cache.size} servers`);

  // Update member counts for all guilds
  client.guilds.cache.forEach((guild) => {
    console.log(`Connected to guild: ${guild.name} (${guild.id})`);
    updateMemberCount(guild);
  });
});

// Update member count function
async function updateMemberCount(guild) {
  const id = guild.id;

  // Fetch all members to ensure count is accurate
  await guild.members.fetch();
  const count = guild.memberCount;

  // Update the count in our config
  if (!config.memberCounts[id]) {
    config.memberCounts[id] = {};
  }

  config.memberCounts[id].count = count;
  config.memberCounts[id].lastUpdated = new Date().toISOString();

  saveConfig();
}

// Handle guild member add event (someone joins)
client.on("guildMemberAdd", async (member) => {
  const guildId = member.guild.id;

  // Update member count
  await updateMemberCount(member.guild);

  // Send welcome message if channel is set
  const welcomeChannelId = config.welcomeChannels[guildId];
  if (welcomeChannelId) {
    const channel = member.guild.channels.cache.get(welcomeChannelId);
    if (channel) {
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("Welcome to the server!")
        .setDescription(
          `Hello, ${member.user.toString()}! Welcome to **${
            member.guild.name
          }**!`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: "Member Count",
            value: `You are member #${member.guild.memberCount}!`,
          },
          { name: "Joined At", value: `${member.joinedAt.toUTCString()}` }
        )
        .setTimestamp()
        .setFooter({ text: "We hope you enjoy your stay!" });

      channel.send({ embeds: [welcomeEmbed] });
    }
  }
});

// Handle guild member remove event (someone leaves)
client.on("guildMemberRemove", async (member) => {
  // Update member count
  await updateMemberCount(member.guild);
});

// Handle message event for legacy commands
client.on("messageCreate", async (message) => {
  // Ignore messages from bots or messages that don't start with the prefix
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  // Parse command and arguments
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Handle commands
  if (command === "setwelcome") {
    // Check permissions
    if (!message.member.permissions.has("ManageGuild")) {
      return message.reply(
        "You need the Manage Server permission to use this command!"
      );
    }

    // Get the channel to set as welcome channel
    const channel = message.mentions.channels.first() || message.channel;
    const guildId = message.guild.id;

    // Save the welcome channel ID to config
    config.welcomeChannels[guildId] = channel.id;
    saveConfig();

    message.reply(`Welcome channel has been set to ${channel.toString()}!`);
  } else if (command === "members") {
    const guildId = message.guild.id;

    // Get member count from our config
    const memberData = config.memberCounts[guildId] || {
      count: 0,
      lastUpdated: "Never",
    };

    // Create embed with member count info
    const countEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`${message.guild.name} - Member Count`)
      .setDescription(
        `This server currently has **${memberData.count}** members!`
      )
      .setThumbnail(message.guild.iconURL({ dynamic: true }))
      .setFooter({ text: `Last updated: ${memberData.lastUpdated}` })
      .setTimestamp();

    message.reply({ embeds: [countEmbed] });
  } else if (command === "help") {
    const helpEmbed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle("Bot Commands")
      .setDescription("Here are the available commands:")
      .addFields(
        {
          name: `${PREFIX}setwelcome [#channel]`,
          value:
            "Sets the channel for welcome messages (requires Manage Server permission)",
        },
        {
          name: `${PREFIX}members`,
          value: "Shows the current member count of the server",
        },
        { name: `${PREFIX}help`, value: "Shows this help message" }
      )
      .setTimestamp();

    message.reply({ embeds: [helpEmbed] });
  }
});

// Login with token
client.login(process.env.TOKEN);
