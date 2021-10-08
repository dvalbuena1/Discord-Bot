import Collection from "@discordjs/collection";

const keys: Collection<string, string> = new Collection<string, string>();
//Music commands
keys.set("p", "Music");
keys.set("play", "Music");
keys.set("d", "Music");
keys.set("disconnect", "Music");
keys.set("n", "Music");
keys.set("next", "Music");
keys.set("l", "Music");
keys.set("loop", "Music");
//Ping commands
keys.set("ping", "Ping");

export default keys;
