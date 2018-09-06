const http		= require('http');
const request	= require('request-promise-native');
const RssFeedEmitter = require('rss-feed-emitter');

const feeds = require('./feeds');
const { interval, port = process.env.port, archiveEndpoint, removeQuery } = require('./config');

let feeder = new RssFeedEmitter();

let queue = [];

function addToQueue(link) {
	queue.push(link);
	console.log(`${ link }: Added to queue`);
	if (queue.length == 1){
		runRequests();
	}
}

async function runRequests(){
	while (queue.length) {
		let current = queue[queue.length - 1];

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

		if (!removeQuery){
			url = url.split('?')[0];
		}

		if (url !== current){
			console.log(`${ current }: Redirected to ${ url }`);
		}

		let res = await request({
			url: archiveEndpoint + url,
			followAllRedirects: true
		})
		.then(res => {
			return 'Success';
		})
		.catch(err => {
			return err.message;
		});

		queue.pop();
		
		process.stdout.write(`${ url }: ${ res }.`);
		if (res.includes('ETIMEDOUT')){
			addToQueue(current);
			process.stdout.write(' Re-added to queue')
		}
		process.stdout.write('\n');
	}
}

feeds.forEach(feed => {
	feeder.add({
		url: feed,
		refresh: interval || 60
	});
});

feeder.on('new-item', ({ link }) => {
	addToQueue(link)
});

let server = http.createServer();

server.listen({ port: port }, () => console.log(`Listening on port ${ port }!`));
