///////////////////
require('longjohn');
///////////////////

var config = require('./config');
var log = require('log')(config.log);
var express = require('express');
var compression = require('compression');

var knex = require('knex')({
    client: 'mysql',
    connection: config.db,
    debug: true
});

var router = express.Router();

router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });   
});

router.get('/posts/new', function(req, res) {

    var offset = parseInt(req.query.offset || 0, 10);

    var query = knex('posts').offset(offset);
    query.select('posts.*', 'sources.score_avg');
    query.select(knex.raw('sources.title as source_title'));
    query.select(knex.raw('sources.logo_url as source_logo_url'));
    query.join('sources', 'posts.source_id', 'sources.id');
    query.orderBy('created_at', 'desc');
    query.groupByRaw('IFNULL(posts.content_url,posts.url)');

    query.limit(100).then(function(posts) {
	res.status(200).send(posts);
    }).catch(function(err) {
	res.status(500).send({
	    error: err
	});
    });

});

router.get('/posts/hot', function(req, res) {

    var offset = parseInt(req.query.offset || 0, 10);

    var query = knex('posts').offset(offset);
    query.select('posts.*', 'sources.score_avg');
    query.select(knex.raw('sources.title as source_title'));
    query.select(knex.raw('sources.logo_url as source_logo_url'));
    query.select(knex.raw('(LOG10(posts.score / sources.score_avg) - TIMESTAMPDIFF(SECOND, posts.created_at, NOW()) / 45000) as strength'));
    query.join('sources', 'posts.source_id', 'sources.id');
    query.orderBy('strength', 'desc');
    query.groupByRaw('IFNULL(posts.content_url,posts.url)');

    query.limit(100).then(function(posts) {
	res.status(200).send(posts);
    }).catch(function(err) {
	res.status(500).send({
	    error: err
	});
    });

});

router.get('/posts/trending', function(req, res) {

    var offset = parseInt(req.query.offset || 0, 10);

    var query = knex('posts').offset(offset);
    query.select('posts.*', 'sources.social_score_avg');
    query.select(knex.raw('sources.title as source_title'));
    query.select(knex.raw('sources.logo_url as source_logo_url'));
    query.select(knex.raw('(LOG10(posts.social_score / sources.social_score_avg) - TIMESTAMPDIFF(SECOND, posts.created_at,  NOW()) / 45000) as strength'));
    query.join('sources', 'posts.source_id', 'sources.id');
    query.orderBy('strength', 'desc');
    query.groupByRaw('IFNULL(posts.content_url,posts.url)');

    query.limit(100).then(function(posts) {
	res.status(200).send(posts);
    }).catch(function(err) {
	res.status(500).send({
	    error: err
	});
    });

});

router.get('/posts/top', function(req, res) {

    var offset = parseInt(req.query.offset || 0, 10);
    var limit = parseInt(req.query.limit || 5, 10);
    var age = parseInt(req.query.age || 24, 10);

    var query = knex('posts').offset(offset);
    query.select('posts.*', 'sources.social_score_avg');
    query.select(knex.raw('sources.title as source_title'));
    query.select(knex.raw('sources.logo_url as source_logo_url'));
    query.select(knex.raw('(posts.social_score / sources.social_score_avg) as strength'));
    query.join('sources', 'posts.source_id', 'sources.id');
    query.whereRaw('TIMESTAMPDIFF(HOUR, posts.created_at, NOW()) < ?', age);
    query.orderBy('strength', 'desc');
    query.groupByRaw('IFNULL(posts.content_url,posts.url)');

    query.limit(limit).then(function(posts) {
	res.status(200).send(posts);
    }).catch(function(err) {
	res.status(500).send({
	    error: err
	});
    });

});

var app = express();

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    if ('OPTIONS' === req.method || '/health_check' === req.path) {
	res.sendStatus(200);
    } else {
	next();
    }
});

app.use(compression());
app.use('/api', router);

var port = config.port || process.env.PORT || 8080;
app.listen(port, function() {
    log.info('API listening on port:', port);
}).on('error', function(err) {
    log.error(err);
});
