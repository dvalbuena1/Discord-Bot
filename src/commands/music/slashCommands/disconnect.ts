import { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";

const data: RESTPostAPIApplicationCommandsJSONBody = {
  name: "disconnect",
  description:
    "Resets the player, cleans the queue, and leaves the voice channel",
};
export default data;
