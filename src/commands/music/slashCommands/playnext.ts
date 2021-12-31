import {
  ApplicationCommandOptionType,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types";

const data: RESTPostAPIApplicationCommandsJSONBody = {
  name: "playnext",
  description: "Queue a song immediately after",
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
