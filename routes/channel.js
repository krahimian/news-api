/* global module, require */

var express = require('express'),
    async = require('async'),
    Fetcher = require('fetcher'),
    utils = require('../utils'),
    router = express.Router({mergeParams: true});

var find = function(req, res, next) {
    var query = req.app.locals.db('channels').select().where('name', req.params.channel);
    query.then(function(results) {
	res.locals.channel = results[0];

	if (!res.locals.channel.id) {
	    res.status(400).send({ error: 'channel does not exist' });
	    return;
	}

	next();
    }).catch(function(err) {
	res.status(500).send({ error: err });
    });
};

router.post('/', utils.isAuthenticated, find, function(req, res) {

    if (!req.query.source_id && !req.body.url) {
	res.status(400).send({ error: 'missing source_id or url' });
	return;
    }

    var response = function(source_id) {
	var sql = req.app.locals.db('channels_sources').insert({
	    source_id: source_id,
	    channel_id: res.locals.channel.id
	}).toString();

	sql = sql.replace('insert', 'insert ignore');

	req.app.locals.db.raw(sql).then(function(row) {
	    res.status(200).send(row);
	}).catch(function(err) {
	    res.status(500).send({ error: err });
	});
    };

    if (req.query.source_id) {
	response(req.query.source_id);
	return;
    }

    var s = {};

    async.waterfall([
	function(cb) {
	    var url = req.body.url;
	    var fetcher = Fetcher(url);
	    fetcher.build({}, cb);
	},
	function(source, cb) {
	    s = source;
	    var q = req.app.locals.db('sources').select().where('feed_url', source.feed_url);
	    q.asCallback(cb);
	},
	function(rows, cb) {
	    if (rows.length) {
		s = rows[0];
		cb(null);
		return;
	    }

	    req.app.locals.db('sources').insert({
		feed_url: s.feed_url,
		title: s.title,
		logo_url: s.logo_url,
		created_at: new Date(),
		updated_at: new Date()
	    }).asCallback(cb);
	}
    ], function(err, id) {
	if (err) {
	    res.status(500).send({ error: err });
	    return;
	};

	response(id || s.id);
    });

});

router.delete('/', utils.isAuthenticated, utils.hasParams(['source_id']), find, function(req, res) {

    req.app.locals.db('channels_sources').del({
	source_id: req.query.source_id,
	channel_id: res.locals.channel.id
    }).then(function() {
	res.status(200).send({success: true});
    }).catch(function(err) {
	res.status(500).send({ error: err });
    });

});

router.get('/trending', find, function(req, res) {

    var offset = parseInt(req.query.offset || 0, 10);

    async.waterfall([
	function(cb) {
	    req.app.locals.db('channels_sources').where('channel_id', res.locals.channel.id).asCallback(cb);
	},
	function(channels_sources, cb) {
	    var source_ids = [];

	    channels_sources.forEach(function(i) {
		source_ids.push(i.source_id);
	    });

	    var query = req.app.locals.db('sources').offset(offset);
	    query.select('posts.*', 'sources.score_avg');
	    query.select(req.app.locals.db.raw('sources.title as source_title'));
	    query.select(req.app.locals.db.raw('sources.logo_url as source_logo_url'));
	    query.select(req.app.locals.db.raw('(LOG10(posts.score / sources.score_avg) - TIMESTAMPDIFF(SECOND, posts.created_at, NOW()) / 45000) as strength'));
	    query.join('posts', 'posts.source_id', 'sources.id');
	    query.orderBy('strength', 'desc');
	    query.groupByRaw('IFNULL(posts.content_url,posts.url)');
	    query.whereIn('sources.id', source_ids);
	    query.whereRaw('posts.created_at > (NOW() - INTERVAL 2 DAY)');

	    query.limit(50).asCallback(cb);
	}
    ], function(err, posts) {

	if (err) {
	    res.status(500).send({ error: err });
	    return;
	}

	if (!posts.length) res.status(404).send({ error: 'empty' });
	else res.status(200).send(posts);

    });
});

router.get('/latest', find, function(req, res) {

    var offset = parseInt(req.query.offset || 0, 10);
    var limit = parseInt(req.query.limit || 5, 10);

    async.waterfall([
	function(cb) {
	    req.app.locals.db('channels_sources').where('channel_id', res.locals.channel.id).asCallback(cb);
	},
	function(channels_sources, cb) {
	    var source_ids = [];

	    channels_sources.forEach(function(i) {
		source_ids.push(i.source_id);
	    });

	    var query = req.app.locals.db('sources').offset(offset);
	    query.select('posts.*', 'sources.score_avg');
	    query.select(req.app.locals.db.raw('sources.title as source_title'));
	    query.select(req.app.locals.db.raw('sources.logo_url as source_logo_url'));
	    query.select(req.app.locals.db.raw('(LOG10(posts.score / sources.score_avg) - TIMESTAMPDIFF(SECOND, posts.created_at, NOW()) / 1800) as strength'));
	    query.join('posts', 'posts.source_id', 'sources.id');
	    query.orderBy('strength', 'desc');
	    query.groupByRaw('IFNULL(posts.content_url,posts.url)');
	    query.whereRaw('posts.created_at > (NOW() - INTERVAL 2 DAY)');	    
	    query.whereIn('sources.id', source_ids);	    

	    query.limit(limit).asCallback(cb);

	}

    ], function(err, posts) {

	if (err) {
	    res.status(500).send({ error: err });
	    return;
	}

	if (!posts.length) res.status(404).send({ error: 'empty' });
	else res.status(200).send(posts);

    });

});

router.get('/top', function(req, res) {

    var offset = parseInt(req.query.offset || 0, 10);
    var limit = parseInt(req.query.limit || 5, 10);
    var age = parseInt(req.query.age || 24, 10);

    var query = req.app.locals.db('sources').offset(offset);
    query.select('posts.*', 'sources.social_score_avg');
    query.select(req.app.locals.db.raw('sources.title as source_title'));
    query.select(req.app.locals.db.raw('sources.logo_url as source_logo_url'));
    query.select(req.app.locals.db.raw('(posts.social_score / sources.social_score_avg) as strength'));
    query.join('posts', 'posts.source_id', 'sources.id');
    query.join('channels_sources', 'channels_sources.source_id', 'sources.id');
    query.join('channels', 'channels.id', 'channels_sources.channel_id');
    query.whereRaw('posts.created_at > (NOW() - INTERVAL ? HOUR)', age);
    query.orderBy('strength', 'desc');
    query.groupByRaw('IFNULL(posts.content_url,posts.url)');
    query.where('channels.name', req.params.channel);

    query.limit(limit).then(function(posts) {
	if (!posts.length) res.status(404).send({ error: 'empty' });	
	else res.status(200).send(posts);
    }).catch(function(err) {
	res.status(500).send({
	    error: err
	});
    });

});

router.get('/sources', function(req, res) {

    var query = req.app.locals.db('sources').select('sources.*');
    query.join('channels_sources', 'channels_sources.source_id', 'sources.id');
    query.join('channels', 'channels.id', 'channels_sources.channel_id');
    query.where('channels.name', req.params.channel);

    query.then(function(sources) {
	res.status(200).send(sources);
    }).catch(function(err) {
	res.status(500).send({ error: err });
    });

});

module.exports = router;
