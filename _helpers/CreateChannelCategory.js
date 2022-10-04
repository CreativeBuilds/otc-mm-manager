
async function CreateChannelCategory({
  all_categories, ChannelName, guild, positionLength, permissionOverwrites,
}) {
  let active_trades_category = all_categories.find(
    (category) => category.name.toLowerCase() === ChannelName.toLowerCase()
  );
  if (!active_trades_category) {
    // create category in last position
    active_trades_category = await guild.channels.create({
      name: ChannelName,
      type: 4,
      // only allow middlepersons to see this
      permissionOverwrites: permissionOverwrites,
    });
    await active_trades_category.setPosition(positionLength);
  }
  return active_trades_category;
}
exports.CreateChannelCategory = CreateChannelCategory;
