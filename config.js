let config = {};

// Feed request interval in seconds, defaults to 60 if not defined
config.interval = 60;

// Comment out to use port provided by the Node environment
config.port = 8080;

// Removes the query (everything after the '?') from the url, defaults to false
config.removeQuery = false;

// Archives feeds to Archive.org by default
config.archiveEndpoint = "https://web.archive.org/save/";

module.exports = config;