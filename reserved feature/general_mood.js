const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const STATE_FILE = path.join(dataDir, 'mood_state.json');
const DAILY_CHANNEL_ID = '1094177675008036913'; // Dummy channel for daily posts (General chat or testing channel)

// Configuration for 19 moods with dummy Emoji and Role IDs
const MOOD_CONFIG = [
    { name: "Ceria", emojiName: "sunny_joy", emojiId: "1518556813795131443", roleId: "1514971009042616320" },
    { name: "Penuh Kasih", emojiName: "deep_affection", emojiId: "1518557414817927289", roleId: "1518532960171851806" },
    { name: "Bangga", emojiName: "proud_achievement", emojiId: "1518557478957224007", roleId: "1518552190975737976" },
    { name: "Tenang Damai", emojiName: "calm_peace", emojiId: "1518557519570538686", roleId: "1518552323184398437" },
    { name: "Menggoda", emojiName: "flirty_charmer", emojiId: "1518557589405962240", roleId: "1518552367677702204" },
    { name: "Penuh Harapan", emojiName: "hopeful_optimism", emojiId: "1518557636579037244", roleId: "1518552378255867914" },

    { name: "Marah Emosi", emojiName: "frustrated_annoyance", emojiId: "1518557692078198917", roleId: "1518552458278998026" },
    { name: "Kesal", emojiName: "impatient_waiting", emojiId: "1518557736776892637", roleId: "1518552514830667876" },
    { name: "Cemburu", emojiName: "jealous_envy", emojiId: "1518557822202155028", roleId: "1518552551627427942" },
    { name: "Jahil", emojiName: "silly_play", emojiId: "1518557869534875828", roleId: "1518552594648137829" },

    { name: "Kesepian", emojiName: "lonely_solitude", emojiId: "1518557917911978014", roleId: "1518552639644766218" },
    { name: "Kelelahan", emojiName: "exhausted_fatigue", emojiId: "1518557975596499096", roleId: "1518552679800897638" },
    { name: "Cemas", emojiName: "nervous_apprehension", emojiId: "1518558048380256266", roleId: "1518552716220301352" },
    { name: "Sakit Hati", emojiName: "hurt_regret", emojiId: "1518558118684921918", roleId: "1518552760729993307" },
    { name: "Sedih Murung", emojiName: "gloomy_despair", emojiId: "1518558216315998298", roleId: "1518552803830661240" },

    { name: "Terkejut", emojiName: "surprised_disbelief", emojiId: "1518558282510237788", roleId: "1518552844926586921" },
    { name: "Kebingungan", emojiName: "confused_puzzlement", emojiId: "1518558331814416394", roleId: "1518552888924962906" },
    { name: "Skeptis", emojiName: "doubtful_skepticism", emojiId: "1518558382322094100", roleId: "1518552929265516685" },
    { name: "Termenung Ragu", emojiName: "pensive_thought", emojiId: "1518558433647788062", roleId: "1518552965605097603" },
];

const { getDb } = require('../db.js');

async function loadState() {
    try {
        const db = getDb();
        if (!db) return { activeMessages: [] };
        const collection = db.collection('mood_state');
        const doc = await collection.findOne({ _id: 'state' });
        if (!doc) {
            return { activeMessages: [] };
        }
        const { _id, ...rest } = doc;
        return rest;
    } catch (err) {
        console.error('❌ Error loading Mood state from MongoDB:', err);
    }
    return { activeMessages: [] };
}

async function saveState(state) {
    try {
        const db = getDb();
        if (!db) return;
        const collection = db.collection('mood_state');
        const { _id, ...rest } = state;
        await collection.updateOne(
            { _id: 'state' },
            { $set: rest },
            { upsert: true }
        );
    } catch (err) {
        console.error('❌ Error saving Mood state to MongoDB:', err);
    }
}

async function setDailyMessage(messageId, timeOfDay) {
    const state = await loadState();
    if (timeOfDay === 'morning') {
        state.morningMessageId = messageId;
    } else {
        state.afternoonMessageId = messageId;
    }
    await saveState(state);
}

async function isActiveMessage(messageId) {
    const state = await loadState();
    if (state.staticMessageId === messageId) return true;
    return state.morningMessageId === messageId || state.afternoonMessageId === messageId;
}

async function getMessageSession(messageId) {
    const state = await loadState();
    if (state.morningMessageId === messageId) return 'morning';
    if (state.afternoonMessageId === messageId) return 'afternoon';
    if (state.staticMessageId === messageId) return 'static';
    return null;
}

// Send daily mood message with options
async function sendDailyMoodMessage(client, timeOfDay = 'morning', targetChannelId = null) {
    try {
        const channelId = targetChannelId || DAILY_CHANNEL_ID;
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            console.error(`❌ Channel with ID '${channelId}' not found`);
            return;
        }

        const moodList = MOOD_CONFIG.map(m => `<:${m.emojiName}:${m.emojiId}> <@&${m.roleId}> *(${m.name})*`).join('\n');

        let embed;
        if (timeOfDay === 'morning') {
            embed = new EmbedBuilder()
                .setColor('#FFD700') // Gold color for morning
                .setTitle('🌅 Pagi, Daily Mood Check!')
                .setDescription(`*Gimana keadaan mood kamu saat ini?*\n\n${moodList}`)
                .setFooter({ text: 'Website Mood Tracker' })
                .setTimestamp();
        } else {
            embed = new EmbedBuilder()
                .setColor('#9370DB') // Purple color for evening
                .setTitle('🌆 Sore, Gimana hari kamu?')
                .setDescription(`*Apa mood-nya baik-baik saja?*\n\n${moodList}`)
                .setFooter({ text: 'Website Mood Tracker' })
                .setTimestamp();
        }

        // Send message
        const message = await channel.send({
            embeds: [embed]
        });

        // Track message by session (morning/evening) — only for the main daily channel
        if (!targetChannelId) {
            await setDailyMessage(message.id, timeOfDay);
        }

        // Add custom emoji reactions
        for (const mood of MOOD_CONFIG) {
            try {
                await message.react(mood.emojiId);
            } catch (reactError) {
                // Gracefully log warning since dummy IDs will fail
                console.warn(`⚠️ Failed to react with custom emoji ${mood.emojiName} (${mood.emojiId}): ${reactError.message}`);
            }
        }

        console.log(`✅ ${timeOfDay} mood message sent successfully to channel ${channelId}`);
    } catch (error) {
        console.error('❌ Error sending daily mood message:', error);
    }
}

// Reset reactions on a daily message back to 1 (bot-only) per emoji
async function resetDailyMessageReactions(client, messageId, channelId) {
    if (!messageId) return;
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) return;
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) return;

        console.log(`🔄 [General Mood] Resetting reactions on daily message ${messageId}...`);
        await message.reactions.removeAll();

        for (const mood of MOOD_CONFIG) {
            try {
                await message.react(mood.emojiId);
            } catch (err) {
                console.warn(`⚠️ Failed to re-react ${mood.emojiName}: ${err.message}`);
            }
        }
        console.log(`✅ [General Mood] Daily message reactions reset to 1 per emoji.`);
    } catch (error) {
        console.error('❌ [General Mood] Error resetting daily message reactions:', error);
    }
}

// Reset all mood roles from guild members
async function resetAllMoodRoles(client) {
    console.log('🔄 [General Mood] Starting daily mood roles reset...');
    try {
        const channel = await client.channels.fetch(DAILY_CHANNEL_ID);
        if (!channel || !channel.guild) {
            console.error('❌ [General Mood] Could not find target channel or its guild for resetting mood roles');
            return;
        }
        const guild = channel.guild;

        const allMoodRoleIds = MOOD_CONFIG.map(m => m.roleId);
        let resetCount = 0;

        for (const roleId of allMoodRoleIds) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
                const membersWithRole = Array.from(role.members.values());
                for (const member of membersWithRole) {
                    try {
                        await member.roles.remove(role);
                        resetCount++;
                        console.log(`✅ Removed mood role ${role.name} from ${member.displayName}`);
                    } catch (err) {
                        console.error(`❌ Failed to remove role ${role.name} from ${member.displayName}:`, err.message);
                    }
                }
            } else {
                console.warn(`⚠️ Role with ID ${roleId} not found in guild during reset.`);
            }
        }
        console.log(`✅ [General Mood] Reset mood roles completed. Removed roles from ${resetCount} member(s).`);

        // Reset reactions on yesterday's daily messages
        const state = await loadState();
        await resetDailyMessageReactions(client, state.morningMessageId, DAILY_CHANNEL_ID);
        await resetDailyMessageReactions(client, state.afternoonMessageId, DAILY_CHANNEL_ID);

        // Clear stored daily message IDs and cross-session mood tracking (fresh day)
        state.morningMessageId = null;
        state.afternoonMessageId = null;
        state.dailyUserMoods = {};
        await saveState(state);

        // Reset static message reactions too
        await resetStaticEmbedReactions(client);
    } catch (error) {
        console.error('❌ [General Mood] Error resetting mood roles:', error);
    }
}

// Initialize scheduling & registers slash commands
async function initGeneralMood(client) {
    try {
        const moodCommand = new SlashCommandBuilder()
            .setName('moodtest')
            .setDescription('Send daily mood tracker messages to this channel for testing')
            .addStringOption(option => 
                option.setName('time')
                    .setDescription('Select time of day')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Morning', value: 'morning' },
                        { name: 'Afternoon', value: 'afternoon' }
                    )
            );

        const moodResetCommand = new SlashCommandBuilder()
            .setName('moodreset')
            .setDescription('Manually trigger resetting all mood roles for testing');

        const moodTrackerSetupCommand = new SlashCommandBuilder()
            .setName('mood-tracker-setup')
            .setDescription('Setup static mood tracker embed in #mood-tracker channel');

        await client.application.commands.create(moodCommand);
        await client.application.commands.create(moodResetCommand);
        await client.application.commands.create(moodTrackerSetupCommand);
        console.log('Successfully registered general mood commands.');
    } catch (error) {
        console.error('Error registering general mood commands:', error);
    }

    // Schedule single daily reset at 3:00 AM WIB (Asia/Jakarta)
    cron.schedule('0 3 * * *', async () => {
        console.log('🔄 [General Mood] Running scheduled daily mood reset at 3 AM WIB...');
        await resetAllMoodRoles(client);
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    // Schedule morning message at 7:20 AM WIB (Asia/Jakarta)
    cron.schedule('20 7 * * *', () => {
        console.log('🌅 [General Mood] Sending morning daily mood check...');
        sendDailyMoodMessage(client, 'morning');
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    // Schedule afternoon/evening message at 7:20 PM WIB (19:20 WIB) (Asia/Jakarta)
    cron.schedule('20 19 * * *', () => {
        console.log('🌆 [General Mood] Sending afternoon daily mood check...');
        sendDailyMoodMessage(client, 'evening');
    }, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    console.log('📅 Daily mood tracker scheduler running:');
    console.log('   🌙 Daily reset: 3:00 AM WIB (roles + daily message reactions)');
    console.log('   🌅 Morning check: 7:20 AM WIB');
    console.log('   🌆 Afternoon check: 7:20 PM WIB');
}

// Handle slash command interaction
async function handleGeneralMoodInteraction(interaction) {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'moodtest') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    content: '❌ You need administrator permission to use this command.',
                    ephemeral: true
                });
                return true;
            }

            await interaction.reply({
                content: '✅ Test mood message sent! (Selected time version will appear here)',
                ephemeral: true
            });

            const timeSelection = interaction.options.getString('time');
            const timeParam = timeSelection === 'afternoon' ? 'evening' : 'morning';

            await sendDailyMoodMessage(interaction.client, timeParam, interaction.channelId);

            return true;
        }

        if (interaction.commandName === 'moodreset') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    content: '❌ You need administrator permission to use this command.',
                    ephemeral: true
                });
                return true;
            }

            await interaction.reply({
                content: '🔄 Resetting all mood roles from members...',
                ephemeral: true
            });

            await resetAllMoodRoles(interaction.client);

            await interaction.followUp({
                content: '✅ All mood roles have been successfully reset!',
                ephemeral: true
            });

            return true;
        }

        if (interaction.commandName === 'mood-tracker-setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    content: '❌ You need administrator permission to use this command.',
                    ephemeral: true
                });
                return true;
            }

            await interaction.reply({
                content: '🔄 Setting up static mood tracker...',
                ephemeral: true
            });

            await setupStaticMoodTracker(interaction.client, interaction);
            return true;
        }
    }
    return false;
}

// Handle reaction add event
async function handleGeneralMoodReactionAdd(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('❌ Error fetching reaction:', error);
            return;
        }
    }

    if (!await isActiveMessage(reaction.message.id)) return;

    // Custom emoji uses ID, fallback to name if unicode
    const emojiId = reaction.emoji.id;
    const mood = MOOD_CONFIG.find(m => m.emojiId === emojiId);
    if (!mood) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    let member = reaction.message.member;
    if (!member || member.id !== user.id) {
        try {
            member = await guild.members.fetch(user.id);
        } catch (err) {
            console.error('❌ Error fetching guild member:', err);
            return;
        }
    }

    const roleId = mood.roleId;
    const role = guild.roles.cache.get(roleId);

    // Remove all other mood roles from the user first
    const allMoodRoleIds = MOOD_CONFIG.map(m => m.roleId);
    const currentMoodRoles = member.roles.cache.filter(r => allMoodRoleIds.includes(r.id));
    if (currentMoodRoles.size > 0) {
        try {
            await member.roles.remove(currentMoodRoles);
            console.log(`✅ Removed previous mood roles from ${member.displayName}`);
        } catch (error) {
            console.error('❌ Error removing previous mood roles:', error);
        }
    }

    // Remove user's reactions from other mood emojis on this message
    const message = reaction.message;
    const session = await getMessageSession(message.id);
    const state = await loadState();
    const isStatic = session === 'static';

    if (isStatic) {
        // Find previous mood emoji ID for this user from state
        const previousEmojiId = state.userMoods ? state.userMoods[user.id] : null;
        if (previousEmojiId && previousEmojiId !== emojiId) {
            const prevReaction = message.reactions.cache.get(previousEmojiId);
            if (prevReaction) {
                try {
                    await prevReaction.users.remove(user.id);
                    console.log(`✅ [Static] Removed ${user.username}'s reaction from previous mood ${previousEmojiId}`);
                } catch (error) {
                    console.error(`❌ [Static] Error removing reaction for previous mood:`, error.message);
                }
            }
        }
        // Save new mood to state
        if (!state.userMoods) state.userMoods = {};
        state.userMoods[user.id] = emojiId;
        await saveState(state);
    } else {
        // Daily message: morning & afternoon are ONE unified daily session.
        // Remove previous reaction on THIS message first
        const userPreviousReactions = message.reactions.cache.filter(r =>
            r.emoji.id && r.emoji.id !== emojiId && r.users.cache.has(user.id)
        );
        for (const otherReaction of userPreviousReactions.values()) {
            try {
                await otherReaction.users.remove(user.id);
                console.log(`✅ [${session}] Removed ${user.username}'s reaction from ${otherReaction.emoji.name}`);
            } catch (error) {
                console.error(`❌ [${session}] Error removing reaction for ${otherReaction.emoji.name}:`, error);
            }
        }

        // Also remove the user's previous mood from the OTHER daily message (cross-session sync)
        const previousEmojiId = state.dailyUserMoods ? state.dailyUserMoods[user.id] : null;
        if (previousEmojiId) {
            // Determine the other session's message ID
            const otherMessageId = session === 'morning' ? state.afternoonMessageId : state.morningMessageId;
            if (otherMessageId) {
                try {
                    const otherMessage = await reaction.message.channel.client.channels
                        .fetch(DAILY_CHANNEL_ID)
                        .then(ch => ch.messages.fetch(otherMessageId))
                        .catch(() => null);
                    if (otherMessage) {
                        const prevReactionOnOther = otherMessage.reactions.cache.get(previousEmojiId);
                        if (prevReactionOnOther) {
                            await prevReactionOnOther.users.remove(user.id);
                            console.log(`✅ [${session}→other] Cleared ${user.username}'s old mood reaction from the other daily message`);
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️ Could not clear cross-session reaction for ${user.username}:`, err.message);
                }
            }
        }

        // Save this user's current daily mood for future cross-session cleanup
        if (!state.dailyUserMoods) state.dailyUserMoods = {};
        state.dailyUserMoods[user.id] = emojiId;
        await saveState(state);

        console.log(`✅ [${session}] ${user.username} daily mood updated to ${mood.name}`);
    }

    // Assign the new mood role
    if (role) {
        try {
            await member.roles.add(role);
            console.log(`✅ Added role ${role.name} to ${member.displayName}`);
        } catch (error) {
            console.error(`❌ Error adding role ${roleId}:`, error);
        }
    } else {
        console.warn(`⚠️ Role with ID ${roleId} not found in guild (likely a dummy role).`);
    }
}

// Handle reaction remove event
async function handleGeneralMoodReactionRemove(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('❌ Error fetching reaction:', error);
            return;
        }
    }

    if (!await isActiveMessage(reaction.message.id)) return;

    const emojiId = reaction.emoji.id;
    
    // Clear user mood from state if it's the static message
    const state = await loadState();
    const isStatic = state.staticMessageId === reaction.message.id;
    if (isStatic) {
        if (state.userMoods && state.userMoods[user.id] === emojiId) {
            delete state.userMoods[user.id];
            await saveState(state);
            console.log(`🧹 Cleared mood state mapping for ${user.username} (manually unreacted).`);
        }
    }
    const mood = MOOD_CONFIG.find(m => m.emojiId === emojiId);
    if (!mood) return;

    const guild = reaction.message.guild;
    if (!guild) return;

    let member = reaction.message.member;
    if (!member || member.id !== user.id) {
        try {
            member = await guild.members.fetch(user.id);
        } catch (err) {
            console.error('❌ Error fetching guild member:', err);
            return;
        }
    }

    const roleId = mood.roleId;
    const role = guild.roles.cache.get(roleId);

    if (role) {
        try {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(role);
                console.log(`✅ Removed role ${role.name} from ${member.displayName}`);
            }
        } catch (error) {
            console.error(`❌ Error removing role ${roleId}:`, error);
        }
    } else {
        console.warn(`⚠️ Role with ID ${roleId} not found in guild (likely a dummy role).`);
    }
}

const MOOD_TRACKER_CHANNEL_ID = '1519719790493696082';

// Set up the static mood tracker in the specific channel
async function setupStaticMoodTracker(client, interaction) {
    try {
        const channel = await client.channels.fetch(MOOD_TRACKER_CHANNEL_ID).catch(() => null);
        if (!channel) {
            return await interaction.editReply({
                content: `❌ Tidak dapat menemukan channel mood-tracker dengan ID ${MOOD_TRACKER_CHANNEL_ID}`
            });
        }

        const state = await loadState();

        // Delete old message if exists
        if (state.staticMessageId) {
            try {
                const oldMsg = await channel.messages.fetch(state.staticMessageId).catch(() => null);
                if (oldMsg) {
                    await oldMsg.delete();
                    console.log('🗑️ Deleted old static mood tracker message.');
                }
            } catch (e) {
                console.warn('⚠️ Failed to delete old static mood tracker message:', e.message);
            }
        }

        // Build premium embed
        const moodList = MOOD_CONFIG.map(m => `<:${m.emojiName}:${m.emojiId}> <@&${m.roleId}> *(${m.name})*`).join('\n');
        const embed = new EmbedBuilder()
            .setColor('#5865F2') // Blurple
            .setTitle('✨ Begadang Daily Mood Tracker')
            .setDescription(`*Gimana keadaan mood kamu hari ini? Pilih emoji di bawah untuk memperbarui mood kamu di server dan di website!*\n\n${moodList}`)
            .setFooter({ text: 'Daily Mood Tracker' })
            .setTimestamp();

        const message = await channel.send({ embeds: [embed] });

        // Save state
        state.staticMessageId = message.id;
        state.userMoods = {};
        await saveState(state);

        await interaction.editReply({
            content: `✅ Berhasil memasang static mood tracker di channel <#${MOOD_TRACKER_CHANNEL_ID}>!`
        });

        // Pre-react with all 19 emojis
        for (const mood of MOOD_CONFIG) {
            try {
                await message.react(mood.emojiId);
            } catch (err) {
                console.warn(`⚠️ Failed to react with custom emoji ${mood.emojiName}: ${err.message}`);
            }
        }

    } catch (error) {
        console.error('❌ Error setting up static mood tracker:', error);
        await interaction.editReply({
            content: `❌ Terjadi kesalahan saat setup static mood tracker: \`${error.message}\``
        });
    }
}

// Reset reactions on the static embed
async function resetStaticEmbedReactions(client) {
    const state = await loadState();
    if (!state.staticMessageId) return;

    try {
        const channel = await client.channels.fetch(MOOD_TRACKER_CHANNEL_ID).catch(() => null);
        if (!channel) {
            console.error('❌ [Mood Tracker] Could not find static mood tracker channel');
            return;
        }

        const message = await channel.messages.fetch(state.staticMessageId).catch(() => null);
        if (!message) {
            console.error('❌ [Mood Tracker] Could not find static mood tracker message:', state.staticMessageId);
            return;
        }

        console.log('🔄 [Mood Tracker] Resetting static embed reactions...');
        
        // Remove all reactions
        await message.reactions.removeAll();

        // Reset state mapping
        state.userMoods = {};
        await saveState(state);

        // Re-react
        for (const mood of MOOD_CONFIG) {
            try {
                await message.react(mood.emojiId);
            } catch (err) {
                console.warn(`⚠️ Failed to react with custom emoji ${mood.emojiName}: ${err.message}`);
            }
        }
        console.log('✅ [Mood Tracker] Static embed reactions reset to 1,1,1.');
    } catch (error) {
        console.error('❌ [Mood Tracker] Error resetting static embed reactions:', error);
    }
}

module.exports = {
    initGeneralMood,
    handleGeneralMoodInteraction,
    handleGeneralMoodReactionAdd,
    handleGeneralMoodReactionRemove
};
