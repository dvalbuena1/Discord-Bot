import {
  ApplicationCommandOptionType,
  RESTPostAPIApplicationCommandsJSONBody,
} from "discord-api-types";

const data: RESTPostAPIApplicationCommandsJSONBody = {
  name: "remove",
  description: "Removes the specific song",
  options: [
    {
      name: "position",
      description: "The position of the track you want to remove",
      type: ApplicationCommandOptionType.Integer,
      required: true,
    },
  ],
};
export default data;
