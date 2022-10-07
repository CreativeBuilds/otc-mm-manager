class Trade {
    initiator;
    partner;
    wts_or_wtb;
    amount;
    currency;
    total_price;
    ticket_id;
    channel; // null until trade is accepted by initiator
    partner_accepted = false;
    middlemen = [];
    ticket; // the msg object for the middleman request

    constructor(initiator, partner, wts_or_wtb, amount, currency, total_price, ticket_id) {
        this.initiator = initiator;
        this.partner = partner;
        this.wts_or_wtb = wts_or_wtb;
        this.amount = amount;
        this.currency = currency;
        this.total_price = total_price;
        this.ticket_id = ticket_id;
    }

    addMiddle(middle) {
        this.middlemen.push(middle);
    }
    hasMiddle(middle) {
        console.log(this.middlemen.map(i => i.id), middle)
        return this.middlemen.map(i => i.id).includes(
            middle.id
        );
    }
    get middleperson() {
        return this.middlemen[0];
    }
    set middleperson(middle) {
        this.addMiddle(middle);
    }
}

const active_trades = new Map();

async function LoadTrades(category) {
    // find all channels in category and get all messages sent in channel
    // find all messages that are from the bot
    // get the first message and parse the content to get the trade info
    // add the trade to the map

    const channels = category.children.cache.map(a => a);
    const guild = category.guild;
    const ticket_channel = guild.channels.cache.find(
        (channel) => channel.name.toLowerCase() === "tickets"
    );
    let oldestMessage;
    for (let i = 0; i < channels.length; i++) {
        const channel = channels[i];
        const messages = await GetAllMessages(channel);
        const botMessages = messages.filter(m => m.author.bot).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        if (botMessages.length > 0) {
            if(!oldestMessage) oldestMessage = botMessages[0];
            else if(botMessages[0].createdTimestamp < oldestMessage.createdTimestamp) oldestMessage = botMessages[0];
        }
        const firstBotMessage = botMessages[0];
        const content = firstBotMessage.content;
        const tradeInfo = await ParseTradeInfo(firstBotMessage)
        const trade = new Trade(
            tradeInfo.initiator,
            tradeInfo.partner,
            tradeInfo.wts_or_wtb,
            tradeInfo.amount,
            tradeInfo.currency,
            tradeInfo.total_price,
            tradeInfo.ticket_id
        );
        trade.channel = channel;
        if(firstBotMessage.components.length == 0) {
            trade.partner_accepted = true;

            const middle = botMessages.map(a => a).filter(m => m.mentions.users.size > 0)[1]?.mentions.users.map(a => a).filter(
                (user) => user.id !== trade.initiator.id && user.id !== trade.partner.id
            )[0];
            // determine who the middleman is
            if(!!middle)
                trade.addMiddle(middle);
        }
        active_trades.set(trade.ticket_id, trade);
    }
    // get messages in ticket_channel up to oldestMessage.createdTimestamp
    const ticketMessages = await GetAllMessages(ticket_channel, [], (oldestMessage?.createdTimestamp || undefined));
    const botMessages = ticketMessages.filter(m => m.author.bot).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
    let a_trades = Array.from(active_trades.values());
    let mentions = a_trades.map(a => {
        return ([a.initiator.id, a.partner.id]);
    });
    
    for (let i = 0; i < botMessages.length; i++) {
        const message = botMessages[i];
        const mentions = message.mentions.users.map(a => a.id);
        const trade = a_trades.find(t => mentions.includes(t.initiator.id) && mentions.includes(t.partner.id));
        // console.log(a_trades, active_trades.keys(),);
        // console.log("trade", trade, mentions);
        if(trade && !trade.ticket && trade.partner_accepted) {
            trade.ticket = message;
        }
    }

    return active_trades;

    function GetAllMessages(channel, msgs = [], timestamp_limit = null) {
        const before = msgs[msgs.length - 1] ? msgs[msgs.length - 1].id : null;

        let messages = channel.messages.fetch({ limit: 100, before: before, after: timestamp_limit ? (timestamp_limit)-1000 : undefined });

        return messages.then(messages => {
            if (messages.size % 100 === 0) {
                return GetAllMessages(channel, msgs.concat(messages.map(a => a)));
            } else {
                return msgs.concat(messages.map( a => a ));
            }
        }).then(msgs => {
            return msgs.sort(m => m.createdTimestamp);
        })
    }

    async function ParseTradeInfo(message) {
        let content = message.content;
        // Example content:
        /*
        @CreativeBuilds has initiated a trade request with you @Mike The Node Daddy.
        Trade:
        CreativeBuilds is selling 15000 tao for a total of 460000 USDC

        Please confirm or cancel by clicking the buttons below.
        Note: all messages in trade channels are logged and can be used as evidence in the event of a dispute.
        */
        
        const ids = content.match(/<@!?\d+>/g);
        if(!ids) return;
        const initatior_id = ids[0].slice(2, -1);
        const partner_id = content.match(/<@!?\d+>/g)[1].slice(2, -1);
        const wtswtb = content.match(/selling|buying/g)[0].trim();
        const wts_or_wtb = wtswtb == "selling" ? 0 : wtswtb == "buying" ? 1 : null;
        const currency = content.match(/(\w+)(?=\sfor)/g)[0];
        const ticket_id = message.channel.name.split("-").reverse()[0];

        if(wts_or_wtb == null) {
            throw new Error("wts_or_wtb is null");
        }
        const TRADE = content.split("```")[1];
        const numbers = TRADE.split(" ").map(a => Number(a.trim().replaceAll(",",""))).filter(a => !isNaN(a));
        const tao_amount = numbers[0];
        const total_price = numbers[1];

        let members = (await message.guild.members.fetch()).map(a => a);

        const initiator = members.filter(a => a.id == initatior_id)[0];
        const partner = members.filter(a => a.id == partner_id)[0];

        return {
            initiator: initiator,
            partner: partner,
            wts_or_wtb: wts_or_wtb,
            amount: tao_amount,
            currency: currency,
            total_price: total_price,
            ticket_id: ticket_id
        }

    }


}

async function RemoveStaleTrades() {
    const trades = Array.from(active_trades.values());
    console.log(`Starting to remove stale trades. ${trades.length} trades to check.`);
    const stale = (await Promise.all(trades.map(async trade => {
        // get last message sent in trade channel
        let trade_channel = trade.channel;
        let last_message = (await trade_channel.messages.fetch({ limit: 1 })).map(a => a)[0];
        let last_message_time = last_message.createdTimestamp;
        let now = Date.now();
        let time_since_last_message = now - last_message_time;
        let stale = time_since_last_message > 1000 * 60 * 60 * 12;
        return {
            trade, stale
        };
    }))).filter(({trade, stale}) => stale).map(({trade, stale}) => trade);

    console.log(`Found ${stale.length} stale trades.`);

    for (let i = 0; i < stale.length; i++) {
        const trade = stale[i];
        await trade.channel.delete();

        // dm users that trade was cancelled
        const initiator = trade.initiator;
        const partner = trade.partner;
        const middle = trade.middlemen[0];

        const initiator_dm = await initiator.createDM();
        const partner_dm = await partner.createDM();
        const middle_dm = middle ? await middle.createDM() : null;

        await initiator_dm.send(`Your trade with ${partner} has been cancelled due to inactivity for 12h.`);
        await partner_dm.send(`Your trade with ${initiator} has been cancelled due to inactivity for 12h.`);
        if(middle_dm) await middle_dm.send(`The trade with ${initiator} and ${partner} has been cancelled due to inactivity for 12h.`);

        active_trades.delete(trade.ticket_id);
    }
    return active_trades;
}

module.exports = {
    active_trades,
    LoadTrades,
    Trade
}