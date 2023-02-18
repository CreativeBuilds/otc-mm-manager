const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, ActionRow, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { active_trades, Trade } = require('../_utils/active-trades');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('trade')
		.setDescription('Creates an escrow channel and requests a middleperson.\n\n**Usage:**\n/trade @trader1 wts 100 USDC 3000')
		.addUserOption(option => option.setName('partner').setDescription('The user you want to trade with.').setRequired(true))
		.addStringOption(option => option.setName('wts-or-wtb').setDescription('Are you selling or buying tao?').setRequired(true))
		.addNumberOption(option => option.setName('amount').setDescription('How much tao are you trading?').setRequired(true))
		.addStringOption(option => option.setName('payment-currency').setDescription('Token expected by seller (ETH, USDC, etc)').setRequired(true))
		.addNumberOption(option => option.setName('total-price').setDescription('Total amount to be sent to seller by buyer in').setRequired(true)),
	async execute(interaction) {
		// generate random 8 character string
		const ticket_id = Math.random().toString(36).substring(2, 10);
		const partner = interaction.options.getUser('partner');
		
		// verify partner is not self, or bot
		if (partner.id === interaction.user.id) {
			return interaction.reply({ content: 'You cannot trade with yourself.', ephemeral: true });
		} else if (partner.bot) {
			return interaction.reply({ content: 'You cannot trade with a bot.', ephemeral: true });
		}

		wts_or_wtb = interaction.options.getString('wts-or-wtb').toLowerCase();
		const selling_keys = ['wts', 'sell', 'selling', 'for sale', 'sale'];
		const buying_keys = ['wtb', 'buy', 'buying', 'for purchase', 'purchase'];

		// ensure wts_or_wtb is valid
		if (!selling_keys.includes(wts_or_wtb) && !buying_keys.includes(wts_or_wtb)) {
			return interaction.reply({ content: 'You must specify whether you are selling or buying tao.', ephemeral: true });
		} else if (selling_keys.includes(wts_or_wtb)) {
			wts_or_wtb = 0; // 0 for selling 1 for buying
		} else if (buying_keys.includes(wts_or_wtb)) {
			wts_or_wtb = 1;
		}

		const amount = interaction.options.getNumber('amount');

		// ensure amount is valid
		if (amount <= 0) {
			return interaction.reply({ content: 'You must specify a valid amount of tao.', ephemeral: true });
		}

		const currency = interaction.options.getString('payment-currency').toUpperCase();
		const total_price = interaction.options.getNumber('total-price');

		// ensure total_price is valid
		if (total_price <= 0) {
			return interaction.reply({ content: 'You must specify a valid total price.', ephemeral: true });
		}

		const actionrow = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId(`startTrade-${ticket_id}`)
					.setLabel('Accept')
					.setStyle(ButtonStyle.Success),
			)

		active_trades.set(ticket_id, new Trade(
			interaction.user,
			partner,
			wts_or_wtb,
			amount,
			currency,
			total_price,
			ticket_id
		)) 

		return interaction.reply({
			content: `You want to ${wts_or_wtb ? "buy" : "sell"} ${amount} tao ${wts_or_wtb ? "from" : "to"} ${partner} for a total of ${total_price} ${currency}.\n\n**WARNING:** *Scammers will try to impersonate other users through DMs. For that reason, **All trades are to be conducted within this server.** Please be careful when trading with someone you don't know. If you are unsure, please ask a moderator for help.*`,
			components: [actionrow],
			ephemeral: true
		}).then(() => {
			console.log("Posted trade request.");
		})


	},
};