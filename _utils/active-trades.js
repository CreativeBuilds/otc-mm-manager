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

module.exports = {
    active_trades,
    Trade
}