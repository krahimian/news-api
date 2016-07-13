/* global module, require */

var express = require('express'),
    async = require('async'),
    _ = require('lodash');
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

    //TODO - set parameter limits

    var offset = parseInt(req.query.offset || 0, 10);
    var limit = parseInt(req.query.limit || 100, 10);
    var age = parseInt(req.query.age || 72, 10);
    var decay = parseInt(req.query.decay || 90000, 10);
    var excluded_ids = []; //TODO - get from query

    var anger_lt = parseFloat(req.query.anger_lt);
    var anger_gt = parseFloat(req.query.anger_gt);
    var disgust_lt = parseFloat(req.query.disgust_lt);
    var disgust_gt = parseFloat(req.query.disgust_gt);
    var fear_lt = parseFloat(req.query.fear_lt);
    var fear_gt = parseFloat(req.query.fear_gt);
    var joy_lt = parseFloat(req.query.joy_lt);
    var joy_gt = parseFloat(req.query.joy_gt);
    var sadness_lt = parseFloat(req.query.sadness_lt);
    var sadness_gt = parseFloat(req.query.sadness_gt);
    var sentiment_lt = parseFloat(req.query.sentiment_lt);
    var sentiment_gt = parseFloat(req.query.sentiment_gt);

    async.waterfall([
	function(cb) {
	    req.app.locals.db('channels_sources').where('channel_id', res.locals.channel.id).asCallback(cb);
	},
	function(channels_sources, cb) {
	    var source_ids = [];

	    channels_sources.forEach(function(i) {
		source_ids.push(i.source_id);
	    });

	    var query = req.app.locals.db('sources');
	    query.select('posts.*', 'sources.score_avg');
	    query.select(req.app.locals.db.raw('(CASE WHEN `posts`.`content_url` = "" THEN `posts`.`url` ELSE `posts`.`content_url` END) as main_url'));
	    query.select(req.app.locals.db.raw('sources.title as source_title'));
	    query.select(req.app.locals.db.raw('sources.logo_url as source_logo_url'));
	    query.select(req.app.locals.db.raw('MAX(LOG10(posts.score / sources.score_avg) - TIMESTAMPDIFF(SECOND, posts.created_at, NOW()) / ?) as strength', [decay]));
	    query.join('posts', 'posts.source_id', 'sources.id');
	    query.orderBy('strength', 'desc');
	    query.whereIn('sources.id', source_ids);
	    query.whereRaw('posts.created_at > (NOW() - INTERVAL ? HOUR)', age);
	    query.whereNotIn('posts.id', excluded_ids);
	    query.groupBy('main_url', 'posts.title');

	    if (anger_lt || anger_gt)
		query.whereNot('posts.anger', 0);
	    if (anger_lt) {
		query.where('posts.anger', '<', anger_lt);
	    } else if (anger_gt) {
		query.where('posts.anger', '>', anger_gt);
	    }

	    if (disgust_lt || disgust_gt)
		query.whereNot('posts.disgust', 0);
	    if (disgust_lt) {
		query.where('posts.disgust', '<', disgust_lt);
	    } else if (disgust_gt) {
		query.where('posts.disgust', '>', disgust_gt);
	    }

	    if (fear_lt || fear_gt)
		query.whereNot('posts.fear', 0);
	    if (fear_lt) {
		query.where('posts.fear', '<', fear_lt);
	    } else if (fear_gt) {
		query.where('posts.fear', '>', fear_gt);
	    }

	    if (joy_lt || joy_gt)
		query.whereNot('posts.joy', 0);
	    if (joy_lt) {
		query.where('posts.joy', '<', joy_lt);
	    } else if (joy_gt) {
		query.where('posts.joy', '>', joy_gt);
	    }

	    if (sadness_lt || sadness_gt)
		query.whereNot('posts.sadness', 0);
	    if (sadness_lt) {
		query.where('posts.sadness', '<', sadness_lt);
	    } else if (sadness_gt) {
		query.where('posts.sadness', '>', sadness_gt);
	    }

	    if (sentiment_lt || sentiment_gt)
		query.whereNot('posts.sentiment', 0);
	    if (sentiment_lt) {
		query.where('posts.sentiment', '<', sentiment_lt);
	    } else if (sentiment_gt) {
		query.where('posts.anger', '>', sentiment_gt);
	    }

	    query.limit(100);
	    query.asCallback(cb);
	},
	function(posts, cb) {
	    var ids = [];
	    posts.forEach(function(p) {
		ids.push(p.id);
	    });

	    async.parallel({
		entity: function(cb) {
		    var q = req.app.locals.db('entities_posts').select();
		    q.join('entities', 'entities.id', 'entities_posts.entity_id');
		    q.whereIn('post_id', ids);
		    q.where('relevance', '>', '0.2');
		    q.asCallback(cb);
		},
		concept: function(cb) {
		    var q = req.app.locals.db('concepts_posts').select();
		    q.join('concepts', 'concepts.id', 'concepts_posts.concept_id');		    
		    q.whereIn('post_id', ids);
		    q.where('relevance', '>', '0.2');
		    q.asCallback(cb);
		},
		keywords: function(cb) {
		    var q = req.app.locals.db('keywords_posts').select();
		    q.join('keywords', 'keywords.id', 'keywords_posts.keyword_id');		    
		    q.whereIn('post_id', ids);
		    q.where('relevance', '>', '0.2');
		    q.asCallback(cb);
		}
	    }, function(err, relations) {
		if (err) {
		    cb(err);
		    return;
		}

		var result = [];

		posts.forEach(function(p) {
		    p.related = [];
		    p.entities = [];
		    relations.entity.forEach(function(e, i) {
			if (e.post_id === p.id)
			    p.entities.push(relations.entity[i]);
		    });

		    p.concepts = [];
		    relations.concept.forEach(function(c, i) {
			if (c.post_id === p.id)
			    p.concepts.push(relations.concept[i]);
		    });

		    p.keywords = [];
		    relations.keywords.forEach(function(k, i) {
			if (k.post_id === p.id)
			    p.keywords.push(relations.keywords[i]);
		    });

		    var related_id;
		    var related_score = 0;
		    for (var j=0; j < result.length; j++) {
			var intersections = _.intersectionBy(result[j].concepts, p.concepts, 'concept_id').length;
			intersections += _.intersectionBy(result[j].entities, p.entities, 'entity_id').length;
			intersections += _.intersectionBy(result[j].keywords, p.keywords, 'keyword_id').length;

			if (intersections > 7 && intersections > related_score) {
			    related_score = intersections;
			    related_id = j;
			}
		    }

		    if (typeof related_id !== 'undefined') {
			p.intersections = related_score;
			result[related_id].related.push(p);
		    } else {
			result.push(p);
		    }
		});

		cb(null, result);
	    });
	}
    ], function(err, posts) {

	if (err) {
	    res.status(500).send({ error: err });
	    return;
	}

	if (!posts.length) res.status(404).send({ error: 'empty' });
	else res.status(200).send(posts.slice(0,limit));

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
    query.where('channels.name', req.params.channel);

    // exclusions
    query.whereNot('sources.id', 96);

    query.limit(limit);
    query.then(function(posts) {
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
