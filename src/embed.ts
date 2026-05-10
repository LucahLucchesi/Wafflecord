import { EmbedBuilder, Colors } from "discord.js";

export function liveEmbed(players) {
  const playerList =
    players.length > 0
      ? players.map((p) => `\`${p.name}\``).join("\n")
      : "_No players listed_";

  return new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("Minecraft Server")
    .addFields(
      { name: "Status", value: "🟢 Online", inline: true },
      { name: "Players Online", value: `${players.length}`, inline: true },
      { name: "Player List", value: playerList }
    )
    .setFooter({ text: "Updated" })
    .setTimestamp();
}

export function deadEmbed(lastOnline) {
  return new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle("Minecraft Server")
    .addFields(
      { name: "Status", value: "🔴 Offline", inline: true},
      { name: "Last Online", value: `<t:${Math.floor(lastOnline / 1000)}:R>`, inline: true },
      { name: "Start", value: "Use /start or contact LitWaffle"}
    )
    .setFooter({ text: `Updated` })
    .setTimestamp();
}