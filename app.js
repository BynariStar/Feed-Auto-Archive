const db = require("./db");
const request	= require('request-promise-native');
const RssFeedEmitter = require('rss-feed-emitter');

const feeds = require('./config/feeds');
let config = require('./config/config');

let feeder = new RssFeedEmitter();

let queue = [];

async function insertRow(url) {
	if (await findUrl(url) != undefined) {
		return;
	}
	db.run(
		`INSERT INTO urls (url) VALUES (?)`,
		[url],
		function (error) {
			if (error) {
				console.error(error.message);
			}
		}
	);
}

function findUrl(url) {
	return new Promise((resolve, reject) => {
		db.get(`SELECT * FROM urls WHERE url = ?`, url, (error, row) => {
			if (error) {
				return reject(error.message);
			}

			return resolve(row);
		});
	});
}

function addToQueue(link, customConfig) {
	queue.push({'url': link, 'customConfig': customConfig});
	console.log(`${ link }: Added to queue`);
	if (queue.length == 1){
		runRequests();
	}
}

async function runRequests(){
	while (queue.length) {
		let current = queue[queue.length - 1].url;
		let customConfig = queue[queue.length - 1].customConfig;
		let currentConfig = JSON.parse(JSON.stringify(config));
		if (customConfig !== undefined) {
			Object.keys(customConfig).forEach(function (k){
				currentConfig[k] = customConfig[k];
			});
		}

		let url = await request({
			url: current,
			followAllRedirects: true,
			resolveWithFullResponse: true
		})
		.then(res => {
			return res.request.uri.href;
		})
		.catch(err => {
			console.log(`${ current }: Couldn't query URL, archiving without redirect check`)
			return current;
		});

		if (!currentConfig.keepQuery){
			url = url.split('?')[0];
		}

		if (url !== current) {
			console.log(`${current}: Redirected to ${url}`);
		}

		if (config.checkSavedBefore) {
			var savedBefore = false;
			if (await findUrl(url) == undefined) {
				let option = {
					url: currentConfig.archiveAvailableEndpoint + url,
				};
				if (config.proxy) {
					option.proxy = config.proxy;
				}
				var res = await request(option)
					.then(res => {
						if (Object.keys(JSON.parse(res).archived_snapshots).length > 0) {
							insertRow(url);
							savedBefore = true;
							return 'Didn\'t archive, saved before';
						}
					})
					.catch(err => {
						savedBefore = true;
						return err.message;
					})
			} else {
				res = 'Didn\'t archive, saved before';
				savedBefore = true;
			}
		}
		if (config.checkSavedBefore === false || !savedBefore) {
			let option = {
				url: currentConfig.archiveSaveEndpoint + url,
				followAllRedirects: true
			};
			if (config.proxy) {
				option.proxy = config.proxy;
			}
			var res = await request(option)
				.then(res => {
					insertRow(url);
					return 'Success';
				})
				.catch(err => {
					return err.message;
				});
		}

		queue.pop();
		process.stdout.write(`${ url }: ${ res }.`);
		if (res.includes('ETIMEDOUT')){
			addToQueue(current);
			process.stdout.write(' Re-added to queue')
		}
		if (res.includes('429 Too Many Requests')){
			addToQueue(current);
			process.stdout.write(` Sleep ${config.tooManyRequestsSleepTime || 60} seconds`);
			await new Promise(r => setTimeout(r, (config.tooManyRequestsSleepTime || 60) * 1000));
		}
		process.stdout.write('\n');
	}
}

feeds.default.forEach(feed => {
	feeder.add({
		url: feed,
		refresh: config.interval || 60,
		eventName: 'default'
	});
});
feeder.on('default', ({ link }) => {
	console.log(link);
	if (link) addToQueue(link)
});

if ('keepQuery' in feeds) {
	feeds.keepQuery.forEach(feed => {
		feeder.add({
			url: feed,
			refresh: config.interval || 60,
			eventName: 'keepQuery'
		});
	});
	feeder.on('keepQuery', ({ link }) => {
		if (link) addToQueue(link, {"keepQuery": true})
	});
}

feeder.on('error', function (){});