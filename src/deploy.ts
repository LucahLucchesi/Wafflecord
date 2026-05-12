import { REST, Routes, SlashCommandBuilder } from "discord.js";

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
const commands = [
    { name: 'start', description: 'Starts the server' },
    { name: 'stop', description: 'Stops the server' },
    { name: 'send', description: 'Send a server message'},
];

(async () => {
    try {
        console.log(`Registering ${commands.length} application (/) command(s)...`);

        const data = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID ?? "",
                process.env.GUILD_ID ?? ""
            ),
            { body: commands }
        );

        console.log(`Successfully registered ${commands.length} command(s).`);
    } catch (error) {
        console.error('Failed to register commands:', error);
        process.exit(1);
    }
})();
