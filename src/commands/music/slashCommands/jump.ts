import {
  ApplicationCommandOptionType,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types/v10";

const data: RESTPostAPIApplicationCommandsJSONBody = {
  name: "jump",
  description: "Jumps to the specific song in the queue",
  options: [
    {
      name: "position",
      description: "The position of the track you want to jump to",
      type: ApplicationCommandOptionType.Integer,
      required: true,
    },
  ],
};
export default data;
