const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ----------------- الإعدادات -----------------
const TOKEN = process.env.DISCORD_TOKEN; // تم تعديل هذا السطر
const REQUESTS_CHANNEL_ID = "1411137361378541658";
const ANNOUNCE_CHANNEL_ID = "1404511818625323090";
const PING_ROLE_ID = "1404380126841671771";
const APPROVE_ROLE_ID = "1403866787379941406";
const DATA_FILE = path.join(__dirname, 'data.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// ----------------- دوال حفظ وتحميل البيانات -----------------
function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error parsing data.json:', error);
            return { requests: {} };
        }
    }
    return { requests: {} };
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
}

let data = loadData();

// ----------------- عند تشغيل البوت -----------------
client.on('ready', async () => {
    console.log(`✅ تم تسجيل الدخول كـ ${client.user.tag}`);

    for (const req_id in data.requests) {
        const req = data.requests[req_id];
        if (req.status === 'pending') {
            const channel = client.channels.cache.get(REQUESTS_CHANNEL_ID);
            if (channel) {
                try {
                    const message = await channel.messages.fetch(req_id);
                    if (message && message.components.length === 0) {
                        const view = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setLabel('✅ قبول').setStyle(ButtonStyle.Success).setCustomId('approve'),
                            new ButtonBuilder().setLabel('❌ رفض').setStyle(ButtonStyle.Danger).setCustomId('reject')
                        );
                        message.edit({ components: [view] });
                    }
                } catch (error) {
                    console.error(`Error fetching message ${req_id}:`, error);
                }
            }
        }
    }
});

// ----------------- التعامل مع الأوامر -----------------
client.on('messageCreate', async message => {
    if (!message.guild || !message.content.startsWith('-')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'embed') {
        if (!message.member.permissions.has('Administrator')) {
            return message.reply({ content: "❌ ليس لديك صلاحيات كافية لإنشاء هذه الرسالة.", ephemeral: true });
        }

        const embed = {
            title: "اطلب هجومًا على الهايدرا 🐍",
            description: "(اضغط على الزر في الأسفل لطلب هجوم على الهايدرا 🛡️)",
            color: 0xff0000
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('اطلب هايدرا ⚔️')
                .setStyle(ButtonStyle.Danger)
                .setCustomId('request_hydra')
        );

        message.channel.send({ embeds: [embed], components: [row] });
        message.delete();
    }
});

// ----------------- التعامل مع الأزرار والنوافذ -----------------
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId === 'request_hydra') {
            const modal = new ModalBuilder()
                .setCustomId('requestHydraModal')
                .setTitle('طلب هايدرا 🐍');

            const kindInput = new TextInputBuilder()
                .setCustomId('kindInput')
                .setLabel('نوع الهجوم')
                .setPlaceholder('ريس 🏃‍♂️ أو اسلوب ⚔️')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const codeInput = new TextInputBuilder()
                .setCustomId('codeInput')
                .setLabel('كود الهجوم')
                .setPlaceholder('رقم سري من 10 إلى 999')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(kindInput),
                new ActionRowBuilder().addComponents(codeInput)
            );

            await interaction.showModal(modal);
        }

        if (customId === 'approve' || customId === 'reject') {
            if (!interaction.member.roles.cache.has(APPROVE_ROLE_ID)) {
                return interaction.reply({ content: "❌ ليس لديك صلاحيات كافية للتحكم في هذا الطلب.", ephemeral: true });
            }
            
            const req_id = interaction.message.id;
            const req = data.requests[req_id];

            if (!req || req.status !== 'pending') {
                if (req && req.status === 'approved') {
                    return interaction.reply({
                        content: `لقد تم الموافقة على هذا الطلب مسبقًا من قبل <@${req.by}> ✅`,
                        ephemeral: true
                    });
                } else if (req && req.status === 'rejected') {
                    return interaction.reply({
                        content: `لقد تم رفض هذا الطلب من قبل <@${req.by}> ❌`,
                        ephemeral: true
                    });
                } else {
                    return interaction.reply({
                        content: '⚠️ حالة هذا الطلب غير معروفة.',
                        ephemeral: true
                    });
                }
            }

            if (customId === 'approve') {
                req.status = 'approved';
                req.by = interaction.user.id;
                saveData(data);

                const announceChannel = client.channels.cache.get(ANNOUNCE_CHANNEL_ID);
                if (announceChannel) {
                    const msg = `الان سوف يتم تفريم الهايدرا\nنوع التفريم : ${req.kind}\nالمنظم : <@${req.user_id}>\nالكود : ${req.code}\n<@&${PING_ROLE_ID}>`;
                    await announceChannel.send(msg);
                }

                await interaction.reply({ content: '✅ تم قبول الطلب بنجاح!', ephemeral: true });
                await interaction.message.edit({ components: [] });

            } else if (customId === 'reject') {
                req.status = 'rejected';
                req.by = interaction.user.id;
                saveData(data);

                await interaction.reply({ content: '❌ تم رفض الطلب.', ephemeral: true });
                await interaction.message.edit({ components: [] });
            }
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'requestHydraModal') {
            const kind = interaction.fields.getTextInputValue('kindInput').trim();
            const code = interaction.fields.getTextInputValue('codeInput').trim();

            if (!['ريس', 'اسلوب'].includes(kind)) {
                return interaction.reply({ content: "⚠️ النوع غير صحيح، من فضلك اختر 'ريس' أو 'اسلوب'.", ephemeral: true });
            }
            if (isNaN(code) || code.length < 2 || code.length > 3 || parseInt(code) < 10) {
                return interaction.reply({ content: "⚠️ الكود غير صحيح، يجب أن يكون رقمًا من 10 إلى 999.", ephemeral: true });
            }

            const requestsChannel = client.channels.cache.get(REQUESTS_CHANNEL_ID);
            if (!requestsChannel) {
                return interaction.reply({ content: "❌ لم أتمكن من العثور على القناة المخصصة للطلبات.", ephemeral: true });
            }

            const embed = {
                title: '📝 طلب هجوم جديد على الهايدرا',
                description: `**النوع:** ${kind}\n**الكود:** ${code}\n**المنظم:** <@${interaction.user.id}>`,
                color: 0x800080
            };

            const view = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('✅ قبول').setStyle(ButtonStyle.Success).setCustomId('approve'),
                new ButtonBuilder().setLabel('❌ رفض').setStyle(ButtonStyle.Danger).setCustomId('reject')
            );

            const message = await requestsChannel.send({ embeds: [embed], components: [view] });

            data.requests[message.id] = {
                user_id: interaction.user.id,
                kind: kind,
                code: code,
                status: 'pending',
                by: null
            };
            saveData(data);

            await interaction.reply({ content: '✅ تم إرسال طلبك بنجاح! انتظر موافقة المشرفين.', ephemeral: true });
        }
    }
});

client.login(TOKEN);
