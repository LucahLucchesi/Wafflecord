import { Client, Events, GatewayIntentBits } from "discord.js";
import { WebSocketConnection, MinecraftServer, Notifications } from "mc-server-management";
import { exec } from 'child_process';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let connection: WebSocketConnection | null = null;
let server: MinecraftServer | null = null;

function closeConnection() {
  if (!connection) return;
  connection.close();
  connection = null;
  server = null;
}

client.once(Events.ClientReady, async c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  if (command == 'start') {
    if (server) {
      await interaction.reply("Server is already running.");
      return;
    }

    await interaction.deferReply();

    exec(`sudo systemctl start ${process.env.SERVICE}`, async (error) => {
      if (error) {
        console.error(`Start failed: ${error.message}`);
        await interaction.editReply(`Failed to start server: ${error.message}`);
        return;
      }
      await interaction.editReply(`Server started.`);

      // Should be converted to connect() function. If failed to connect, suggest building connect to websocket command
      connection = await WebSocketConnection.connect(process.env.WEBSOCKET_URL!, process.env.AUTH_TOKEN!);
      server = new MinecraftServer(connection);
      server.on(Notifications.PLAYER_JOINED, user => console.log(`${user.name} joined.`));
      server.on('error', (error) => { console.error('Connection error: ', error); });

      connection.on('max_reconnects_reached', () => {
        console.error('Connection permanently lost.');
        closeConnection();
      });

    });
  }
  if (command == 'stop') {
    if(!server) {
      await interaction.reply("Server is not running.");
      return;
    }
    await server.stop();
    closeConnection();
    await interaction.reply("Server stopped.");
  }
})


client.login(process.env.DISCORD_TOKEN);