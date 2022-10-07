// create a command that will return the price of one of the following currencies: bitcoin, ethereum, litecoin, dogecoin
//
// the command should be called price
// the command should take two arguments: currency and amount
// the command should return the price of the currency in USD
// the command should return an error if the currency is not one of the four listed above
// the command should return an error if the amount is not a number
// the command should return an error if the amount is less than 0

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, ActionRow, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { active_trades, Trade } = require('../_utils/active-trades');
const FindPrice = require('../_helpers/FindPrice');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('price')
        .setDescription('Get the price of a currency')
        .addStringOption(option => option.setName('currency').setDescription('eth btc ltc doge').setRequired(true))
        .addNumberOption(option => option.setName('amount').setDescription('The amount of the currency you want to get the price of').setRequired(true)),
	async execute(interaction) {
        const currency = interaction.options.getString('currency');
        const amount = interaction.options.getNumber('amount');

        const price = await FindPrice(currency, amount);

        return interaction.reply({ ephemeral: true,
            content: `The price of ${amount} ${currency} is ${price} USD.`});

	},
};