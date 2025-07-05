require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

// Initialize the Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// Bot ready event
client.once('ready', () => {
    console.log(`${client.user.tag} is online!`);
});

// Register slash commands when bot starts
client.once('ready', async () => {
    const guild = client.guilds.cache.get('1094177674521493554'); // Replace with your guild ID
    if (!guild) return console.error('Guild not found');

    const guildCommands = await guild.commands.fetch();
    for (const command of guildCommands.values()) {
        await guild.commands.delete(command.id);
        console.log(`🗑️ Deleted guild command: ${command.name}`);
    }

    // Now (re)register your updated commands
    const newCommands = [
        new SlashCommandBuilder()
            .setName('randomping')
            .setDescription('Ping random online user di server')
            .addBooleanOption(option =>
                option.setName('exclude-bots')
                    .setDescription('Exclude bots dari random selection')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('pingwarga')
            .setDescription('Ping semua warga untuk ngobrol')
    ];

    for (const command of newCommands) {
        await client.application.commands.create(command);
        console.log(`✅ Registered command: ${command.name}`);
    }
});


// Handle slash commands and interactions
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            // Route to appropriate command handler
            switch (interaction.commandName) {
                case 'randomping':
                    await handleRandomPingCommand(interaction);
                    break;
                case 'pingwarga':
                    await handlePingWargaCommand(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown command!',
                        ephemeral: true
                    });
            }
        } else if (interaction.isButton()) {
            // Handle button interactions
            if (interaction.customId === 'ping_random_again') {
                await handleRandomPingButton(interaction);
            } else if (interaction.customId === 'ping_all_warga') {
                await handlePingAllWargaButton(interaction);
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

// Function to get random online user
function getRandomOnlineUser(guild, excludeBots = true) {
    const onlineMembers = guild.members.cache.filter(member => {
        const isOnline = member.presence?.status === 'online' || 
                        member.presence?.status === 'idle' || 
                        member.presence?.status === 'dnd';
        
        if (excludeBots && member.user.bot) {
            return false;
        }
        
        return isOnline;
    });

    if (onlineMembers.size === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * onlineMembers.size);
    return onlineMembers.at(randomIndex);
}

// Handle random ping command
async function handleRandomPingCommand(interaction) {
    try {
        const excludeBots = interaction.options.getBoolean('exclude-bots') ?? true;
        const randomUser = getRandomOnlineUser(interaction.guild, excludeBots);

        if (!randomUser) {
            await interaction.reply({
                content: '❌ Tidak ada user online yang ditemukan!',
                ephemeral: true
            });
            return;
        }

        // Create embed in your bot's style
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎯 Random Ping!')
            .setDescription(`Warga yang beruntung: **${randomUser.displayName}**`)
            .addFields(
                { name: '**Target:**', value: `<@${randomUser.id}>`, inline: true },
                { name: '**Status:**', value: randomUser.presence?.status || 'online', inline: true },
                { name: '**Reason:**', value: 'Dipilih secara random!', inline: false }
            )
            .setThumbnail(randomUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();

        // Create buttons in your bot's style
        const randomAgainButton = new ButtonBuilder()
            .setCustomId('ping_random_again')
            .setLabel('🎲 Random Lagi!')
            .setStyle(ButtonStyle.Primary);

        const pingAllButton = new ButtonBuilder()
            .setCustomId('ping_all_warga')
            .setLabel('📢 Ping All Warga')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(randomAgainButton, pingAllButton);

        // Send acknowledgment to user (private)
        await interaction.reply({
            content: '✅ Random ping berhasil dikirim!',
            ephemeral: true
        });

        // Send to the main channel
        const channel = interaction.channel;
        if (channel) {
            const message = await channel.send({
                content: `🎯 **Random Ping Alert!** <@${randomUser.id}> kamu terpilih!`,
                embeds: [embed],
                components: [row],
                allowedMentions: { users: [randomUser.id] }
            });

            // Add emoji reaction like your bot
            try {
                await message.react('🎯');
                await message.react('🎲');
            } catch (reactErr) {
                console.error('❌ Failed to add reaction:', reactErr);
            }
        }

    } catch (error) {
        console.error('❌ Error in handleRandomPingCommand:', error);
        throw error;
    }
}

// Handle ping warga command (similar to yuk-ngobrol)
async function handlePingWargaCommand(interaction) {
    try {
        // Send acknowledgment to user (private)
        await interaction.reply({
            content: '✅ Pesan berhasil dikirim!',
            ephemeral: true
        });

        // Send the main message to the channel
        const channel = interaction.channel;
        if (channel) {
            await channel.send({
                content: `📢 *need someone to talk, yuk <@&1375923104961925140> ke voice <#1139967188049068102>*`
            });
        }
    } catch (error) {
        console.error('❌ Error in handlePingWargaCommand:', error);
        await interaction.reply({
            content: '❌ Error sending message.',
            ephemeral: true
        });
    }
}

// Handle random ping button
async function handleRandomPingButton(interaction) {
    try {
        // Defer the update silently
        await interaction.deferUpdate();

        const randomUser = getRandomOnlineUser(interaction.guild, true);

        if (!randomUser) {
            await interaction.followUp({
                content: '❌ Tidak ada user online yang ditemukan!',
                ephemeral: true
            });
            return;
        }

        // Create new embed
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🎯 Random Ping!')
            .setDescription(`Warga yang beruntung: **${randomUser.displayName}**`)
            .addFields(
                { name: '**Target:**', value: `<@${randomUser.id}>`, inline: true },
                { name: '**Status:**', value: randomUser.presence?.status || 'online', inline: true },
                { name: '**Reason:**', value: 'Dipilih secara random!', inline: false }
            )
            .setThumbnail(randomUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();

        // Create buttons
        const randomAgainButton = new ButtonBuilder()
            .setCustomId('ping_random_again')
            .setLabel('🎲 Random Lagi!')
            .setStyle(ButtonStyle.Primary);

        const pingAllButton = new ButtonBuilder()
            .setCustomId('ping_all_warga')
            .setLabel('📢 Ping All Warga')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(randomAgainButton, pingAllButton);

        // Send a new message instead of editing
        await interaction.channel.send({
            content: `🎯 **Random Ping Alert!** <@${randomUser.id}> kamu terpilih lagi!`,
            embeds: [embed],
            components: [row],
            allowedMentions: { users: [randomUser.id] }
        });

    } catch (error) {
        console.error('❌ Error in handleRandomPingButton:', error);
    }
}

// Handle ping all warga button
async function handlePingAllWargaButton(interaction) {
    try {
        // Defer the update silently
        await interaction.deferUpdate();

        // Send a new independent message
        await interaction.channel.send({
            content: `📢 *need someone to talk, yuk <@&1375923104961925140> ke voice <#1139967188049068102>*`
        });

    } catch (error) {
        console.error('❌ Error in handlePingAllWargaButton:', error);
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