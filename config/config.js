let config = {};

// Feed request interval in seconds, defaults to 60 if not defined
config.interval = 600;

// Keeps the query (everything after the '?') from the url, defaults to false
config.keepQuery = false;

// Archives feeds to Archive.org by default
config.archiveSaveEndpoint = "https://web.archive.org/save/";
config.archiveAvailableEndpoint = "https://archive.org/wayback/available?url=";

config.proxy = "http://localhost:8123";

config.checkSavedBefore = true;

config.tooManyRequestsSleepTime = 60;

module.exports = config;
