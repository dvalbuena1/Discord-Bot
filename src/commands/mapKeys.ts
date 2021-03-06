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
keys.set("sh", "Music");
keys.set("shuffle", "Music");
keys.set("q", "Music");
keys.set("queue", "Music");
keys.set("j", "Music");
keys.set("jump", "Music");
keys.set("r", "Music");
keys.set("remove", "Music");
keys.set("ps", "Music");
keys.set("pause", "Music");
keys.set("unps", "Music");
keys.set("unpause", "Music");
keys.set("b", "Music");
keys.set("back", "Music");
keys.set("pn", "Music");
keys.set("playnext", "Music");
keys.set("cl", "Music");
keys.set("clear", "Music");
//Info commands
keys.set("ping", "Info");

export default keys;
