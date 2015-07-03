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

    var query = knex('posts').limit(20).offset(offset);
    query.select('*');
    query.select(knex.raw('((LOG10((posts.score / sources.score_avg) - TIMESTAMPDIFF(SECOND, NOW(), posts.created_at)) / 604800) as strength'));
    query.orderBy('strength', 'desc');

    query.limit(20).then(function(posts) {
	res.status(200).send(posts);
    }).catch(function(err) {
	res.status(500).send({
	    error: err
	});
    });

});

router.get('/posts/trending', function(req, res) {

    var offset = parseInt(req.query.offset || 0, 10);

    var query = knex('posts').limit(20).offset(offset);
    query.select('*');
    query.select(knex.raw('((LOG10(posts.social_score) - TIMESTAMPDIFF(SECOND, NOW(), posts.created_at)) / 604800) as strength'));
    query.orderBy('strength', 'desc');

    query.limit(20).then(function(posts) {
	res.status(200).send(posts);
    }).catch(function(err) {
	res.status(500).send({
	    error: err
	});
    });

});

var app = express();

app.use(compression());
app.use('/api', router);

var port = config.port || process.env.PORT || 8080;
app.listen(port, function() {
    log.info('API listening on port:', port);
});