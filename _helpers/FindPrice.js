// File Desc:
// Given a crypto currency (btc, eth, etc) and a amount, find the price in usd
// Use an api that doesnt require an api key like coingecko

const axios = require("axios");
const { MessageEmbed } = require("discord.js");

const currencies = [
    "bitcoin",
    "ethereum",
    "litecoin",
    "dogecoin",
]

const symbols = [
    "btc",
    "eth",
    "ltc",
    "doge",
];

const prices = {
    bitcoin: null,
    ethereum: null,
    litecoin: null,
    dogecoin: null,
}

const FindPrice = async (currency, amount) => {
    // convert currency to full name if it is a symbol
    if (symbols.includes(currency.toLowerCase())) {
        currency = currencies[symbols.indexOf(currency.toLowerCase())];
    }
    if (!currencies.includes(currency)) return "Invalid currency"; 
    let price = prices[currency.toLowerCase()];
    if (!price) {
        await UpdatePrices();
        price = prices[currency.toLowerCase()];

        if (!price) return "Error getting price";;
    }
    return price * amount;
};

module.exports = FindPrice;

setTimeout(() => {
    UpdatePrices();
}, 1000 * 60 * 5);


async function UpdatePrices() {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${currencies.join(",")}&vs_currencies=usd`;
    return axios
        .get(url)
        .then((res) => {

            for (let currency of currencies) {
                prices[currency] = res.data[currency]?.usd;
            }

        })
        .catch((err) => {
            console.log(err);
        });
}
// Language: javascript
// Path: _helpers/GetAllMessages.js
// Compare this snippet from _utils/active-trades.js:
//         this.initiator = initiator;
//         this.partner = partner;
//         this.wts_or_wtb = wts_or_wtb;
//         this.amount = amount;
//         this.currency = currency;
//         this.total_price = total_price;
//         this.ticket_id = ticket_id;
//     }
// 
//     addMiddle(middle) {
//         this.middlemen.push(middle);
//     }
//     hasMiddle(middle) {
//         console.log(this.middlemen.map(i => i.id), middle)
//         return this.middlemen.map(i => i.id).includes(
//             middle.id
//         );
//     }
//     get middleperson() {
//         return this.middlemen[0];
//     }
//     set middleperson(middle) {
//         this.addMiddle(middle);
//     }
// }
// 
// const active_trades = new Map();
// 
// async function LoadTrades(category) {
//     // find all channels in category and get all messages sent in channel
//     // find all messages that are from the bot
//     // get the first message and parse the content to get the trade info
//     // add the trade to the map
// 
//     const channels = category.children.cache.map(a => a);
//     const guild = category.guild;
//     const ticket_channel = guild.channels.cache.find(
//         (channel) => channel.name.toLowerCase() === "tickets"
//     );
//     let oldestMessage;
//     for (let i = 0; i < channels.length; i++) {
//         const channel = channels[i];
//         const messages = await GetAllMessages(channel);
//         const botMessages = messages.filter(m => m.author.bot).