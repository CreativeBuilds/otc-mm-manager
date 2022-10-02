/**
 *  MIDDLE MAN DISCORD ORGANIZER
 *
 *  Will create new tickets when users request a middleperson in a mod channel
 *
 *  Middleperson accepts which creates a channel in which only that middleperson and traders can see
 */

// invite: https://discord.com/api/oauth2/authorize?client_id=1025021163904172043&permissions=76880&scope=bot%20applications.commands

const { GatewayIntentBits } = require("discord.js");
const Discord = require("discord.js");
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { active_trades } = require("./_utils/active-trades");

async function start() {
  // with valid intents
  const client = new Discord.Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.commands = new Discord.Collection();
  const commandsPath = path.join(__dirname, "commands");
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection
    // With the key as the command name and the value as the exported module
    client.commands.set(command.data.name, command);
  }

  client.on("ready", (client) => {
    console.log("I am ready as", client.user.tag);
    client.commands.map((command) => {
      client.application.commands.create(command.data);
    });
  });

  // Handle Button Interactions
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    const ID_PARTS = interaction.customId.split("-");
    const command = ID_PARTS[0];
    const key = ID_PARTS[1];
    const all_categories = interaction.guild.channels.cache.filter(
      (channel) => channel.type === 4
    );
    const POSITION_LENGTH = all_categories.size;
    let activeTrade = active_trades[key];

    if (!activeTrade && command == "confirmTrade") {
      interaction.reply({ content: "This trade has expired", ephemeral: true });
      command = "cancelTrade";
    }

    switch (command) {
      case "startTrade":
        if (!activeTrade) {
          return interaction.reply({
            content: "Trade expired, please try again",
            ephemeral: true,
          });
        }
        // check if person who clicked is the person who requested the trade
        if(interaction.user.id === activeTrade.initiator.id) {
          // create channel and add both users to it
          // channel should be under the category of the "active trades" channel
          // get active trades channel category by name match

          const ChannelName = "Active Trades";
          let active_trades_category = await CreateChannelCategory({
            all_categories,
            ChannelName,
            interaction,
            positionLength: POSITION_LENGTH,
          });
          // deny everyone from seeing inside
          const channel = await interaction.guild.channels.create({
            name: `${activeTrade.initiator.username}-${activeTrade.partner.username}-${key}`,
            type: 0,
            parent: active_trades_category,
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone,
                deny: ["ViewChannel"],
              },
              {
                // add self/bot
                id: client.user.id,
                allow: ["ViewChannel"],
              },
              {
                id: activeTrade.initiator.id,
                allow: ["ViewChannel"],
              },
              {
                id: activeTrade.partner.id,
                allow: ["ViewChannel"],
              },
            ],
          });
          activeTrade.channel = channel;
          console.log("Created new channel", channel.name);

          // send message alerting both users to the channel and request for confirmation by partner
          const message = await channel.send({
            content: `${
              activeTrade.initiator
            } has initiated a trade request with you ${
              activeTrade.partner
            }.\n Trade:\n\`\`\`${activeTrade.initiator.username} is ${
              activeTrade.wts_or_wtb ? "buying" : "selling"
            } ${activeTrade.amount} tao for a total of ${
              activeTrade.total_price
            } ${
              activeTrade.currency
            }\`\`\`\nPlease confirm or cancel by clicking the buttons below.\n*Note: all messages in trade channels are logged and can be used as evidence in the event of a dispute.*`,
            components: [
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`confirmTrade-${key}`)
                  .setLabel("Confirm")
                  .setStyle("Success")
              ),
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`cancelTrade-${key}`)
                  .setLabel("Cancel")
                  .setStyle("Danger")
              ),
              // new Discord.MessageActionRow().addComponents(
              //     new Discord.MessageButton()
              //         .setCustomId(`editTrade-${key}`)
              //         .setLabel("Edit")
              //         .setStyle("SECONDARY")
              //         // disabled
              //         .setDisabled(true)
              // ),
            ],
          });
          
          await interaction.update({
            content: `Trade request sent to ${activeTrade.partner}`,
            components: [],
          })
        }
        break;
      case "confirmTrade":
        // check if person who clicked is the person who requested the trade
        if (interaction.user.id === activeTrade.initiator.id)
          return interaction.reply({
            content: "You've already confirmed the trade!",
            ephemeral: true,
          })
        else if (interaction.user.id === activeTrade.partner.id) {
          activeTrade.partner_accepted = true;

          // create new ticket for middlepersons
          // channel should be under the category of the "Middlepersons"

          const middlepersons_category = await CreateChannelCategory({
            all_categories,
            ChannelName: "Middlepersons",
            interaction,
            positionLength: POSITION_LENGTH,
          });

          // clear buttons from message
          await interaction.update({
            components: [],
          });

          // get channel in category labeled "tickets" using discordjs
          let tickets_channel = interaction.guild.channels.cache.filter(
            (channel) => channel.name.toLowerCase() === "tickets"
          );
          // if tickets doesnt exist, create it
          if (!tickets_channel || tickets_channel.size === 0) {
            tickets_channel = await interaction.guild.channels.create({
              name: "Tickets",
              type: 0,
              parent: middlepersons_category,
              permissionOverwrites: [
                {
                  id: interaction.guild.roles.everyone,
                  deny: ["ViewChannel"],
                },
                {
                  // add self/bot
                  id: client.user.id,
                  allow: ["ViewChannel"],
                },
                {
                  id: process.env.MIDDLEPERSON_ROLE,
                  allow: ["ViewChannel"],
                },
              ],
            });
          } else {
            // first item in collection
            tickets_channel = tickets_channel.first();
            // tickets_channel = tickets_channel[0];
          }
          // create ticket
          const ticket = await tickets_channel.send({
            content: `New trade request from ${activeTrade.initiator} to ${
              activeTrade.partner
            }.\nTrade:\n\`\`\`${activeTrade.initiator.username} is ${
              activeTrade.wts_or_wtb ? "buying" : "selling"
            } ${activeTrade.amount} tao for a total of ${
              activeTrade.total_price
            } ${activeTrade.currency}\`\`\`\nStatus: Looking for Middleperson`,
            components: [
              new Discord.ActionRowBuilder().addComponents(
                new Discord.ButtonBuilder()
                  .setCustomId(`takeTicket-${key}`)
                  .setLabel("Take Ticket")
                  .setStyle("Success")
              ),
            ],
          });
          activeTrade.ticket = ticket;
          interaction.channel.send({
            content: `Trade accepted! A request for a middleperson has been sent.`,
          })
        } else {
          interaction.reply({
            content: "This button is not meant for you",
            ephemeral: true,
          });
        }
        break;
      case "takeTicket":
        // ensure the person who clicked isnt already in the trade
        if (
          interaction.user.id === activeTrade.initiator.id ||
          interaction.user.id === activeTrade.partner.id
        ) {
          interaction.reply({
            content: "You cant be the middleperson in your own trade!",
            ephemeral: true,
          });
          process.env.DEV_LOG ? console.warn(new Date(), interaction.user.username, "tried to middleperson their own trade!") : null;
          return;
        }
        activeTrade.addMiddle(interaction.user);
        // remove buttons from message and add use to channel
        await interaction.update({
          content: `New trade request from ${activeTrade.initiator} to ${
            activeTrade.partner
          }.\nTrade:\n\`\`\`${activeTrade.initiator.username} is ${
            activeTrade.wts_or_wtb ? "buying" : "selling"
          } ${activeTrade.amount} tao for a total of ${
            activeTrade.total_price
          } ${activeTrade.currency}\`\`\`\nStatus: In Progress by ${
            activeTrade.middleperson
          }`,
          components: [],
        });
        // add user to channel
        await activeTrade.channel.permissionOverwrites.edit(
          interaction.user.id,
          {
            ViewChannel: true,
          }
        );

        // send message to channel
        await activeTrade.channel.send({
          content: `${activeTrade.initiator} and ${activeTrade.partner} your trade will be handled by the Official OTC Middleperson, ${activeTrade.middleperson}. \n\n Steps\n1. ${activeTrade.middleperson} will post a TAO address for the seller to send to.\n2. Once paid, ${activeTrade.middleperson} will ask the buyer to send payment to the seller.\n3. Once payment has been received by the seller in their specified currency, ${activeTrade.middleperson} will send the TAO to the buyer.\n\n*Note: All middlepersons are volunteers and offer up their time freely, feel free to send an extra 1-5% as tip if you're feeling generous* **(Sellers: Always send 0.126 TAO extra to pay for the transaction fee)**`,
          // component to close ticket,
          components: [
            new Discord.ActionRowBuilder().addComponents(
              new Discord.ButtonBuilder()
                .setCustomId(`closeTicket-${key}`)
                .setLabel("Close")
                .setStyle("Danger")
            ),
          ],
        });
        break;
      case "closeTicket":
        // ensure user is middleperson
        if (activeTrade.hasMiddle(interaction.user)) {
          // remove buttons
          await interaction.update({
            components: [],
          });
          // send message to channel and delete ticket in 15 seconds

          await activeTrade.channel.send({
            content: `Trade between ${activeTrade.initiator} and ${activeTrade.partner} has been completed by ${activeTrade.middleperson}. closing channel in 15 seconds.`,
          });
          const CHANNEL = activeTrade.channel;

          // delete ticket in 15 seconds
          setTimeout(async () => {
            await CHANNEL.delete();

            await activeTrade.ticket.edit({
              content: `Trade request from ${activeTrade.initiator} to ${
                activeTrade.partner
              }.\nTrade:\n\`\`\`${activeTrade.initiator.username} is ${
                activeTrade.wts_or_wtb ? "buying" : "selling"
              } ${activeTrade.amount} tao for a total of ${
                activeTrade.total_price
              } ${activeTrade.currency}\`\`\`\nStatus: Completed`,
            });
          }, 15000);
        } else {
          await interaction.reply({
            content: "This button is not meant for you",
            ephemeral: true,
          });
        }
        break;
      case "cancelTrade":
        // check if person who clicked is the person who requested the trade
        let cancel_party;
        if (!!activeTrade && interaction.user.id === activeTrade.initiator.id) {
          console.log("Initial party backed out of trade");

          // TODO: make a way to log the back out of this trade and tie it to the user
          cancel_party = "initial";
        }
        await interaction.message.edit({
          components: [],
        });

        const content = `Trade has been terminated by ${
          !!activeTrade
            ? cancel_party == "initial"
              ? activeTrade.initiator
              : activeTrade.partner
            : "system reset"
        }.\nDeleting channel one minute from now...`;
        // await interaction.deleteReply();
        // remove channel from active trades
        await interaction.reply({
          content: content,
        });
        process.env.DEV_LOG ? console.log(content) : null;
        // remove buttons from message
        const TRADE_CHANNEL = interaction.channel;

        setTimeout(async () => {
          await TRADE_CHANNEL.delete()
            .then(() => {})
            .catch((err) => {
              console.error(err);
              console.log("failed to delete channel, already deleted?", TRADE_CHANNEL.name, TRADE_CHANNEL.id);
            });
        }, 60000);
        return;
    }
  });

  // Handle Commands
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: "There was an error while executing this command!",
        ephemeral: true,
      });
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

start();
async function CreateChannelCategory({
  all_categories,
  ChannelName,
  interaction,
  positionLength,
}) {
  let active_trades_category = all_categories.find(
    (category) => category.name.toLowerCase() === ChannelName.toLowerCase()
  );
  if (!active_trades_category) {
    // create category in last position
    active_trades_category = await interaction.guild.channels.create({
      name: ChannelName,
      type: 4,
    });
    await active_trades_category.setPosition(positionLength);
  }
  return active_trades_category;
}
