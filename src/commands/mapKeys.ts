import Collection from "@discordjs/collection";

const keys: Collection<string, string> = new Collection<string, string>();
//Music commands
keys.set("p", "Music");
keys.set("play", "Music");
//Ping commands
keys.set("ping", "Ping");

export default keys;
