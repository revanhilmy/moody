require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const cron = require('node-cron');

// Initialize the Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Configuration
const CHANNEL_ID = "1352471487000608899";  // Channel where daily message will be sent
const DAILY_MESSAGE = "a";
const GUILD_ID = '1094177674521493554'; // Replace with your guild ID

// Role IDs and their corresponding emojis
const MOOD_ROLES = {
    "😁": "1390957468561182820",  // joy
    "🥲": "1390957513007956108",  // sad
    "😐": "1390957549599068311",  // neutral
    "😴": "1390958534317051904",  // boredom
    "😣": "1390958719466078298",  // discomfort
    "😡": "1390959135465537566",  // angry
    "😕": "1390959195905327188",  // envy
    "🥺": "1390964588068995092",  // gloomy
};

// Store active mood messages
const activeMoodMessages = new Set();

// Bot ready event
client.once('ready', () => {
    console.log(`${client.user.tag} is online!`);
    
    // Start the daily mood message scheduler
    startDailyMoodScheduler();
});

// Register slash commands when bot starts
client.once('ready', async () => {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return console.error('Guild not found');

    try {
        // Clear existing commands
        const guildCommands = await guild.commands.fetch();
        for (const command of guildCommands.values()) {
            if (command.name === 'moodtest' || command.name === 'moodstatus') {
                await guild.commands.delete(command.id);
                console.log(`🗑️ Deleted guild command: ${command.name}`);
            }
        }

        // Register mood commands
        const newCommands = [
            new SlashCommandBuilder()
                .setName('moodtest')
                .setDescription('Manually send mood message for testing'),
            new SlashCommandBuilder()
                .setName('moodstatus')
                .setDescription('Check mood bot status and active messages')
        ];

        for (const command of newCommands) {
            await client.application.commands.create(command);
            console.log(`✅ Registered command: ${command.name}`);
        }
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});

// Handle slash commands and interactions
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            // Route to appropriate command handler
            switch (interaction.commandName) {
                case 'moodtest':
                    await handleMoodTestCommand(interaction);
                    break;
                case 'moodstatus':
                    await handleMoodStatusCommand(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown command!',
                        ephemeral: true
                    });
            }
        }
    } catch (error) {
        console.error('❌ Interaction error:', error);
        
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ Terjadi kesalahan saat memproses permintaan.',
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('❌ Error sending error reply:', replyError);
            }
        }
    }
});

// Handle reaction add events
client.on('messageReactionAdd', async (reaction, user) => {
    try {
        // Ignore bot reactions
        if (user.bot) return;

        // Check if it's a partial reaction and fetch if needed
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('❌ Error fetching reaction:', error);
                return;
            }
        }

        // Check if the message is one of our mood messages
        if (!activeMoodMessages.has(reaction.message.id)) return;

        // Check if the emoji is one of our mood emojis
        const emoji = reaction.emoji.name;
        if (!MOOD_ROLES[emoji]) return;

        // Get the role
        const guild = reaction.message.guild;
        const member = guild.members.cache.get(user.id);
        const roleId = MOOD_ROLES[emoji];
        const role = guild.roles.cache.get(roleId);

        if (!member || !role) {
            console.error('❌ Member or role not found');
            return;
        }

        // Remove all other mood roles first
        const allMoodRoles = Object.values(MOOD_ROLES);
        const currentMoodRoles = member.roles.cache.filter(r => allMoodRoles.includes(r.id));
        
        if (currentMoodRoles.size > 0) {
            try {
                await member.roles.remove(currentMoodRoles);
                console.log(`✅ Removed previous mood roles from ${member.displayName}`);
            } catch (error) {
                console.error('❌ Error removing previous mood roles:', error);
            }
        }

        // Remove user's reactions from other mood emojis
        const message = reaction.message;
        for (const [otherEmoji, otherRoleId] of Object.entries(MOOD_ROLES)) {
            if (otherEmoji !== emoji) {
                try {
                    const otherReaction = message.reactions.cache.get(otherEmoji);
                    if (otherReaction && otherReaction.users.cache.has(user.id)) {
                        await otherReaction.users.remove(user.id);
                        console.log(`✅ Removed ${user.username}'s reaction from ${otherEmoji}`);
                    }
                } catch (error) {
                    console.error(`❌ Error removing reaction ${otherEmoji}:`, error);
                }
            }
        }

        // Add the new role
        try {
            await member.roles.add(role);
            console.log(`✅ Added role ${role.name} to ${member.displayName}`);
        } catch (error) {
            console.error('❌ Error adding role:', error);
        }

    } catch (error) {
        console.error('❌ Error in messageReactionAdd:', error);
    }
});

// Handle reaction remove events
client.on('messageReactionRemove', async (reaction, user) => {
    try {
        // Ignore bot reactions
        if (user.bot) return;

        // Check if it's a partial reaction and fetch if needed
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('❌ Error fetching reaction:', error);
                return;
            }
        }

        // Check if the message is one of our mood messages
        if (!activeMoodMessages.has(reaction.message.id)) return;

        // Check if the emoji is one of our mood emojis
        const emoji = reaction.emoji.name;
        if (!MOOD_ROLES[emoji]) return;

        // Get the role
        const guild = reaction.message.guild;
        const member = guild.members.cache.get(user.id);
        const roleId = MOOD_ROLES[emoji];
        const role = guild.roles.cache.get(roleId);

        if (!member || !role) {
            console.error('❌ Member or role not found');
            return;
        }

        // Remove the role
        try {
            await member.roles.remove(role);
            console.log(`✅ Removed role ${role.name} from ${member.displayName}`);
        } catch (error) {
            console.error('❌ Error removing role:', error);
        }

    } catch (error) {
        console.error('❌ Error in messageReactionRemove:', error);
    }
});

// Function to send daily mood message
async function sendDailyMoodMessage() {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            console.error('❌ Guild not found');
            return;
        }

        // Find the channel
        const channel = guild.channels.cache.get(CHANNEL_ID);
        if (!channel) {
            console.error(`❌ Channel with ID '${CHANNEL_ID}' not found`);
            return;
        }

        // Create embed
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎭 Daily Mood Check!')
            // .setDescription(DAILY_MESSAGE)
            .addFields(
                { name: '**Pilih mood kamu saat ini:**', value: '😁 Joy\n🥲 Sad\n😐 Neutral\n😴 Boredom\n😣 Discomfort\n😡 Angry\n😕 Envy\n🥺 Gloomy', inline: false },
                { name: '*Keterangan:*', value: '- *Click emoji untuk dapat role mood*\n- *Click emoji lain untuk ganti role mood*', inline: false }
            )
            .setTimestamp()
            // .setFooter({ text: 'Daily mood tracker' });

        // Send message
        // const message = await channel.send({
        //     content: 'apa mood kamu hari ini?',
        //     embeds: [embed]
        // });

        // Send message
        const message = await channel.send({
            embeds: [embed]
        });        

        // Add to active messages
        activeMoodMessages.add(message.id);

        // Add reactions
        for (const emoji of Object.keys(MOOD_ROLES)) {
            try {
                await message.react(emoji);
            } catch (reactError) {
                console.error('❌ Error adding reaction:', reactError);
            }
        }

        console.log('✅ Daily mood message sent successfully');

    } catch (error) {
        console.error('❌ Error sending daily mood message:', error);
    }
}

// Start the daily mood scheduler
function startDailyMoodScheduler() {
    // Schedule daily at 9:00 AM (adjust time as needed)
    cron.schedule('45 15 * * *', () => {
        console.log('🕘 Sending daily mood message...');
        sendDailyMoodMessage();
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta" // Adjust timezone as needed
    });

    console.log('📅 Daily mood scheduler started (9:00 AM WIB)');
}

// Handle mood test command
async function handleMoodTestCommand(interaction) {
    try {
        // Check if user has permission (you can adjust this)
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            await interaction.reply({
                content: '❌ You need administrator permission to use this command.',
                ephemeral: true
            });
            return;
        }

        // Send acknowledgment
        await interaction.reply({
            content: '✅ Test mood message sent!',
            ephemeral: true
        });

        // Send the mood message
        await sendDailyMoodMessage();

    } catch (error) {
        console.error('❌ Error in handleMoodTestCommand:', error);
        await interaction.reply({
            content: '❌ Error sending test mood message.',
            ephemeral: true
        });
    }
}

// Handle mood status command
async function handleMoodStatusCommand(interaction) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎭 Mood Bot Status')
            .setDescription('Current status of the mood bot')
            .addFields(
                { name: '**Active Messages:**', value: `${activeMoodMessages.size}`, inline: true },
                { name: '**Target Channel:**', value: `<#${CHANNEL_ID}>`, inline: true },
                { name: '**Daily Schedule:**', value: '9:00 AM WIB', inline: true },
                { name: '**Total Mood Roles:**', value: `${Object.keys(MOOD_ROLES).length}`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });

    } catch (error) {
        console.error('❌ Error in handleMoodStatusCommand:', error);
        await interaction.reply({
            content: '❌ Error checking mood bot status.',
            ephemeral: true
        });
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('🔄 Shutting down bot...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🔄 Shutting down bot...');
    client.destroy();
    process.exit(0);
});

// Login to Discord using environment variable
client.login(process.env.DISCORD_TOKEN);

// Export for use
module.exports = { client };