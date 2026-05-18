import { Client, Events, GatewayIntentBits, Message, MessageFlags, TextChannel } from "discord.js";
import { WebSocketConnection, MinecraftServer, Notifications } from "mc-server-management";
import { exec, execSync } from 'child_process';
import { liveEmbed, deadEmbed } from "./embed";
import { promisify } from "util";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const execAsync = promisify(exec);

let channel: TextChannel | null = null;
let pinnedEmbed: Message | null = null;
let embedUpdateInProgress = false; // Boolean lock for race-condition prevention

let connection: WebSocketConnection | null = null;
let serverAPI: MinecraftServer | null = null;

function disconnect() {
  if (!connection) return;
  connection.close();
  connection = null;
  serverAPI = null;
}

async function connect() {
  if (serverAPI) return;
  connection = await WebSocketConnection.connect(process.env.WEBSOCKET_URL!, process.env.AUTH_TOKEN!);
  serverAPI = new MinecraftServer(connection);

  connection.on('close', () => console.log("Connection closed."));
  connection.on('error', (error) => console.error(error));
  connection.on('max_reconnects_reached', () => {
    console.error('Maximum reconnect attempts reached.');
    disconnect();
    updateEmbed().catch(console.error);
  });

  serverAPI.on('error', (error) => console.error('Connection error: ', error));

  // Notifications
  serverAPI.on(Notifications.PLAYER_JOINED, user => {
    console.log(`${user.name} joined.`);
    updateEmbed().catch(console.error);
  });
  serverAPI.on(Notifications.PLAYER_LEFT, user => {
    console.log(`${user.name} left.`);
    updateEmbed().catch(console.error);
  });
}

async function updateEmbed() {
  // Race-condition prevention - Returns if the embed function is already running or channel doesn't exist
  if (!channel || embedUpdateInProgress) { return; }
  embedUpdateInProgress = true;
  try {
    // If pinnedEmbed in null, search pins for the embed
    if (!pinnedEmbed) {
      const pins = await channel.messages.fetchPins();
      pinnedEmbed = pins.items.find(
        (pin) => pin.message.author.id === client.user!.id
          && pin.message.embeds.length > 0
      )?.message ?? null;
    }

    // Embed set based on whether server is active
    const playerList = await serverAPI?.getConnectedPlayers();
    const embed = serverAPI
      ? liveEmbed(playerList)
      : deadEmbed(Date.now());

    if (pinnedEmbed) { // If embed exists, edit it
      try {
        await pinnedEmbed.edit({ embeds: [embed] });
      } catch { // Edge case: Pinned embed exists but was deleted or couldn't be edited
        pinnedEmbed = null;
        embedUpdateInProgress = false;
        await updateEmbed();
      }
    } else { // If embed does not exist, send the embed and pin it
      pinnedEmbed = await channel.send({ embeds: [embed] });
      await pinnedEmbed.pin();
    }
  } finally {
    embedUpdateInProgress = false;
  }
}

function isServiceActive() {
  try {
    execSync(`systemctl is-active --quiet ${process.env.SERVICE}`);
    return true;
  } catch {
    return false;
  }
}


client.once(Events.ClientReady, async c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
  try {
    channel = await client.channels.fetch(process.env.CHANNEL_ID!) as TextChannel;
  } catch (error) {
    console.error(`Unable to connect to text channel: ${error}`);
  }
  // Attempt to connect to the server if it is already running
  console.log("Attemping to connect to existing websocket...");
  try {
    await connect();
    console.log("Connected to websocket");
  } catch {
    console.log("No websocket found");
  }

  await updateEmbed();
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  if (command == 'start') {
    console.log("Start command invoked");
    if (serverAPI) {
      await interaction.reply({ content: "Server is already running.", flags: MessageFlags.Ephemeral });
      return;
    }

    if (isServiceActive()) {
      await interaction.reply({ content: "Server is already running.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await execAsync(`sudo systemctl start ${process.env.SERVICE}`);
      await interaction.editReply('Server started.');
    } catch (error) {
      console.error(error);
      await interaction.editReply('Failed to start the server.');
      return;
    }

    try {
      await connect();
      await updateEmbed();
    } catch (error) {
      console.error(`Connecting to the websocket failed: ${error}`);
    }
  }
  else if (command == 'stop') {
    console.log("Stop command invoked");
    if (serverAPI) {
      await serverAPI.stop();
      disconnect();
      await interaction.reply({ content: 'Server stopped.', flags: MessageFlags.Ephemeral });
      await updateEmbed();
      return;
    }
    if (!isServiceActive()) {
      await interaction.reply({ content: "Server is not running.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await execAsync(`sudo systemctl stop ${process.env.SERVICE}`);
      await interaction.editReply('Server stopped.');
      await updateEmbed();
    } catch (error) {
      console.error(error);
      await interaction.editReply('Failed to stop the server.');
    }
  }
});


client.login(process.env.DISCORD_TOKEN);