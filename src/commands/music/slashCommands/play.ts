import {
  ApplicationCommandOptionType,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";

const data: RESTPostAPIApplicationCommandsJSONBody = {
  name: "play",
  description: "Play a song in your voice channel",
  options: [
    {
      name: "input",
      description: "A search term or a link",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};
export default data;
