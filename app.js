const http		= require('http');
const request	= require('request-promise-native');
const RssFeedEmitter = require('rss-feed-emitter');

const feeds = require('./config/feeds');
const { interval, port = process.env.port, archiveEndpoint, keepQuery } = require('./config/config');

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

		if (!keepQuery){
			url = url.split('?')[0];
		}

		if (url !== current){
			console.log(`${ current }: Redirected to ${ url }`);
		}

		if (process.env.NODE_ENV !== 'production') {
			var res = 'Didn\'t archive, not in production';
		} else {
			var res = await request({
				url: archiveEndpoint + url,
				followAllRedirects: true
			})
			.then(res => {
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
		process.stdout.write('\n');
	}
}

feeder.on('new-item', ({ link }) => {
	if (link) addToQueue(link)
});

let server = http.createServer((req, res) => {
	res.end();
});

server.listen({ port: port }, () => console.log(`Listening on port ${ port }!`));

feeds.forEach(feed => {
	feeder.add({
		url: feed,
		refresh: interval || 60
	});
});
