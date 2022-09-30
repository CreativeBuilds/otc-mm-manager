const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('Replies with ephereal error message'),
	async execute(interaction) {
        throw new Error('test');
		// await interaction.reply('Pong!');
	},
};